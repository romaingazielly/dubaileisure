class DatePickerComponent extends HTMLElement {
  constructor() {
    super();
    this._onDocClick = this._onDocClick.bind(this);
    this._onKeydown = this._onKeydown.bind(this);
    this._onSubmitCapture = this._onSubmitCapture.bind(this);
  }

  connectedCallback() {
    this.triggerEl = this.querySelector('[data-ref="trigger"]');
    this.triggerTextEl = this.querySelector('[data-ref="trigger-text"]');
    this.popoverEl = this.querySelector('[data-ref="popover"]');
    this.gridEl = this.querySelector('[data-ref="grid"]');
    this.weekdaysEl = this.querySelector('[data-ref="weekdays"]');
    this.monthLabelEl = this.querySelector('[data-ref="month-label"]');
    this.prevBtn = this.querySelector('[data-ref="prev"]');
    this.nextBtn = this.querySelector('[data-ref="next"]');
    this.errorEl = this.querySelector('[data-ref="error"]');
    this.inputEl = this.querySelector('[data-ref="input"]');

    this.locale = this.dataset.locale || document.documentElement.lang || 'en';
    this.required = this.dataset.required === 'true';
    this.placeholder = this.dataset.placeholder || 'Select a date';

    const today = this._startOfDay(new Date());
    const leadDays = parseInt(this.dataset.leadDays, 10);
    const windowDays = parseInt(this.dataset.windowDays, 10);
    this.minDate = this._addDays(today, Number.isFinite(leadDays) ? leadDays : 1);
    this.maxDate = this._addDays(today, Number.isFinite(windowDays) ? windowDays : 365);

    this.selectedDate = null;
    this.viewYear = this.minDate.getFullYear();
    this.viewMonth = this.minDate.getMonth();
    this.isOpen = false;

    this.classList.add('date-picker--empty');

    this._renderWeekdays();
    this._renderMonth();

    this.triggerEl.addEventListener('click', () => this._toggle());
    this.prevBtn.addEventListener('click', () => this._shiftMonth(-1));
    this.nextBtn.addEventListener('click', () => this._shiftMonth(1));
    this.gridEl.addEventListener('click', (event) => this._onGridClick(event));
    this.gridEl.addEventListener('keydown', (event) => this._onGridKeydown(event));

    this._attachToProductForm();

    document.addEventListener('click', this._onDocClick);
    document.addEventListener('keydown', this._onKeydown);
    document.addEventListener('submit', this._onSubmitCapture, { capture: true });
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onKeydown);
    document.removeEventListener('submit', this._onSubmitCapture, { capture: true });
  }

  _attachToProductForm() {
    const form = this._findProductForm();
    if (!form || !this.inputEl) return;
    this._productForm = form;
    if (this.inputEl.parentElement !== form) {
      form.appendChild(this.inputEl);
    }
  }

  _findProductForm() {
    const section = this.closest('.shopify-section') || document;
    return (
      section.querySelector('form[action*="/cart/add"]') ||
      document.querySelector('form[action*="/cart/add"]')
    );
  }

  _onSubmitCapture(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.action || !form.action.includes('/cart/add')) return;

    this._productForm = form;
    if (this.inputEl && this.inputEl.parentElement !== form) {
      form.appendChild(this.inputEl);
    }

    if (!this.required) return;
    if (this.inputEl && this.inputEl.value) return;
    event.preventDefault();
    event.stopPropagation();
    this.errorEl.hidden = false;
    this.triggerEl.focus({ preventScroll: false });
    this._open();
  }

  _onDocClick(event) {
    if (!this.isOpen) return;
    if (this.contains(event.target)) return;
    this._close();
  }

  _onKeydown(event) {
    if (event.key === 'Escape' && this.isOpen) {
      this._close();
      this.triggerEl.focus();
    }
  }

  _toggle() {
    if (this.isOpen) this._close();
    else this._open();
  }

  _open() {
    if (this.isOpen) return;
    if (this.selectedDate) {
      this.viewYear = this.selectedDate.getFullYear();
      this.viewMonth = this.selectedDate.getMonth();
    } else {
      this.viewYear = this.minDate.getFullYear();
      this.viewMonth = this.minDate.getMonth();
    }
    this._renderMonth();
    this.popoverEl.hidden = false;
    this.triggerEl.setAttribute('aria-expanded', 'true');
    this.isOpen = true;
    const focusTarget =
      this.gridEl.querySelector('.date-picker__day--selected:not(:disabled)') ||
      this.gridEl.querySelector('.date-picker__day:not(:disabled):not(.date-picker__day--filler)');
    if (focusTarget) focusTarget.focus({ preventScroll: true });
  }

  _close() {
    if (!this.isOpen) return;
    this.popoverEl.hidden = true;
    this.triggerEl.setAttribute('aria-expanded', 'false');
    this.isOpen = false;
  }

  _shiftMonth(delta) {
    const next = new Date(this.viewYear, this.viewMonth + delta, 1);
    if (next < new Date(this.minDate.getFullYear(), this.minDate.getMonth(), 1)) return;
    if (next > new Date(this.maxDate.getFullYear(), this.maxDate.getMonth(), 1)) return;
    this.viewYear = next.getFullYear();
    this.viewMonth = next.getMonth();
    this._renderMonth();
  }

  _renderWeekdays() {
    const base = new Date(2024, 0, 1);
    while (base.getDay() !== 1) base.setDate(base.getDate() + 1);
    const fmt = new Intl.DateTimeFormat(this.locale, { weekday: 'short' });
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 7; i += 1) {
      const day = new Date(base);
      day.setDate(base.getDate() + i);
      const span = document.createElement('span');
      span.className = 'date-picker__weekday';
      span.textContent = fmt.format(day);
      frag.appendChild(span);
    }
    this.weekdaysEl.replaceChildren(frag);
  }

  _renderMonth() {
    const year = this.viewYear;
    const month = this.viewMonth;
    const labelFmt = new Intl.DateTimeFormat(this.locale, { month: 'long', year: 'numeric' });
    this.monthLabelEl.textContent = labelFmt.format(new Date(year, month, 1));

    this.prevBtn.disabled = new Date(year, month, 1) <= new Date(this.minDate.getFullYear(), this.minDate.getMonth(), 1);
    this.nextBtn.disabled = new Date(year, month, 1) >= new Date(this.maxDate.getFullYear(), this.maxDate.getMonth(), 1);

    const firstOfMonth = new Date(year, month, 1);
    const dayOfWeek = firstOfMonth.getDay();
    const mondayOffset = (dayOfWeek + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = this._startOfDay(new Date());

    const frag = document.createDocumentFragment();

    for (let i = 0; i < mondayOffset; i += 1) {
      const filler = document.createElement('span');
      filler.className = 'date-picker__day date-picker__day--filler';
      filler.setAttribute('aria-hidden', 'true');
      frag.appendChild(filler);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'date-picker__day';
      btn.textContent = String(day);
      btn.dataset.iso = this._toISO(date);

      const isOutOfRange = date < this.minDate || date > this.maxDate;
      if (isOutOfRange) {
        btn.disabled = true;
        btn.classList.add('date-picker__day--outside');
      }
      if (this._isSameDay(date, today)) btn.classList.add('date-picker__day--today');
      if (this.selectedDate && this._isSameDay(date, this.selectedDate)) {
        btn.classList.add('date-picker__day--selected');
        btn.setAttribute('aria-pressed', 'true');
      }

      const a11yFmt = new Intl.DateTimeFormat(this.locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      btn.setAttribute('aria-label', a11yFmt.format(date));

      frag.appendChild(btn);
    }

    this.gridEl.replaceChildren(frag);
  }

  _onGridClick(event) {
    const btn = event.target.closest('.date-picker__day');
    if (!btn || btn.disabled || btn.classList.contains('date-picker__day--filler')) return;
    this._selectISO(btn.dataset.iso);
  }

  _onGridKeydown(event) {
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(key)) return;
    const active = document.activeElement;
    if (!active || !active.classList.contains('date-picker__day')) return;

    if (key === 'Enter' || key === ' ') {
      event.preventDefault();
      if (!active.disabled && !active.classList.contains('date-picker__day--filler')) {
        this._selectISO(active.dataset.iso);
      }
      return;
    }

    event.preventDefault();
    const iso = active.dataset.iso;
    if (!iso) return;
    const current = this._fromISO(iso);
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[key];
    const target = this._addDays(current, delta);
    if (target < this.minDate || target > this.maxDate) return;
    const needsRerender =
      target.getFullYear() !== this.viewYear || target.getMonth() !== this.viewMonth;
    if (needsRerender) {
      this.viewYear = target.getFullYear();
      this.viewMonth = target.getMonth();
      this._renderMonth();
    }
    const next = this.gridEl.querySelector(`[data-iso="${this._toISO(target)}"]`);
    if (next) next.focus({ preventScroll: true });
  }

  _selectISO(iso) {
    if (!iso) return;
    const date = this._fromISO(iso);
    this.selectedDate = date;
    if (this.inputEl) this.inputEl.value = this._formatValue(date);
    this.triggerTextEl.textContent = this._formatDisplay(date);
    this.classList.remove('date-picker--empty');
    this.errorEl.hidden = true;
    this._renderMonth();
    this._close();
    this.triggerEl.focus();
    this.dispatchEvent(new CustomEvent('date-picker:change', { detail: { date, iso } }));
  }

  _formatValue(date) {
    return new Intl.DateTimeFormat(this.locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  _formatDisplay(date) {
    return this._formatValue(date);
  }

  _startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  _addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return this._startOfDay(d);
  }

  _isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  _toISO(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  _fromISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}

if (!customElements.get('date-picker-component')) {
  customElements.define('date-picker-component', DatePickerComponent);
}
