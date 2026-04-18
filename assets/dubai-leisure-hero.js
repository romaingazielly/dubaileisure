/**
 * Lightweight hero carousel: horizontal scroll + dot controls + optional autoplay.
 * Respects prefers-reduced-motion (no smooth scroll, no autoplay).
 */

/** @returns {boolean} */
function dlhPrefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

class DlhHeroCarousel extends HTMLElement {
  /** @type {HTMLElement | null} */
  #track = null;

  /** @type {HTMLButtonElement[]} */
  #dots = [];

  /** @type {HTMLElement[]} */
  #slides = [];

  /** @type {ReturnType<typeof setInterval> | null} */
  #autoplayTimer = null;

  /** @type {(() => void) | null} */
  #onScroll = null;

  /** @type {boolean} */
  #hydrated = false;

  /** @type {IntersectionObserver | null} */
  #visibilityObserver = null;

  /** @type {number | null} */
  #idleHandle = null;

  connectedCallback() {
    this.#track = this.querySelector('[data-dlh-track]');
    if (!this.#track) return;

    this.#dots = /** @type {HTMLButtonElement[]} */ ([...this.querySelectorAll('.dlh-hero__dot')]);
    this.#slides = /** @type {HTMLElement[]} */ ([...this.querySelectorAll('.dlh-hero__slide')]);

    const hydrate = () => this.#hydrate();

    if ('IntersectionObserver' in window) {
      this.#visibilityObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              hydrate();
              break;
            }
          }
        },
        { rootMargin: '200px' }
      );
      this.#visibilityObserver.observe(this);
    }

    const scheduleIdle =
      /** @type {((cb: () => void, opts?: { timeout?: number }) => number) | undefined} */ (
        /** @type {any} */ (window).requestIdleCallback
      );
    if (typeof scheduleIdle === 'function') {
      this.#idleHandle = scheduleIdle(hydrate, { timeout: 2000 });
    } else {
      this.#idleHandle = window.setTimeout(hydrate, 1500);
    }
  }

  #hydrate() {
    if (this.#hydrated) return;
    const track = this.#track;
    if (!track) return;
    this.#hydrated = true;

    if (this.#visibilityObserver) {
      this.#visibilityObserver.disconnect();
      this.#visibilityObserver = null;
    }
    if (this.#idleHandle !== null) {
      const cancelIdle = /** @type {((id: number) => void) | undefined} */ (
        /** @type {any} */ (window).cancelIdleCallback
      );
      if (typeof cancelIdle === 'function') {
        cancelIdle(this.#idleHandle);
      } else {
        window.clearTimeout(this.#idleHandle);
      }
      this.#idleHandle = null;
    }

    this.#dots.forEach((dot, index) => {
      dot?.addEventListener('click', () => this.#goTo(index));
    });

    this.#onScroll = () => this.#syncDots();
    track.addEventListener('scroll', this.#onScroll, { passive: true });

    const sec = Number.parseInt(this.dataset.autoplaySeconds || '0', 10);
    if (sec > 0 && this.#slides.length > 1 && !dlhPrefersReducedMotion()) {
      this.#autoplayTimer = window.setInterval(() => this.#next(), sec * 1000);
    }

    this.addEventListener('mouseenter', this.#pauseAutoplay);
    this.addEventListener('mouseleave', this.#resumeAutoplay);
    this.addEventListener('focusin', this.#pauseAutoplay);
    this.addEventListener('focusout', this.#resumeAutoplay);
  }

  disconnectedCallback() {
    if (this.#visibilityObserver) {
      this.#visibilityObserver.disconnect();
      this.#visibilityObserver = null;
    }
    if (this.#idleHandle !== null) {
      const cancelIdle = /** @type {((id: number) => void) | undefined} */ (
        /** @type {any} */ (window).cancelIdleCallback
      );
      if (typeof cancelIdle === 'function') {
        cancelIdle(this.#idleHandle);
      } else {
        window.clearTimeout(this.#idleHandle);
      }
      this.#idleHandle = null;
    }
    if (this.#track && this.#onScroll) {
      this.#track.removeEventListener('scroll', this.#onScroll);
    }
    if (this.#autoplayTimer) {
      window.clearInterval(this.#autoplayTimer);
      this.#autoplayTimer = null;
    }
    this.removeEventListener('mouseenter', this.#pauseAutoplay);
    this.removeEventListener('mouseleave', this.#resumeAutoplay);
    this.removeEventListener('focusin', this.#pauseAutoplay);
    this.removeEventListener('focusout', this.#resumeAutoplay);
  }

  #paused = false;

  #pauseAutoplay = () => {
    this.#paused = true;
  };

  #resumeAutoplay = () => {
    this.#paused = false;
  };

  /** @param {number} index */
  #goTo(index) {
    const slide = this.#slides[index];
    const track = this.#track;
    if (!slide || !track) return;
    const behavior = dlhPrefersReducedMotion() ? 'auto' : 'smooth';
    track.scrollTo({ left: slide.offsetLeft, behavior });
    this.#setActiveDot(index);
  }

  #next() {
    if (this.#paused) return;
    const track = this.#track;
    if (!track || this.#slides.length < 2) return;
    const w = track.clientWidth || 1;
    const i = Math.round(track.scrollLeft / w);
    const next = (i + 1) % this.#slides.length;
    this.#goTo(next);
  }

  #syncDots() {
    const track = this.#track;
    if (!track || this.#dots.length === 0) return;
    const w = track.clientWidth || 1;
    const i = Math.min(Math.round(track.scrollLeft / w), this.#dots.length - 1);
    this.#setActiveDot(Math.max(0, i));
  }

  /** @param {number} activeIndex */
  #setActiveDot(activeIndex) {
    for (let i = 0; i < this.#dots.length; i++) {
      const dot = this.#dots[i];
      const on = i === activeIndex;
      if (!dot) continue;
      dot.setAttribute('aria-selected', on ? 'true' : 'false');
      dot.tabIndex = on ? 0 : -1;
    }
  }
}

if (!customElements.get('dlh-hero-carousel')) {
  customElements.define('dlh-hero-carousel', DlhHeroCarousel);
}
