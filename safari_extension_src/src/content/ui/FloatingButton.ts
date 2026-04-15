import type { GestureConfig } from '../config/ConfigBridge';

type ButtonAction = 'back' | 'forward' | 'tabOverview' | 'gestureGuide';

export class FloatingButton {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private button: HTMLElement | null = null;
  private guideOverlay: HTMLElement | null = null;
  private config: GestureConfig;
  private isDragging = false;
  private isHidden = false;
  private currentX: number;
  private currentY: number;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartTime = 0;
  private totalDragDistance = 0;
  private rafId: number | null = null;
  private tapCount = 0;
  private tapTimer: number | null = null;
  private longPressTimer: number | null = null;
  private readonly TAP_TIMEOUT = 350;
  private readonly LONG_PRESS_DURATION = 500;
  private readonly EDGE_THRESHOLD = 30;
  private readonly BUTTON_SIZE = 48;
  private abortController: AbortController | null = null;

  constructor(config: GestureConfig) {
    this.config = config;
    this.currentX = window.innerWidth - 60;
    this.currentY = window.innerHeight * 0.7;
  }

  mount(): void {
    if (!this.config.floatingButtonEnabled) return;

    this.host = document.createElement('div');
    this.host.id = 'swift-gesture-host';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      :host { all: initial; }
      .swift-fb {
        position: fixed;
        width: ${this.BUTTON_SIZE}px;
        height: ${this.BUTTON_SIZE}px;
        border-radius: ${this.BUTTON_SIZE / 2}px;
        background: rgba(10, 132, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2147483647;
        will-change: transform, opacity;
        transform: translate3d(0, 0, 0);
        touch-action: none;
        contain: layout style paint;
        -webkit-backface-visibility: hidden;
        box-shadow: 0 2px 10px rgba(0,0,0,0.25);
        transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
        user-select: none;
        -webkit-user-select: none;
      }
      .swift-fb.dragging {
        transition: none !important;
        opacity: 0.7;
        transform: scale(1.1);
      }
      .swift-fb.hidden-edge {
        opacity: 0.15;
        pointer-events: auto;
      }
      .swift-fb.hidden-full {
        opacity: 0;
        pointer-events: none;
      }
      .swift-fb svg {
        width: 22px;
        height: 22px;
        fill: white;
        pointer-events: none;
      }
      .swift-guide {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.85);
        z-index: 2147483646;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: auto;
      }
      .swift-guide.visible { opacity: 1; }
      .swift-guide h2 { font-size: 22px; margin: 0; }
      .swift-guide-item {
        display: flex; align-items: center; gap: 16px;
        padding: 12px 20px; background: rgba(255,255,255,0.1);
        border-radius: 12px; min-width: 260px;
      }
      .swift-guide-icon { font-size: 24px; width: 40px; text-align: center; }
      .swift-guide-text { font-size: 14px; }
      .swift-guide-label { font-weight: 600; }
      .swift-guide-desc { color: rgba(255,255,255,0.6); font-size: 12px; }
    `);
    this.shadow.adoptedStyleSheets = [sheet];

    this.button = document.createElement('div');
    this.button.className = 'swift-fb';
    this.button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>`;

    this.shadow.appendChild(this.button);
    document.documentElement.appendChild(this.host);

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.button.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false, signal });
    document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false, signal });
    document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true, signal });

    this.updatePosition(false);
  }

  unmount(): void {
    this.abortController?.abort();
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.button = null;
    if (this.tapTimer) clearTimeout(this.tapTimer);
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();

    if (this.isHidden) {
      this.showFromEdge();
      return;
    }

    this.isDragging = false;
    this.totalDragDistance = 0;
    this.dragStartX = e.touches[0].clientX;
    this.dragStartY = e.touches[0].clientY;
    this.dragStartTime = performance.now();

    this.longPressTimer = window.setTimeout(() => {
      if (!this.isDragging && this.totalDragDistance < 10) {
        this.executeTapAction('gestureGuide');
      }
    }, this.LONG_PRESS_DURATION);
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.button) return;

    const dx = e.touches[0].clientX - this.dragStartX;
    const dy = e.touches[0].clientY - this.dragStartY;
    this.totalDragDistance = Math.sqrt(dx * dx + dy * dy);

    if (this.totalDragDistance > 8) {
      this.isDragging = true;
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      e.preventDefault();

      this.currentX = e.touches[0].clientX - this.BUTTON_SIZE / 2;
      this.currentY = e.touches[0].clientY - this.BUTTON_SIZE / 2;

      if (!this.button.classList.contains('dragging')) {
        this.button.classList.add('dragging');
      }

      if (!this.rafId) {
        this.rafId = requestAnimationFrame(() => {
          this.updatePosition(false);
          this.rafId = null;
        });
      }
    }
  }

  private onTouchEnd(_e: TouchEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (this.isDragging) {
      this.isDragging = false;
      this.button?.classList.remove('dragging');
      this.snapToEdge();
      return;
    }

    // Tap detection
    const duration = performance.now() - this.dragStartTime;
    if (duration < this.LONG_PRESS_DURATION && this.totalDragDistance < 10) {
      this.tapCount++;
      if (this.tapTimer) clearTimeout(this.tapTimer);

      this.tapTimer = window.setTimeout(() => {
        switch (this.tapCount) {
          case 1: this.executeTapAction('back'); break;
          case 2: this.executeTapAction('forward'); break;
          default: this.executeTapAction('tabOverview'); break;
        }
        this.tapCount = 0;
      }, this.TAP_TIMEOUT);
    }
  }

  private executeTapAction(action: ButtonAction): void {
    switch (action) {
      case 'back':
        browser.runtime.sendMessage({ action: 'navigate', direction: 'back' });
        break;
      case 'forward':
        browser.runtime.sendMessage({ action: 'navigate', direction: 'forward' });
        break;
      case 'tabOverview':
        // Show tab list in popup since native tab overview can't be triggered
        browser.runtime.sendMessage({ action: 'navigate', direction: 'back' }); // fallback
        break;
      case 'gestureGuide':
        this.showGestureGuide();
        break;
    }
    browser.runtime.sendMessage({ action: 'logGesture', gestureType: `button_${action}` });
  }

  private updatePosition(animate: boolean): void {
    if (!this.button) return;
    const x = Math.max(0, Math.min(this.currentX, window.innerWidth - this.BUTTON_SIZE));
    const y = Math.max(0, Math.min(this.currentY, window.innerHeight - this.BUTTON_SIZE));

    if (!animate) {
      this.button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    } else {
      this.button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  }

  private snapToEdge(): void {
    const midX = window.innerWidth / 2;
    const margin = 8;

    if (this.currentX + this.BUTTON_SIZE / 2 < midX) {
      this.currentX = margin;
    } else {
      this.currentX = window.innerWidth - this.BUTTON_SIZE - margin;
    }

    // Check if dragged to extreme edge → hide
    if (this.currentX <= this.EDGE_THRESHOLD || this.currentX >= window.innerWidth - this.EDGE_THRESHOLD - this.BUTTON_SIZE) {
      this.hideToEdge();
      return;
    }

    // Clamp Y
    this.currentY = Math.max(60, Math.min(this.currentY, window.innerHeight - this.BUTTON_SIZE - 60));
    this.updatePosition(true);
  }

  private hideToEdge(): void {
    this.isHidden = true;
    this.button?.classList.add('hidden-edge');
    // Snap to the nearest edge
    const margin = -this.BUTTON_SIZE / 2;
    if (this.currentX < window.innerWidth / 2) {
      this.currentX = margin;
    } else {
      this.currentX = window.innerWidth - this.BUTTON_SIZE / 2;
    }
    this.updatePosition(true);
  }

  private showFromEdge(): void {
    this.isHidden = false;
    this.button?.classList.remove('hidden-edge');
    const margin = 8;
    if (this.currentX < window.innerWidth / 2) {
      this.currentX = margin;
    } else {
      this.currentX = window.innerWidth - this.BUTTON_SIZE - margin;
    }
    this.updatePosition(true);
  }

  private showGestureGuide(): void {
    if (!this.shadow) return;

    const existing = this.shadow.querySelector('.swift-guide');
    if (existing) { existing.remove(); return; }

    this.guideOverlay = document.createElement('div');
    this.guideOverlay.className = 'swift-guide';
    this.guideOverlay.innerHTML = `
      <h2>Swift Gesture Guide</h2>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">\u2190\u2192</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">Swipe Left/Right</div>
          <div class="swift-guide-desc">Navigate back / forward</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">V</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">V Shape</div>
          <div class="swift-guide-desc">Close current tab</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">L</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">L Shape</div>
          <div class="swift-guide-desc">Restore closed tab</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">\u00D7\u00D72</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">Double Tap</div>
          <div class="swift-guide-desc">Page search</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">\u23F3</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">Long Press</div>
          <div class="swift-guide-desc">Scroll to top / bottom</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">\u2191\u2191</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">Two Finger Flick</div>
          <div class="swift-guide-desc">Up: Refresh / Down: Fullscreen</div>
        </div>
      </div>
    `;

    this.guideOverlay.addEventListener('click', () => {
      this.guideOverlay?.remove();
      this.guideOverlay = null;
    }, { once: true });

    this.shadow.appendChild(this.guideOverlay);
    requestAnimationFrame(() => this.guideOverlay?.classList.add('visible'));
  }
}
