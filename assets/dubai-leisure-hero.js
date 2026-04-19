/**
 * Lightweight hero carousel: horizontal scroll + dot controls + optional autoplay.
 * Autoplay advances when the active indicator's fill animation completes (CSS keyframes).
 * Infinite loop: clone of last slide prepended, clone of first appended; seamless wrap via instant reposition.
 * Respects prefers-reduced-motion (no smooth scroll, no autoplay / full bar only).
 */

/** @returns {boolean} */
function dlhPrefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** @param {HTMLElement} el */
function dlhStripCloneNode(el) {
  el.removeAttribute('id');
  el.removeAttribute('data-dlh-prime');
  el.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  el.querySelectorAll('*').forEach((node) => {
    const shopifyAttrs = [...node.attributes]
      .filter((attr) => attr.name.startsWith('data-shopify'))
      .map((attr) => attr.name);
    for (const name of shopifyAttrs) node.removeAttribute(name);
  });
  el.setAttribute('aria-hidden', 'true');
  if ('inert' in el) {
    /** @type {HTMLElement & { inert?: boolean }} */ (el).inert = true;
  }
}

class DlhHeroCarousel extends HTMLElement {
  /** @type {HTMLElement | null} */
  #track = null;

  /** @type {HTMLButtonElement[]} */
  #dots = [];

  /** @type {HTMLElement[]} */
  #slides = [];

  /** @type {boolean} */
  #infinite = false;

  /** @type {boolean} */
  #jumping = false;

  /** @type {number} */
  #jumpLockTimer = 0;

  /** @type {(() => void) | null} */
  #onScroll = null;

  /** @type {(() => void) | null} */
  #onScrollEnd = null;

  /** @type {number} */
  #scrollSettleTimer = 0;

  /** @type {boolean} */
  #hydrated = false;

  /** @type {IntersectionObserver | null} */
  #visibilityObserver = null;

  /** @type {number | null} */
  #idleHandle = null;

  /** @type {boolean} */
  #autoplayEnabled = false;

  /** @type {number | null} */
  #programmaticTarget = null;

  /** @type {number} */
  #activeDotIndex = -1;

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

    const slides = /** @type {HTMLElement[]} */ ([...track.querySelectorAll('.dlh-hero__slide')]);
    this.#infinite = false;

    if (slides.length >= 2) {
      const first = slides[0];
      const last = slides[slides.length - 1];
      const cloneBefore = /** @type {HTMLElement} */ (last.cloneNode(true));
      const cloneAfter = /** @type {HTMLElement} */ (first.cloneNode(true));
      dlhStripCloneNode(cloneBefore);
      dlhStripCloneNode(cloneAfter);
      cloneBefore.setAttribute('data-dlh-clone', 'before');
      cloneAfter.setAttribute('data-dlh-clone', 'after');
      track.insertBefore(cloneBefore, first);
      track.appendChild(cloneAfter);
      this.#slides = /** @type {HTMLElement[]} */ ([...track.querySelectorAll('.dlh-hero__slide')]);
      this.#infinite = true;
      this.setAttribute('data-dlh-infinite', '');

      const firstReal = this.#slides[1];
      if (firstReal) {
        void track.offsetWidth;
        track.scrollTo({ left: firstReal.offsetLeft, behavior: 'auto' });
      }
    } else {
      this.#slides = slides;
    }

    const sec = Number.parseInt(this.dataset.autoplaySeconds || '0', 10);
    this.style.setProperty('--dlh-autoplay-duration', `${Math.max(0, sec)}s`);
    if (sec <= 0) {
      this.setAttribute('data-autoplay-off', '');
    } else {
      this.removeAttribute('data-autoplay-off');
    }

    this.#autoplayEnabled = sec > 0 && this.#dots.length > 1 && !dlhPrefersReducedMotion();

    const initialDot = this.#dots.findIndex((d) => d.getAttribute('aria-selected') === 'true');
    this.#activeDotIndex = initialDot >= 0 ? initialDot : 0;

    this.#dots.forEach((dot, index) => {
      dot?.addEventListener('click', () => this.#goTo(index));
    });

    this.#onScroll = () => {
      this.#syncDots();
      if (!('onscrollend' in window)) {
        window.clearTimeout(this.#scrollSettleTimer);
        this.#scrollSettleTimer = window.setTimeout(() => {
          const jumped = this.#maybeJumpCloneEdges();
          this.#programmaticTarget = null;
          if (!jumped) this.#syncDots();
        }, 100);
      }
    };
    track.addEventListener('scroll', this.#onScroll, { passive: true });

    this.#onScrollEnd = () => {
      const jumped = this.#maybeJumpCloneEdges();
      this.#programmaticTarget = null;
      if (!jumped) this.#syncDots();
    };
    if ('onscrollend' in window) {
      track.addEventListener('scrollend', this.#onScrollEnd, { passive: true });
    }

    if (this.#autoplayEnabled) {
      this.addEventListener('animationend', this.#onDotFillEnd);
      this.#restartFillAnimation();
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
    window.clearTimeout(this.#scrollSettleTimer);
    window.clearTimeout(this.#jumpLockTimer);
    if (this.#track && this.#onScroll) {
      this.#track.removeEventListener('scroll', this.#onScroll);
    }
    if (this.#track && this.#onScrollEnd) {
      this.#track.removeEventListener('scrollend', this.#onScrollEnd);
    }
    this.removeEventListener('animationend', this.#onDotFillEnd);
    this.removeEventListener('mouseenter', this.#pauseAutoplay);
    this.removeEventListener('mouseleave', this.#resumeAutoplay);
    this.removeEventListener('focusin', this.#pauseAutoplay);
    this.removeEventListener('focusout', this.#resumeAutoplay);
  }

  #paused = false;

  #pauseAutoplay = () => {
    this.#paused = true;
    this.classList.add('dlh-hero-carousel--autoplay-paused');
  };

  #resumeAutoplay = () => {
    this.#paused = false;
    this.classList.remove('dlh-hero-carousel--autoplay-paused');
  };

  /**
   * Snap target = slide whose offsetLeft is closest to scrollLeft (same width slides).
   * On ties, prefer the higher index so mid-scroll between clone-before and first real maps to first real, not last slide.
   * @returns {number} index into this.#slides
   */
  #slideIndexFromScroll() {
    const track = this.#track;
    if (!track || this.#slides.length === 0) return 0;
    const sl = track.scrollLeft;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.#slides.length; i++) {
      const left = this.#slides[i].offsetLeft;
      const d = Math.abs(left - sl);
      if (d < bestDist - 1e-3) {
        bestDist = d;
        best = i;
      } else if (Math.abs(d - bestDist) < 1e-3 && i > best) {
        best = i;
      }
    }
    return best;
  }

  /** Reposition without CSS smooth scroll (avoids wrong #slideIndexFromScroll during animation). */
  #instantScrollTo(left) {
    const track = this.#track;
    if (!track) return;
    track.classList.add('dlh-hero__track--instant-scroll');
    void track.offsetWidth;
    track.scrollTo({ left, behavior: 'auto' });
    window.setTimeout(() => {
      track.classList.remove('dlh-hero__track--instant-scroll');
    }, 200);
  }

  /** Blocks dot sync while scroll settles after clone jump (smooth CSS was fighting instant jump). */
  #beginJumpLock() {
    window.clearTimeout(this.#jumpLockTimer);
    this.#jumping = true;
    this.#jumpLockTimer = window.setTimeout(() => {
      this.#jumpLockTimer = 0;
      this.#jumping = false;
      this.#syncDots();
    }, 220);
  }

  /**
   * @param {number} domSlideIndex index into this.#slides
   * @returns {number} real slide index for dots (0 .. dots-1)
   */
  #domSlideToRealIndex(domSlideIndex) {
    const n = this.#dots.length;
    const slide = this.#slides[domSlideIndex];
    if (!slide) return 0;
    const clone = slide.getAttribute('data-dlh-clone');
    if (clone === 'before') return n - 1;
    if (clone === 'after') return 0;
    return domSlideIndex - 1;
  }

  /**
   * When scroll stops on a clone, jump to the equivalent real slide without animation.
   * Uses data-dlh-clone on the slide under the viewport center — not scrollLeft / width.
   * @returns {boolean} true if a jump was applied
   */
  #maybeJumpCloneEdges() {
    if (!this.#infinite || !this.#track) return false;
    const n = this.#dots.length;
    if (n < 2) return false;
    const track = this.#track;
    const domIndex = this.#slideIndexFromScroll();
    const slide = this.#slides[domIndex];
    const clone = slide?.getAttribute('data-dlh-clone');

    if (clone === 'after') {
      const firstReal = this.#slides[1];
      if (!firstReal) return false;
      this.#beginJumpLock();
      this.#instantScrollTo(firstReal.offsetLeft);
      return true;
    }
    if (clone === 'before') {
      const lastReal = this.#slides[n];
      if (!lastReal) return false;
      this.#beginJumpLock();
      this.#instantScrollTo(lastReal.offsetLeft);
      return true;
    }
    return false;
  }

  /** @param {AnimationEvent} e */
  #onDotFillEnd = (e) => {
    if (!(e.target instanceof HTMLElement)) return;
    if (!e.target.classList.contains('dlh-hero__dot-progress')) return;
    if (e.animationName !== 'dlh-dot-fill') return;
    if (!this.#autoplayEnabled || this.#paused) return;

    const dot = e.target.closest('.dlh-hero__dot');
    const idx = this.#dots.indexOf(/** @type {HTMLButtonElement} */ (dot));
    if (idx !== this.#activeDotIndex) return;

    this.#next();
  };

  /** @param {number} index Real slide index (0 .. dots-1) */
  #goTo(index) {
    const track = this.#track;
    if (!track || this.#dots.length === 0) return;
    const slide = this.#infinite ? this.#slides[index + 1] : this.#slides[index];
    if (!slide) return;
    this.#programmaticTarget = index;
    const behavior = dlhPrefersReducedMotion() ? 'auto' : 'smooth';
    track.scrollTo({ left: slide.offsetLeft, behavior });
    this.#setActiveDot(index);
  }

  #next() {
    if (this.#paused) return;
    const n = this.#dots.length;
    if (n < 2) return;
    const track = this.#track;
    if (!track) return;
    const next = (this.#activeDotIndex + 1) % n;

    if (this.#infinite && this.#activeDotIndex === n - 1 && next === 0) {
      const cloneAfter = this.#slides[n + 1];
      if (!cloneAfter) return;
      this.#programmaticTarget = 0;
      const behavior = dlhPrefersReducedMotion() ? 'auto' : 'smooth';
      track.scrollTo({ left: cloneAfter.offsetLeft, behavior });
      this.#setActiveDot(0);
      return;
    }

    this.#goTo(next);
  }

  #syncDots() {
    if (this.#jumping) return;
    const track = this.#track;
    if (!track || this.#dots.length === 0) return;
    const n = this.#dots.length;

    let idx;
    if (this.#infinite && n > 1) {
      const domIndex = this.#slideIndexFromScroll();
      idx = this.#domSlideToRealIndex(domIndex);
    } else {
      const domIndex = this.#slideIndexFromScroll();
      idx = Math.max(0, Math.min(domIndex, n - 1));
    }

    if (this.#programmaticTarget !== null && idx !== this.#programmaticTarget) {
      return;
    }
    if (this.#programmaticTarget !== null && idx === this.#programmaticTarget) {
      this.#programmaticTarget = null;
    }

    this.#setActiveDot(idx);
  }

  /** @param {number} activeIndex */
  #setActiveDot(activeIndex) {
    const prev = this.#activeDotIndex;
    this.#activeDotIndex = activeIndex;

    for (let i = 0; i < this.#dots.length; i++) {
      const dot = this.#dots[i];
      const on = i === activeIndex;
      if (!dot) continue;
      dot.setAttribute('aria-selected', on ? 'true' : 'false');
      dot.tabIndex = on ? 0 : -1;
    }

    if (prev !== activeIndex && this.#autoplayEnabled) {
      this.#restartFillAnimation();
    }
  }

  #restartFillAnimation() {
    const dot = this.#dots[this.#activeDotIndex];
    if (!dot) return;
    const progress = dot.querySelector('.dlh-hero__dot-progress');
    if (!(progress instanceof HTMLElement)) return;
    progress.style.animation = 'none';
    void progress.offsetWidth;
    progress.style.animation = '';
  }
}

if (!customElements.get('dlh-hero-carousel')) {
  customElements.define('dlh-hero-carousel', DlhHeroCarousel);
}
