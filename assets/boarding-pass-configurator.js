/**
 * Boarding Pass Configurator for Shopify
 *
 * Handles airport selection, date picking, image preview,
 * and add-to-cart with line item properties.
 */

(function () {
  'use strict';

  // ---- State ----
  const state = {
    from: null,       // { code, city, country }
    to: null,         // { code, city, country }
    date: null,       // 'YYYY-MM-DD'
    ticketCode: null,
    airports: [],
    activeField: null, // 'from' | 'to'
  };

  // ---- Generate random boarding pass code ----
  function generateTicketCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // ---- Load airports ----
  async function loadAirports() {
    const scriptTag = document.querySelector('[data-bp-airports-url]');
    if (scriptTag) {
      const url = scriptTag.getAttribute('data-bp-airports-url');
      try {
        const resp = await fetch(url);
        state.airports = await resp.json();
        return;
      } catch (e) {
        console.warn('BP: Failed to load airports from URL, trying inline data');
      }
    }

    // Try inline data
    const inlineEl = document.getElementById('bp-airports-data');
    if (inlineEl) {
      try {
        state.airports = JSON.parse(inlineEl.textContent);
      } catch (e) {
        console.error('BP: Failed to parse inline airport data');
      }
    }
  }

  // ---- DOM References ----
  let els = {};

  function queryEls() {
    const root = document.querySelector('[data-bp-configurator]');
    if (!root) return false;

    els = {
      root,
      fromBtn: root.querySelector('[data-bp-from-btn]'),
      fromCode: root.querySelector('[data-bp-from-code]'),
      fromCity: root.querySelector('[data-bp-from-city]'),
      fromClear: root.querySelector('[data-bp-from-clear]'),
      toBtn: root.querySelector('[data-bp-to-btn]'),
      toCode: root.querySelector('[data-bp-to-code]'),
      toCity: root.querySelector('[data-bp-to-city]'),
      toClear: root.querySelector('[data-bp-to-clear]'),
      swapBtn: root.querySelector('[data-bp-swap]'),
      dateBtn: root.querySelector('[data-bp-date-btn]'),
      dateValue: root.querySelector('[data-bp-date-value]'),
      dateInput: root.querySelector('[data-bp-date-input]'),
      ticketCode: root.querySelector('[data-bp-ticket-code]'),
      modalOverlay: root.querySelector('[data-bp-modal]'),
      searchInput: root.querySelector('[data-bp-search]'),
      modalClose: root.querySelector('[data-bp-modal-close]'),
      airportList: root.querySelector('[data-bp-airport-list]'),
      canvas: root.querySelector('[data-bp-canvas]'),
      productImage: root.querySelector('[data-bp-product-image]'),
      addToCartBtn: root.querySelector('[data-bp-add-to-cart]'),
      validationMsg: root.querySelector('[data-bp-validation]'),
      // Hidden form fields
      formFrom: root.querySelector('[data-bp-form-from]'),
      formTo: root.querySelector('[data-bp-form-to]'),
      formDate: root.querySelector('[data-bp-form-date]'),
      formTicket: root.querySelector('[data-bp-form-ticket]'),
    };
    return true;
  }

  // ---- Render Functions ----

  function renderAirportField(type) {
    const airport = state[type];
    const codeEl = type === 'from' ? els.fromCode : els.toCode;
    const cityEl = type === 'from' ? els.fromCity : els.toCity;
    const clearEl = type === 'from' ? els.fromClear : els.toClear;

    if (airport) {
      codeEl.textContent = airport.code;
      codeEl.classList.remove('bp-airport-placeholder');
      codeEl.classList.add('bp-airport-code');
      cityEl.textContent = airport.city;
      cityEl.style.display = 'block';
      clearEl.style.display = 'flex';
    } else {
      codeEl.textContent = '???';
      codeEl.classList.remove('bp-airport-code');
      codeEl.classList.add('bp-airport-placeholder');
      cityEl.style.display = 'none';
      clearEl.style.display = 'none';
    }
  }

  function renderDate() {
    if (state.date) {
      els.dateValue.textContent = state.date;
    } else {
      els.dateValue.textContent = 'SELECT DATE';
      els.dateValue.style.opacity = '0.4';
    }
    if (state.date) {
      els.dateValue.style.opacity = '1';
    }
  }

  function renderTicketCode() {
    if (els.ticketCode) {
      els.ticketCode.textContent = '#' + state.ticketCode;
    }
  }

  function updateFormFields() {
    if (els.formFrom) {
      els.formFrom.value = state.from
        ? state.from.code + ' - ' + state.from.city
        : '';
    }
    if (els.formTo) {
      els.formTo.value = state.to
        ? state.to.code + ' - ' + state.to.city
        : '';
    }
    if (els.formDate) {
      els.formDate.value = state.date || '';
    }
    if (els.formTicket) {
      els.formTicket.value = state.ticketCode || '';
    }
  }

  function updateAddToCartState() {
    if (els.addToCartBtn) {
      const isComplete = state.from && state.to && state.date;
      els.addToCartBtn.disabled = !isComplete;
    }
    if (els.validationMsg) {
      els.validationMsg.classList.remove('bp-visible');
    }
  }

  // ---- Canvas Preview ----

  function renderCanvasPreview() {
    const canvas = els.canvas;
    const img = els.productImage;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, rect.width, rect.height);

    // The text overlay positions are customizable via data attributes
    const configEl = els.root.querySelector('[data-bp-preview-config]');
    if (!configEl) return;

    const config = {
      fromX: parseFloat(configEl.dataset.fromX) || 0.25,
      fromY: parseFloat(configEl.dataset.fromY) || 0.52,
      toX: parseFloat(configEl.dataset.toX) || 0.75,
      toY: parseFloat(configEl.dataset.toY) || 0.52,
      dateX: parseFloat(configEl.dataset.dateX) || 0.5,
      dateY: parseFloat(configEl.dataset.dateY) || 0.62,
      codeSize: parseFloat(configEl.dataset.codeSize) || 0.06,
      citySize: parseFloat(configEl.dataset.citySize) || 0.025,
      dateSize: parseFloat(configEl.dataset.dateSize) || 0.03,
      textColor: configEl.dataset.textColor || '#000000',
    };

    const w = rect.width;
    const h = rect.height;

    // Draw FROM airport code
    if (state.from) {
      ctx.fillStyle = config.textColor;
      ctx.textAlign = 'center';

      ctx.font = `bold ${Math.round(h * config.codeSize)}px Supply, monospace`;
      ctx.fillText(state.from.code, w * config.fromX, h * config.fromY);

      ctx.font = `${Math.round(h * config.citySize)}px Supply, monospace`;
      ctx.fillText(state.from.city, w * config.fromX, h * config.fromY + h * 0.035);
    }

    // Draw TO airport code
    if (state.to) {
      ctx.fillStyle = config.textColor;
      ctx.textAlign = 'center';

      ctx.font = `bold ${Math.round(h * config.codeSize)}px Supply, monospace`;
      ctx.fillText(state.to.code, w * config.toX, h * config.toY);

      ctx.font = `${Math.round(h * config.citySize)}px Supply, monospace`;
      ctx.fillText(state.to.city, w * config.toX, h * config.toY + h * 0.035);
    }

    // Draw date
    if (state.date) {
      ctx.fillStyle = config.textColor;
      ctx.textAlign = 'center';
      ctx.font = `bold ${Math.round(h * config.dateSize)}px Supply, monospace`;
      ctx.fillText(state.date, w * config.dateX, h * config.dateY);
    }
  }

  // ---- Modal Logic ----

  function openModal(field) {
    state.activeField = field;
    els.modalOverlay.classList.add('bp-active');
    els.searchInput.value = '';
    els.searchInput.focus();
    renderAirportList('');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    els.modalOverlay.classList.remove('bp-active');
    state.activeField = null;
    document.body.style.overflow = '';
  }

  function renderAirportList(query) {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? state.airports.filter(
          (a) =>
            a.code.toLowerCase().includes(q) ||
            a.city.toLowerCase().includes(q) ||
            a.country.toLowerCase().includes(q)
        )
      : state.airports;

    // Don't show the airport that's already selected in the other field
    const otherField = state.activeField === 'from' ? 'to' : 'from';
    const otherAirport = state[otherField];
    const available = otherAirport
      ? filtered.filter((a) => a.code !== otherAirport.code)
      : filtered;

    if (available.length === 0) {
      els.airportList.innerHTML =
        '<div class="bp-no-results">No airports found</div>';
      return;
    }

    // Build list using DocumentFragment for performance
    const fragment = document.createDocumentFragment();
    const max = Math.min(available.length, 100); // limit to 100 for performance

    for (let i = 0; i < max; i++) {
      const a = available[i];
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'bp-airport-item';
      item.dataset.code = a.code;
      item.innerHTML = `
        <span class="bp-airport-item-code">${escapeHtml(a.code)}</span>
        <span class="bp-airport-item-details">
          <span class="bp-airport-item-city">${escapeHtml(a.city)}</span>
          <span class="bp-airport-item-country">${escapeHtml(a.country)}</span>
        </span>
      `;
      item.addEventListener('click', function () {
        selectAirport(a);
      });
      fragment.appendChild(item);
    }

    els.airportList.innerHTML = '';
    els.airportList.appendChild(fragment);
  }

  function selectAirport(airport) {
    state[state.activeField] = airport;
    renderAirportField(state.activeField);
    closeModal();
    updateFormFields();
    updateAddToCartState();
    renderCanvasPreview();
  }

  // ---- Swap ----

  function swapAirports() {
    const temp = state.from;
    state.from = state.to;
    state.to = temp;
    renderAirportField('from');
    renderAirportField('to');
    updateFormFields();
    renderCanvasPreview();
  }

  // ---- Clear ----

  function clearAirport(field) {
    state[field] = null;
    renderAirportField(field);
    updateFormFields();
    updateAddToCartState();
    renderCanvasPreview();
  }

  // ---- Date ----

  function handleDateChange(e) {
    state.date = e.target.value;
    renderDate();
    updateFormFields();
    updateAddToCartState();
    renderCanvasPreview();
  }

  // ---- Add to Cart ----

  async function handleAddToCart(e) {
    e.preventDefault();

    if (!state.from || !state.to || !state.date) {
      if (els.validationMsg) {
        els.validationMsg.textContent =
          'Please select departure, destination, and date.';
        els.validationMsg.classList.add('bp-visible');
      }
      return;
    }

    const btn = els.addToCartBtn;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="bp-spinner"></span> Adding...';

    // Get the variant ID from the form or product data
    const variantInput = els.root.querySelector('[data-bp-variant-id]');
    const variantId =
      variantInput?.value ||
      variantInput?.dataset.bpVariantId ||
      document.querySelector('[name="id"]')?.value;

    if (!variantId) {
      console.error('BP: No variant ID found');
      btn.innerHTML = originalText;
      btn.disabled = false;
      return;
    }

    const properties = {
      'From': state.from.code + ' - ' + state.from.city,
      'To': state.to.code + ' - ' + state.to.city,
      'Departure Date': state.date,
      'Ticket Code': state.ticketCode,
    };

    try {
      const resp = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: parseInt(variantId, 10),
          quantity: 1,
          properties: properties,
        }),
      });

      if (!resp.ok) {
        throw new Error('Failed to add to cart');
      }

      btn.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Added!';

      // Dispatch event for theme cart drawer / notification
      document.dispatchEvent(
        new CustomEvent('cart:item-added', {
          detail: { properties },
        })
      );

      // Optionally refresh cart count in header
      try {
        const cartResp = await fetch('/cart.js');
        const cartData = await cartResp.json();
        const cartCountEls = document.querySelectorAll(
          '[data-cart-count], .cart-count, .cart-count-bubble span'
        );
        cartCountEls.forEach((el) => {
          el.textContent = cartData.item_count;
        });
      } catch (_) {
        // Ignore cart count update failures
      }

      setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 2000);
    } catch (err) {
      console.error('BP: Add to cart failed:', err);
      btn.innerHTML = 'Error - Try Again';
      btn.disabled = false;
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 2000);
    }
  }

  // ---- Utility ----

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Keyboard navigation ----

  function handleKeydown(e) {
    if (e.key === 'Escape' && els.modalOverlay?.classList.contains('bp-active')) {
      closeModal();
    }
  }

  // ---- Resize handler ----

  let resizeTimer;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderCanvasPreview();
    }, 150);
  }

  // ---- Init ----

  async function init() {
    if (!queryEls()) {
      // No configurator found on this page
      return;
    }

    state.ticketCode = generateTicketCode();
    renderTicketCode();

    await loadAirports();

    // Set default date to today
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    state.date = `${yyyy}-${mm}-${dd}`;
    if (els.dateInput) {
      els.dateInput.value = state.date;
      els.dateInput.min = state.date; // Can't pick past dates
    }
    renderDate();

    // Bind events
    els.fromBtn?.addEventListener('click', () => openModal('from'));
    els.toBtn?.addEventListener('click', () => openModal('to'));
    els.fromClear?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearAirport('from');
    });
    els.toClear?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearAirport('to');
    });
    els.swapBtn?.addEventListener('click', swapAirports);
    els.dateInput?.addEventListener('change', handleDateChange);
    els.modalClose?.addEventListener('click', closeModal);
    els.modalOverlay?.addEventListener('click', (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });
    els.searchInput?.addEventListener('input', (e) => {
      renderAirportList(e.target.value);
    });
    els.addToCartBtn?.addEventListener('click', handleAddToCart);

    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('resize', handleResize);

    // Initial render
    renderAirportField('from');
    renderAirportField('to');
    updateAddToCartState();

    // Render canvas after image loads
    if (els.productImage) {
      if (els.productImage.complete) {
        renderCanvasPreview();
      } else {
        els.productImage.addEventListener('load', renderCanvasPreview);
      }
    }
  }

  // ---- Bootstrap ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
