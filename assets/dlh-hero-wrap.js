/**
 * DLH Hero Video — lazy-loads the video when visible, hides fallback image
 * when video is ready to play. Respects prefers-reduced-motion.
 */
class DlhHeroVideo extends HTMLElement {
  /** @type {HTMLVideoElement | null} */
  #video = null;

  /** @type {IntersectionObserver | null} */
  #observer = null;

  /** @type {boolean} */
  #started = false;

  connectedCallback() {
    this.#video = this.querySelector('video');
    if (!this.#video) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.#video.pause();
      this.#showFallback();
      return;
    }

    this.#video.addEventListener('canplay', () => this.#onReady(), { once: true });
    this.#video.addEventListener('playing', () => this.#onReady(), { once: true });

    if (this.dataset.autoplay === 'true') {
      this.#lazyAutoplay();
    }
  }

  disconnectedCallback() {
    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
  }

  #lazyAutoplay() {
    if (!('IntersectionObserver' in window)) {
      this.#tryPlay();
      return;
    }

    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !this.#started) {
            this.#tryPlay();
            break;
          }
        }
      },
      { rootMargin: '200px' }
    );
    this.#observer.observe(this);
  }

  #tryPlay() {
    if (!this.#video || this.#started) return;
    this.#started = true;

    const playPromise = this.#video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        this.#showFallback();
      });
    }

    if (this.#observer) {
      this.#observer.disconnect();
      this.#observer = null;
    }
  }

  #onReady() {
    this.#hideFallback();
  }

  #hideFallback() {
    const fallback = this.closest('.dlh-hero-wrap')?.querySelector('.dlh-hero-wrap__picture--fallback');
    if (fallback instanceof HTMLElement) {
      fallback.style.opacity = '0';
      fallback.style.transition = 'opacity 0.6s ease';
    }
  }

  #showFallback() {
    const fallback = this.closest('.dlh-hero-wrap')?.querySelector('.dlh-hero-wrap__picture--fallback');
    if (fallback instanceof HTMLElement) {
      fallback.style.opacity = '1';
    }
  }
}

if (!customElements.get('dlh-hero-video')) {
  customElements.define('dlh-hero-video', DlhHeroVideo);
}
