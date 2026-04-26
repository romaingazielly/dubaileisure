/**
 * DLH PDP Vehicle — interactive behaviours
 * Gallery slideshow, calendar, add-ons, ticker, toast.
 */

/* ============================================================
   Gallery
   ============================================================ */
class DlhPdpGallery extends HTMLElement {
  #index = 0;
  #slides = [];
  #thumbs = [];
  #dots = [];

  connectedCallback() {
    this.#slides = [...this.querySelectorAll('[data-slide]')];
    this.#thumbs = [...this.querySelectorAll('[data-thumb]')];
    this.#dots = [...this.querySelectorAll('[data-dot]')];

    this.querySelector('[data-prev]')?.addEventListener('click', () => this.#go(this.#index - 1));
    this.querySelector('[data-next]')?.addEventListener('click', () => this.#go(this.#index + 1));

    this.#thumbs.forEach((t, i) => t.addEventListener('click', () => this.#go(i)));
    this.#dots.forEach((d, i) => d.addEventListener('click', () => this.#go(i)));

    const fav = this.querySelector('[data-fav]');
    if (fav) fav.addEventListener('click', () => fav.classList.toggle('is-active'));

    this.#show(0);
  }

  #go(n) {
    const len = this.#slides.length;
    this.#show(((n % len) + len) % len);
  }

  #show(i) {
    this.#index = i;
    this.#slides.forEach((s, j) => s.classList.toggle('is-active', j === i));
    this.#thumbs.forEach((t, j) => t.classList.toggle('is-active', j === i));
    this.#dots.forEach((d, j) => d.classList.toggle('is-active', j === i));
  }
}

if (!customElements.get('dlh-pdp-gallery')) {
  customElements.define('dlh-pdp-gallery', DlhPdpGallery);
}

/* ============================================================
   Calendar
   ============================================================ */
class DlhPdpCalendar extends HTMLElement {
  #month;
  #year;
  #selected = null;

  connectedCallback() {
    const now = new Date();
    this.#month = now.getMonth();
    this.#year = now.getFullYear();

    this.querySelector('[data-cal-trigger]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#toggle();
    });
    this.querySelector('[data-cal-prev]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#prevMonth();
    });
    this.querySelector('[data-cal-next]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.#nextMonth();
    });

    document.addEventListener('click', (e) => {
      if (!this.contains(e.target)) this.#close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.#close();
    });

    this.#render();
  }

  #toggle() {
    const popup = this.querySelector('[data-cal-popup]');
    if (!popup) return;
    popup.classList.toggle('is-open');
  }

  #close() {
    this.querySelector('[data-cal-popup]')?.classList.remove('is-open');
  }

  #prevMonth() {
    if (this.#month === 0) { this.#month = 11; this.#year--; }
    else { this.#month--; }
    this.#render();
  }

  #nextMonth() {
    if (this.#month === 11) { this.#month = 0; this.#year++; }
    else { this.#month++; }
    this.#render();
  }

  #render() {
    const title = this.querySelector('[data-cal-month-title]');
    if (title) {
      title.textContent = new Date(this.#year, this.#month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    const grid = this.querySelector('[data-cal-days]');
    if (!grid) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDay = new Date(this.#year, this.#month, 1);
    const startDow = firstDay.getDay();
    const daysInMonth = new Date(this.#year, this.#month + 1, 0).getDate();
    const prevDays = new Date(this.#year, this.#month, 0).getDate();

    let html = '';

    for (let i = startDow - 1; i >= 0; i--) {
      html += `<button class="dlh-pv__cal-day dlh-pv__cal-day--other" disabled>${prevDays - i}</button>`;
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(this.#year, this.#month, d);
      const past = date < today;
      const isToday = date.getTime() === today.getTime();
      const isActive = this.#selected && date.getTime() === this.#selected.getTime();
      const classes = ['dlh-pv__cal-day'];
      if (isToday) classes.push('dlh-pv__cal-day--today');
      if (isActive) classes.push('is-active');

      html += `<button class="${classes.join(' ')}" ${past ? 'disabled' : ''} data-day="${d}">${d}</button>`;
    }

    const remaining = 42 - (startDow + daysInMonth);
    for (let d = 1; d <= remaining; d++) {
      html += `<button class="dlh-pv__cal-day dlh-pv__cal-day--other" disabled>${d}</button>`;
    }

    grid.innerHTML = html;

    grid.querySelectorAll('[data-day]').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = parseInt(btn.dataset.day, 10);
        this.#selected = new Date(this.#year, this.#month, day);
        this.#updateDisplay();
        this.#close();
        this.#render();
        this.#showSlots();
      });
    });
  }

  #updateDisplay() {
    const txt = this.querySelector('[data-date-label]');
    this.classList.add('is-filled');
    if (txt && this.#selected) {
      txt.textContent = this.#selected.toLocaleDateString('en-US', {
        weekday: 'short', day: 'numeric', month: 'short'
      });
      txt.classList.remove('dlh-pv__date-txt--placeholder');
    }

    const input = this.querySelector('input[name="properties[Date]"]');
    if (input && this.#selected) {
      input.value = this.#selected.toLocaleDateString('en-US', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
      });
      document.dispatchEvent(new CustomEvent('dlh:pdp-selection-update', { bubbles: true }));
    }
  }

  #showSlots() {
    const slotsWrap = this.querySelector('[data-slots]');
    if (slotsWrap) slotsWrap.style.display = 'grid';
  }
}

if (!customElements.get('dlh-pdp-calendar')) {
  customElements.define('dlh-pdp-calendar', DlhPdpCalendar);
}

/* ============================================================
   Time slots
   ============================================================ */
class DlhPdpSlots extends HTMLElement {
  connectedCallback() {
    this.querySelectorAll('[data-slot]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.querySelectorAll('[data-slot]').forEach(s => s.classList.remove('is-active'));
        btn.classList.add('is-active');

        const input = this.closest('form')?.querySelector('input[name="properties[Time]"]');
        if (input) {
          input.value = btn.dataset.slot;
          document.dispatchEvent(new CustomEvent('dlh:pdp-selection-update', { bubbles: true }));
        }
      });
    });
  }
}

if (!customElements.get('dlh-pdp-slots')) {
  customElements.define('dlh-pdp-slots', DlhPdpSlots);
}

/* ============================================================
   Vehicle PDP — headline + sticky from quantity (theme quantity-selector)
   ============================================================ */
/**
 * @param {HTMLFormElement | null} form
 * @param {number} [quantityOverride] – from theme QuantitySelectorUpdateEvent (guaranteed in sync)
 */
function dlhPdpSyncLineTotalsForVehicleForm(form, quantityOverride) {
  if (!form || form.id !== 'dlh-pdp-form') return;
  // Prices live in .dlh-pv__buy (sibling of form ancestors); avoid relying only on .shopify-section
  const scope = form.closest('.dlh-pv__buy') || form.closest('.shopify-section') || form.closest('section');
  if (!scope) return;
  const nowEl = scope.querySelector('[data-price-now]');
  const wasEl = scope.querySelector('[data-price-was]');
  const qtyInput = form.querySelector('input[name="quantity"]');
  let qty;
  if (typeof quantityOverride === 'number' && !Number.isNaN(quantityOverride) && quantityOverride > 0) {
    qty = Math.floor(quantityOverride);
  } else {
    qty = Math.max(1, parseInt(String(qtyInput?.value || '1').trim() || '1', 10) || 1);
  }
  const currency = nowEl?.dataset?.currency || 'AED';

  const unit = parseInt(
    nowEl?.getAttribute('data-unit-price-cents') || nowEl?.dataset?.unitPriceCents || '0',
    10
  );
  const compareCents = parseInt(
    nowEl?.getAttribute('data-compare-at-cents') ||
      nowEl?.dataset?.compareAtCents ||
      nowEl?.dataset?.comparePriceCents ||
      '0',
    10
  );

  const fmt = (cents) => (cents / 100).toLocaleString();

  if (unit > 0 && nowEl) {
    nowEl.textContent = `${currency} ${fmt(unit * qty)}`;
  }

  if (wasEl && compareCents > 0) {
    wasEl.textContent = `${currency} ${fmt(compareCents * qty)}`;
  }

  const priceWrap = scope.querySelector('[data-vehicle-sticky-price]');
  if (priceWrap) {
    const u = parseInt(priceWrap.dataset.unitPriceCents || '0', 10);
    const c = parseInt(priceWrap.dataset.comparePriceCents || '0', 10);
    const cur = priceWrap.dataset.currency || currency;
    if (u > 0) {
      const t = (u * qty) / 100;
      const ct = (c * qty) / 100;
      if (c > 0) {
        priceWrap.textContent = `${cur} ${t.toLocaleString()} — ${cur} ${ct.toLocaleString()}`;
      } else {
        priceWrap.textContent = `${cur} ${t.toLocaleString()}`;
      }
    }
  }
}

function dlhPdpQuantityDetail(e) {
  if (e && 'detail' in e && e.detail && typeof (/** @type {any} */(e).detail).quantity === 'number') {
    return (/** @type {any} */(e).detail).quantity;
  }
  return undefined;
}

document.addEventListener('quantity-selector:update', (e) => {
  const form = document.getElementById('dlh-pdp-form');
  if (!form) return;
  const t = e.target;
  if (!t || (typeof t !== 'object')) return;
  if (!form.contains(/** @type {Node} */(t)) && !e.composedPath?.().includes(form)) {
    return;
  }
  const fromDetail = dlhPdpQuantityDetail(e);
  dlhPdpSyncLineTotalsForVehicleForm(
    /** @type {HTMLFormElement} */(form),
    fromDetail
  );
});

function dlhPdpOnQuantityFieldInput(/** @type {Event} */ e) {
  const t = /** @type {HTMLElement | null} */ (e.target);
  if (!t?.matches?.('input[name="quantity"]')) return;
  const form = t.closest('form#dlh-pdp-form');
  if (form) dlhPdpSyncLineTotalsForVehicleForm(/** @type {HTMLFormElement} */(form));
}

document.addEventListener('input', dlhPdpOnQuantityFieldInput, true);
document.addEventListener('change', dlhPdpOnQuantityFieldInput, true);

/* ============================================================
   Add-on toggles
   ============================================================ */
class DlhPdpAddons extends HTMLElement {
  connectedCallback() {
    const form = this.closest('form');
    const addonField = this.closest('[data-addon-field]') || this.closest('.dlh-pv__field');

    const syncVisibility = () => {
      if (!form || !addonField) return;

      const groups = [...new Set(
        [...form.querySelectorAll('[data-option][data-group]')]
          .map((el) => el.dataset.group)
          .filter(Boolean)
      )];

      const optionsReady =
        groups.length === 0
          || groups.every((group) => form.querySelector(`[data-option][data-group="${group}"].is-active`));

      const qtyInput = form.querySelector('input[name="quantity"]');
      const qtyReady = !qtyInput || (parseInt(qtyInput.value || '0', 10) > 0);

      const dateInput = form.querySelector('input[name="properties[Date]"]');
      const timeInput = form.querySelector('input[name="properties[Time]"]');
      const dateReady = !dateInput || dateInput.value.trim() !== '';
      const timeReady = !timeInput || timeInput.value.trim() !== '';

      const ready = optionsReady && qtyReady && dateReady && timeReady;
      addonField.hidden = !ready;
      addonField.setAttribute('aria-hidden', ready ? 'false' : 'true');
      addonField.style.display = ready ? '' : 'none';

      this.querySelectorAll('input, button, select, textarea').forEach((control) => {
        control.disabled = !ready;
      });
    };

    this.querySelectorAll('[data-addon]').forEach(label => {
      const cb = label.querySelector('input[type="checkbox"]');
      if (!cb) return;

      const sync = () => label.classList.toggle('is-active', cb.checked);
      cb.addEventListener('change', sync);
      sync();
    });

    form?.addEventListener('change', syncVisibility);
    form?.addEventListener('input', syncVisibility);
    document.addEventListener('quantity-selector:update', syncVisibility);
    document.addEventListener('dlh:pdp-selection-update', syncVisibility);
    syncVisibility();
  }
}

if (!customElements.get('dlh-pdp-addons')) {
  customElements.define('dlh-pdp-addons', DlhPdpAddons);
}

/* ============================================================
   Variant picker (seating cards + duration pills)
   ============================================================ */
class DlhPdpVariantPicker extends HTMLElement {
  connectedCallback() {
    const form = this.closest('form');
    const variantInput = form?.querySelector('input[name="id"]');
    const variantData = this.dataset.variants ? JSON.parse(this.dataset.variants) : [];

    this.querySelectorAll('[data-option]').forEach(btn => {
      btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        this.querySelectorAll(`[data-group="${group}"]`).forEach(s => s.classList.remove('is-active'));
        btn.classList.add('is-active');

        this.#updateVariant(variantInput, variantData);
      });
    });
  }

  #updateVariant(input, variants) {
    if (!input || !variants.length) return;

    const active = [...this.querySelectorAll('[data-option].is-active')];
    const selected = {};
    active.forEach(btn => {
      selected[btn.dataset.group] = btn.dataset.value;
    });

    const match = variants.find(v => {
      return v.options.every((opt, i) => {
        const groupName = `option${i + 1}`;
        return !selected[groupName] || selected[groupName] === opt;
      });
    });

    if (match) {
      input.value = match.id;
      this.#updatePrice(match);
      document.dispatchEvent(new CustomEvent('dlh:pdp-selection-update', { bubbles: true }));

      const productForm = this.closest('product-form-component');
      const productId = productForm?.dataset.productId;
      if (productForm && productId) {
        const emptyDoc = new DOMParser().parseFromString(
          '<!DOCTYPE html><html><body></body></html>',
          'text/html'
        );
        this.dispatchEvent(
          new CustomEvent('variant:update', {
            bubbles: true,
            detail: {
              resource: match,
              sourceId: 'dlh-pdp-variant-picker',
              data: {
                html: emptyDoc,
                productId: String(productId),
              },
            },
          })
        );
      }
    }
  }

  #updatePrice(variant) {
    const section =
      this.closest('.dlh-pv__buy') ||
      this.closest('.shopify-section') ||
      this.closest('[data-section-id]') ||
      this.closest('section');
    if (!section) return;

    const nowEl = section.querySelector('[data-price-now]');

    const currency = this.dataset.currency || 'AED';
    if (nowEl) {
      nowEl.setAttribute('data-unit-price-cents', String(variant.price));
      nowEl.setAttribute('data-compare-at-cents', String(variant.compare_at_price || 0));
      nowEl.dataset.currency = currency;
    }

    const sticky = section.querySelector('sticky-add-to-cart');
    if (sticky) {
      sticky.setAttribute('data-current-variant-id', String(variant.id));
      sticky.setAttribute('data-variant-available', variant.available ? 'true' : 'false');

      const priceWrap = section.querySelector('[data-vehicle-sticky-price]');
      if (priceWrap) {
        priceWrap.dataset.unitPriceCents = String(variant.price || 0);
        priceWrap.dataset.comparePriceCents = String(variant.compare_at_price || 0);
        priceWrap.dataset.currency = currency;
      }

      const vLabel = sticky.querySelector('.sticky-add-to-cart__variant');
      if (vLabel) {
        if (variant.title) {
          vLabel.style.display = '';
          vLabel.textContent = variant.title;
        } else {
          vLabel.style.display = 'none';
        }
      }

      const stickyBtn = sticky.querySelector('[ref="addToCartButton"]');
      if (stickyBtn) {
        stickyBtn.disabled = !variant.available;
      }
    }

    const form = this.closest('form#dlh-pdp-form');
    if (form) {
      dlhPdpSyncLineTotalsForVehicleForm(/** @type {HTMLFormElement} */ (form));
    }
  }
}

if (!customElements.get('dlh-pdp-variant-picker')) {
  customElements.define('dlh-pdp-variant-picker', DlhPdpVariantPicker);
}

/* ============================================================
   Booking ticker
   ============================================================ */
class DlhPdpTicker extends HTMLElement {
  #index = 0;
  #interval = null;

  connectedCallback() {
    const msgs = [...this.querySelectorAll('[data-ticker-msg]')];
    if (msgs.length < 2) return;

    this.#show(0, msgs);
    this.#interval = setInterval(() => {
      this.#index = (this.#index + 1) % msgs.length;
      this.#show(this.#index, msgs);
    }, 4200);
  }

  disconnectedCallback() {
    if (this.#interval) clearInterval(this.#interval);
  }

  #show(i, msgs) {
    msgs.forEach((m, j) => {
      m.style.display = j === i ? '' : 'none';
    });
  }
}

if (!customElements.get('dlh-pdp-ticker')) {
  customElements.define('dlh-pdp-ticker', DlhPdpTicker);
}

class DlhPdpTrustPlacement {
  constructor() {
    this.mediaQuery = window.matchMedia('(max-width: 768px)');
    this.syncAll = this.syncAll.bind(this);
    this.mediaQuery.addEventListener('change', this.syncAll);
    this.syncAll();
  }

  syncAll() {
    document.querySelectorAll('.dlh-pv__grid').forEach((grid) => {
      const trust = grid.querySelector('.dlh-pv__trust');
      const gallery = grid.querySelector('.dlh-pv__gal');
      const left = grid.querySelector('.dlh-pv__left');
      const buy = grid.querySelector('.dlh-pv__buy');
      const head = buy?.querySelector('.dlh-pv__head');
      if (!trust || !gallery || !left || !buy || !head) return;

      if (this.mediaQuery.matches) {
        if (trust.parentElement !== buy) {
          head.insertAdjacentElement('afterend', trust);
        }
      } else if (trust.parentElement !== left) {
        gallery.insertAdjacentElement('afterend', trust);
      }
    });
  }
}

if (!window.__dlhTrustPlacement) {
  window.__dlhTrustPlacement = new DlhPdpTrustPlacement();
}

/* ============================================================
   Toast
   ============================================================ */
class DlhPdpToast extends HTMLElement {
  show(msg) {
    const text = this.querySelector('[data-toast-text]');
    if (text) text.textContent = msg;
    this.classList.add('is-visible');
    setTimeout(() => this.classList.remove('is-visible'), 2600);
  }
}

if (!customElements.get('dlh-pdp-toast')) {
  customElements.define('dlh-pdp-toast', DlhPdpToast);
}

/* Sync headline prices on load (quantity may be 1) */
function dlhPdpInitVehicleFormTotals() {
  const form = document.getElementById('dlh-pdp-form');
  if (form) dlhPdpSyncLineTotalsForVehicleForm(/** @type {HTMLFormElement} */(form));
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', dlhPdpInitVehicleFormTotals);
} else {
  dlhPdpInitVehicleFormTotals();
}
