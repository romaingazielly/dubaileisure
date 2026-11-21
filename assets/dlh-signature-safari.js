/* Signature safari spotlight: scene tabs that swap the photo, shift the sky and move the sun along its arc.
   Scenes advance on their own while the section is on screen (the active tab's progress bar drives it),
   pause on hover or focus, and stop for good once the visitor picks a scene. No autoplay with reduced motion. */
class DlhSignatureSafari extends HTMLElement {
  connectedCallback() {
    this.tabs = [...this.querySelectorAll('[role="tab"]')];
    this.scenes = [...this.querySelectorAll('[data-scene]')];
    if (!this.tabs.length) return;

    this.index = 0;
    this.autoplay = !window.matchMedia('(prefers-reduced-motion: reduce)').matches && this.tabs.length > 1;

    this.tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => this.pick(i));
      tab.addEventListener('animationend', (event) => {
        if (event.animationName === 'dlh-ss-progress' && i === this.index) this.select((i + 1) % this.tabs.length);
      });
    });
    this.querySelector('[role="tablist"]').addEventListener('keydown', (event) => this.onKey(event));

    this.observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) this.loadImages();
        this.classList.toggle('is-playing', this.autoplay && entry.intersectionRatio >= 0.35);
      },
      { rootMargin: '200px 0px', threshold: [0, 0.35] }
    );
    this.observer.observe(this);

    this.select(0);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  /* Hidden scenes are lazy images that would never load; fetch them once the section is near. */
  loadImages() {
    if (this.imagesLoaded) return;
    this.imagesLoaded = true;
    this.querySelectorAll('.dlh-ss__img').forEach((img) => (img.loading = 'eager'));
  }

  pick(i) {
    this.autoplay = false;
    this.classList.remove('is-playing');
    this.select(i);
  }

  select(i) {
    this.index = i;
    this.tabs.forEach((tab, n) => {
      const active = n === i;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    this.scenes.forEach((scene, n) => scene.classList.toggle('is-active', n === i));
    this.dataset.tone = this.tabs[i].dataset.tone || 'gold';

    /* The sun sits on the arc right above the active tab (the arc is a half-ellipse spanning the tabs). */
    const x = (2 * (i + 0.5)) / this.tabs.length - 1;
    this.style.setProperty('--dlh-ss-sun-x', `${((x + 1) / 2) * 100}%`);
    this.style.setProperty('--dlh-ss-sun-y', Math.sqrt(1 - x * x).toFixed(3));
  }

  onKey(event) {
    const last = this.tabs.length - 1;
    const keys = { ArrowRight: this.index + 1, ArrowLeft: this.index - 1, Home: 0, End: last };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = (keys[event.key] + this.tabs.length) % this.tabs.length;
    this.pick(next);
    this.tabs[next].focus();
  }
}

if (!customElements.get('dlh-signature-safari')) customElements.define('dlh-signature-safari', DlhSignatureSafari);
