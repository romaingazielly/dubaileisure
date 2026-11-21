/* Safari PDP booking card: date + guests per variant, live total, multi-line add to cart. */
/* Date picker. Every instance (booking card, sticky bar) shares the same selected date. */
class DlhSafariDate extends HTMLElement {
  static selected = null;

  connectedCallback() {
    const now = new Date();
    this.month = now.getMonth();
    this.year = now.getFullYear();
    this.popup = this.querySelector('[data-cal-popup]');

    this.querySelector('[data-cal-trigger]').addEventListener('click', () => this.toggle());
    this.querySelector('[data-cal-prev]').addEventListener('click', () => this.shift(-1));
    this.querySelector('[data-cal-next]').addEventListener('click', () => this.shift(1));
    this.querySelector('[data-cal-days]').addEventListener('click', (event) => {
      const day = event.target.closest('[data-day]');
      if (day) this.select(new Date(this.year, this.month, Number(day.dataset.day)));
    });
    document.addEventListener('click', (event) => {
      if (!event.composedPath().includes(this)) this.toggle(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.toggle(false);
    });
    document.addEventListener('dlh:safari-date', () => this.sync());
    this.render();
  }

  toggle(open = !this.popup.classList.contains('is-open')) {
    this.popup.classList.toggle('is-open', open);
  }

  shift(delta) {
    const target = new Date(this.year, this.month + delta, 1);
    this.month = target.getMonth();
    this.year = target.getFullYear();
    this.render();
  }

  select(date) {
    DlhSafariDate.selected = date;
    this.toggle(false);
    document.dispatchEvent(new CustomEvent('dlh:safari-date', { detail: { date } }));
  }

  sync() {
    const date = DlhSafariDate.selected;
    const label = this.querySelector('[data-date-label]');
    label.textContent = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    label.classList.remove('dlh-pv__date-txt--placeholder');
    this.classList.add('is-filled');
    this.month = date.getMonth();
    this.year = date.getFullYear();
    this.render();
  }

  render() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = DlhSafariDate.selected?.getTime();
    const offset = new Date(this.year, this.month, 1).getDay();
    const days = new Date(this.year, this.month + 1, 0).getDate();
    const blank = '<span class="dlh-pv__cal-day dlh-pv__cal-day--other"></span>';
    let html = blank.repeat(offset);

    for (let day = 1; day <= days; day++) {
      const date = new Date(this.year, this.month, day);
      const classes = ['dlh-pv__cal-day'];
      if (date.getTime() === today.getTime()) classes.push('dlh-pv__cal-day--today');
      if (date.getTime() === selected) classes.push('is-active');
      html += `<button type="button" class="${classes.join(' ')}" ${date < today ? 'disabled' : ''} data-day="${day}">${day}</button>`;
    }

    this.querySelector('[data-cal-days]').innerHTML = html;
    this.querySelector('[data-cal-month-title]').textContent = new Date(this.year, this.month).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    this.querySelector('[data-cal-prev]').disabled = this.year === today.getFullYear() && this.month === today.getMonth();
  }
}

if (!customElements.get('dlh-safari-date')) {
  customElements.define('dlh-safari-date', DlhSafariDate);
}

class DlhSafariBooking extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('[data-booking-form]');
    this.guests = [...this.querySelectorAll('[data-guest]')];
    this.upsells = [...this.querySelectorAll('[data-upsell]')];
    this.upsellField = this.querySelector('[data-upsell-field]');
    this.maxGuests = Number(this.dataset.maxGuests) || 20;
    this.bar = this.closest('.shopify-section')?.querySelector('[data-booking-bar]');

    [...this.guests, ...this.upsells].forEach((row) => {
      row.querySelectorAll('[data-step]').forEach((button) => {
        button.addEventListener('click', () => this.step(row, Number(button.dataset.step)));
      });
    });
    this.form.addEventListener('submit', (event) => this.submit(event));
    document.addEventListener('dlh:safari-date', (event) => {
      this.form.querySelector('input[name="properties[Date]"]').value = event.detail.date.toLocaleDateString('en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      this.toggleError('[data-date-error]', false);
      this.update();
    });

    if (this.bar) this.setupBar();
    this.update();
  }

  get totalGuests() {
    return this.guests.reduce((sum, row) => sum + this.qty(row), 0);
  }

  qty(row) {
    return Number(row.querySelector('[data-qty]').textContent) || 0;
  }

  get date() {
    return this.form.querySelector('input[name="properties[Date]"]').value;
  }

  /* Upsells only count once a date and at least one guest are picked (the moment they are shown). */
  get upsellsReady() {
    return this.upsells.length > 0 && Boolean(this.date) && this.totalGuests > 0;
  }

  get selectedUpsells() {
    return this.upsellsReady ? this.upsells.filter((row) => this.qty(row) > 0) : [];
  }

  step(row, delta) {
    const isUpsell = row.hasAttribute('data-upsell');
    if (delta > 0) {
      if (isUpsell && this.qty(row) >= Number(row.dataset.max || 10)) return;
      if (!isUpsell && this.totalGuests >= this.maxGuests) return;
    }
    row.querySelector('[data-qty]').textContent = String(Math.max(0, this.qty(row) + delta));
    if (!isUpsell) this.toggleError('[data-guests-error]', false);
    this.update();
  }

  money(cents) {
    const format = this.dataset.moneyFormat || '{{amount}}';
    const group = (value, separator) => value.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    const [whole, decimals] = (cents / 100).toFixed(2).split('.');
    const values = {
      amount: `${group(whole, ',')}.${decimals}`,
      amount_no_decimals: group(String(Math.round(cents / 100)), ','),
      amount_with_comma_separator: `${group(whole, '.')},${decimals}`,
      amount_no_decimals_with_comma_separator: group(String(Math.round(cents / 100)), '.'),
    };
    return format.replace(/\{\{\s*(\w+)\s*\}\}/, (match, key) => values[key] ?? values.amount);
  }

  update() {
    const lineTotal = (rows) => rows.reduce((sum, row) => sum + this.qty(row) * Number(row.dataset.price), 0);
    const count = this.totalGuests;
    const upsells = this.selectedUpsells;
    const extras = upsells.reduce((sum, row) => sum + this.qty(row), 0);
    const total = lineTotal(this.guests) + lineTotal(upsells);
    const detail = [
      count ? `${count} ${count === 1 ? 'guest' : 'guests'}` : '',
      extras ? `${extras} ${extras === 1 ? 'extra' : 'extras'}` : '',
    ].filter(Boolean).join(' · ');

    this.guests.forEach((row) => {
      row.querySelector('[data-step="-1"]').disabled = this.qty(row) === 0;
      row.querySelector('[data-step="1"]').disabled = row.hasAttribute('data-unavailable') || count >= this.maxGuests;
    });
    this.upsells.forEach((row) => {
      row.querySelector('[data-step="-1"]').disabled = this.qty(row) === 0;
      row.querySelector('[data-step="1"]').disabled = this.qty(row) >= Number(row.dataset.max || 10);
      row.classList.toggle('is-active', this.qty(row) > 0);
    });
    if (this.upsellField) this.upsellField.hidden = !this.upsellsReady;
    this.querySelector('[data-total]').textContent = this.money(total);
    this.querySelector('[data-total-detail]').textContent = detail;
    if (this.bar) {
      this.bar.querySelector('[data-bar-total]').textContent = this.money(total);
      this.bar.querySelector('[data-bar-detail]').textContent = detail;
    }
  }

  toggleError(selector, show, message) {
    const element = this.querySelector(selector);
    if (!element) return;
    if (message) element.textContent = message;
    element.hidden = !show;
  }

  async submit(event) {
    event.preventDefault();
    const action = event.submitter?.dataset.action || 'checkout';
    const date = this.date;
    const lines = this.guests.filter((row) => this.qty(row) > 0);
    const upsells = this.selectedUpsells;

    this.toggleError('[data-date-error]', !date);
    this.toggleError('[data-guests-error]', lines.length === 0);
    this.toggleError('[data-form-error]', false);
    if (!date) {
      this.querySelector('dlh-safari-date').toggle(true);
      this.querySelector('[data-cal-trigger]').focus();
    }
    if (!date || lines.length === 0) return;

    const buttons = [...this.form.querySelectorAll('button[type="submit"]')];
    buttons.forEach((button) => (button.disabled = true));
    try {
      const response = await fetch(this.dataset.cartAddUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          items: [
            ...lines.map((row) => ({
              id: Number(row.dataset.variantId),
              quantity: this.qty(row),
              properties: { Date: date },
            })),
            ...upsells.map((row) => ({
              id: Number(row.dataset.variantId),
              quantity: this.qty(row),
              properties: { Date: date, 'Booked with': this.dataset.productTitle },
            })),
          ],
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.description || result.message || 'Booking failed');
      window.location.href = action === 'cart' ? this.dataset.cartUrl : '/checkout';
    } catch (error) {
      this.toggleError('[data-form-error]', true, `${error.message}. Please try again or contact us.`);
      buttons.forEach((button) => (button.disabled = false));
    }
  }

  /* Sticky bar: visible while the booking buttons are off screen. Date is picked in the bar itself. */
  setupBar() {
    new IntersectionObserver(([entry]) => {
      this.bar.hidden = entry.isIntersecting;
    }).observe(this.querySelector('.dlh-ps__ctas'));
    this.bar.querySelector('[data-bar-cta]').addEventListener('click', (event) => {
      const date = this.form.querySelector('input[name="properties[Date]"]').value;
      if (!date) {
        event.stopPropagation();
        this.bar.querySelector('dlh-safari-date').toggle(true);
      } else if (this.totalGuests === 0) {
        this.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        this.form.requestSubmit(this.form.querySelector('[data-action="checkout"]'));
      }
    });
  }
}

if (!customElements.get('dlh-safari-booking')) {
  customElements.define('dlh-safari-booking', DlhSafariBooking);
}
