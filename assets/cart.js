/* ============================================================
   SUPPLY LIST CART
   ============================================================
   Pure-browser cart that persists in localStorage. Auto-injects
   itself into the .cmd-actions nav and as a drawer in <body>.
   Click "Add to Cart" on any .add-to-cart-btn → adds item.
   Click the cart icon → opens drawer.
   Click "Send as Supply List" → redirects to /#bulk and pre-fills
   the notes field with the cart contents.

   To enable per-item BUY NOW (Stripe Payment Links):
     On a .buy-now-btn link, set href="https://buy.stripe.com/..."
     The button is hidden via CSS while href is empty.
   ============================================================ */
(function () {
  'use strict';
  var STORAGE_KEY = 'sac_cart_v1';
  var PREFILL_KEY = 'sac_prefill_supply';

  var cart = {
    items: [],
    load: function () {
      try { this.items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
      catch (e) { this.items = []; }
    },
    save: function () {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
      this.render();
    },
    add: function (item) {
      var existing = this.items.find(function (i) { return i.sku === item.sku; });
      if (existing) existing.qty += item.qty || 1;
      else this.items.push({ sku: item.sku, name: item.name, category: item.category || '', qty: item.qty || 1 });
      this.save();
    },
    remove: function (sku) {
      this.items = this.items.filter(function (i) { return i.sku !== sku; });
      this.save();
    },
    updateQty: function (sku, qty) {
      var item = this.items.find(function (i) { return i.sku === sku; });
      if (!item) return;
      if (qty < 1) this.remove(sku);
      else { item.qty = qty; this.save(); }
    },
    clear: function () { this.items = []; this.save(); },
    count: function () {
      return this.items.reduce(function (sum, i) { return sum + i.qty; }, 0);
    },
    render: function () {
      var badge = document.querySelector('.cart-icon .count');
      if (badge) {
        var c = this.count();
        badge.textContent = c;
        badge.classList.toggle('show', c > 0);
      }
      var drawer = document.querySelector('.cart-drawer');
      if (drawer && drawer.classList.contains('open')) this.renderDrawer();
    },
    renderDrawer: function () {
      var list = document.querySelector('.cart-list');
      var send = document.querySelector('.cart-send');
      if (!list) return;
      if (this.items.length === 0) {
        list.innerHTML = '<div class="cart-empty"><strong>Your supply list is empty.</strong><br><small>Add items from the catalog as you browse.</small></div>';
        if (send) send.disabled = true;
        return;
      }
      list.innerHTML = this.items.map(function (item) {
        return '<div class="cart-item" data-sku="' + escapeAttr(item.sku) + '">' +
          '<div class="cart-item-info">' +
            (item.category ? '<div class="cart-item-cat">' + escapeHtml(item.category) + '</div>' : '') +
            '<div class="cart-item-name">' + escapeHtml(item.name) + '</div>' +
          '</div>' +
          '<div class="cart-item-actions">' +
            '<div class="cart-qty">' +
              '<button class="cart-qty-btn" data-action="dec" aria-label="Decrease">−</button>' +
              '<span class="cart-qty-val">' + item.qty + '</span>' +
              '<button class="cart-qty-btn" data-action="inc" aria-label="Increase">+</button>' +
            '</div>' +
            '<button class="cart-remove" aria-label="Remove">×</button>' +
          '</div>' +
        '</div>';
      }).join('');
      if (send) send.disabled = false;
    }
  };

  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]; }); }
  function escapeAttr(s) { return escapeHtml(s); }

  function injectNavIcon() {
    var actions = document.querySelector('.cmd-actions');
    if (!actions || actions.querySelector('.cart-icon')) return;
    var btn = document.createElement('button');
    btn.className = 'cart-icon';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open supply list cart');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>' +
        '<line x1="3" y1="6" x2="21" y2="6"/>' +
        '<path d="M16 10a4 4 0 0 1-8 0"/>' +
      '</svg>' +
      '<span class="count"></span>';
    actions.insertBefore(btn, actions.firstChild);
    btn.addEventListener('click', openDrawer);
  }

  function injectDrawer() {
    if (document.querySelector('.cart-drawer')) return;
    var drawer = document.createElement('div');
    drawer.className = 'cart-drawer';
    drawer.innerHTML =
      '<div class="cart-backdrop" data-close></div>' +
      '<aside class="cart-panel" role="dialog" aria-label="Supply list cart">' +
        '<header class="cart-header">' +
          '<span class="eyebrow">Supply List</span>' +
          '<h3 class="cart-title">Your Cart</h3>' +
          '<button class="cart-close" type="button" aria-label="Close" data-close>×</button>' +
        '</header>' +
        '<div class="cart-list"></div>' +
        '<footer class="cart-footer">' +
          '<button class="cart-clear" type="button">Clear all</button>' +
          '<button class="cart-send btn btn-primary btn-block" type="button">Send as Supply List →</button>' +
          '<p class="cart-note">We’ll review your list and reply with pricing and bundle options.</p>' +
        '</footer>' +
      '</aside>';
    document.body.appendChild(drawer);

    drawer.addEventListener('click', function (e) {
      if (e.target.matches('[data-close]')) closeDrawer();
    });

    drawer.querySelector('.cart-clear').addEventListener('click', function () {
      if (cart.items.length && confirm('Clear all items from your cart?')) cart.clear();
    });

    drawer.querySelector('.cart-send').addEventListener('click', sendAsSupplyList);

    drawer.querySelector('.cart-list').addEventListener('click', function (e) {
      var item = e.target.closest('.cart-item');
      if (!item) return;
      var sku = item.dataset.sku;
      if (e.target.matches('.cart-qty-btn')) {
        var action = e.target.dataset.action;
        var current = cart.items.find(function (i) { return i.sku === sku; });
        if (current) cart.updateQty(sku, current.qty + (action === 'inc' ? 1 : -1));
      } else if (e.target.matches('.cart-remove')) {
        cart.remove(sku);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });
  }

  function openDrawer() {
    var drawer = document.querySelector('.cart-drawer');
    if (!drawer) return;
    drawer.classList.add('open');
    cart.renderDrawer();
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    var drawer = document.querySelector('.cart-drawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    document.body.style.overflow = '';
  }

  function sendAsSupplyList() {
    if (cart.items.length === 0) return;
    var lines = cart.items.map(function (i) {
      var cat = i.category ? ' [' + i.category + ']' : '';
      return '• ' + i.name + cat + ' — qty ' + i.qty;
    }).join('\n');
    var prefill = 'My supply list (from cart):\n\n' + lines + '\n\nPlease quote pricing and availability.';
    sessionStorage.setItem(PREFILL_KEY, prefill);
    closeDrawer();
    window.location.href = '/#bulk';
  }

  // Hook every Add to Cart button via event delegation
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.add-to-cart-btn');
    if (!btn) return;
    e.preventDefault();
    var sku = btn.getAttribute('data-sku');
    var name = btn.getAttribute('data-name');
    var category = btn.getAttribute('data-category') || '';
    if (!sku || !name) return;
    cart.add({ sku: sku, name: name, category: category, qty: 1 });
    var orig = btn.dataset.origLabel || btn.textContent;
    btn.dataset.origLabel = orig;
    btn.classList.add('added');
    btn.textContent = 'Added ✓';
    clearTimeout(btn._resetTimer);
    btn._resetTimer = setTimeout(function () {
      btn.classList.remove('added');
      btn.textContent = orig;
    }, 1400);
  });

  // If we just came from the cart "Send as Supply List", prefill the form
  function maybePrefill() {
    var form = document.getElementById('supplyForm');
    if (!form) return;
    var prefill = sessionStorage.getItem(PREFILL_KEY);
    if (!prefill) return;
    var notes = form.querySelector('#f-notes');
    if (notes) {
      notes.value = prefill;
      sessionStorage.removeItem(PREFILL_KEY);
      setTimeout(function () {
        notes.scrollIntoView({ behavior: 'smooth', block: 'center' });
        notes.focus();
      }, 350);
    }
  }

  function init() {
    cart.load();
    injectNavIcon();
    injectDrawer();
    cart.render();
    maybePrefill();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
