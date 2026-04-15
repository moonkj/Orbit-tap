import type { GestureConfig } from '../config/ConfigBridge';

export class FloatingButton {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private button: HTMLElement | null = null;
  private config: GestureConfig;
  private isDragging = false;
  private currentX = 0;
  private currentY = 0;
  private rafId: number | null = null;

  constructor(config: GestureConfig) {
    this.config = config;
    this.currentX = window.innerWidth - 60;
    this.currentY = window.innerHeight * 0.7;
  }

  mount(): void {
    this.host = document.createElement('div');
    this.host.id = 'swift-gesture-host';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      .swift-floating-btn {
        position: fixed;
        width: 48px;
        height: 48px;
        border-radius: 24px;
        background: rgba(10, 132, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2147483647;
        will-change: transform;
        touch-action: none;
        -webkit-backface-visibility: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: opacity 0.2s ease;
      }
      .swift-floating-btn.dragging {
        transition: none !important;
        opacity: 0.8;
      }
      .swift-floating-btn.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .swift-floating-btn svg {
        width: 24px;
        height: 24px;
        fill: white;
      }
    `);
    this.shadow.adoptedStyleSheets = [sheet];

    this.button = document.createElement('div');
    this.button.className = 'swift-floating-btn';
    this.button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>`;
    this.updatePosition();

    this.button.addEventListener('touchstart', this.onBtnTouchStart.bind(this), { passive: false });
    document.addEventListener('touchmove', this.onBtnTouchMove.bind(this), { passive: false });
    document.addEventListener('touchend', this.onBtnTouchEnd.bind(this), { passive: true });

    this.shadow.appendChild(this.button);
    document.documentElement.appendChild(this.host);
  }

  unmount(): void {
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.button = null;
  }

  private onBtnTouchStart(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
    // Set up for potential drag
  }

  private onBtnTouchMove(e: TouchEvent): void {
    if (!this.button?.contains(e.target as Node) && !this.isDragging) return;

    this.isDragging = true;
    e.preventDefault();

    this.currentX = e.touches[0].clientX - 24;
    this.currentY = e.touches[0].clientY - 24;

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.updatePosition();
        this.rafId = null;
      });
    }
  }

  private onBtnTouchEnd(_e: TouchEvent): void {
    if (!this.isDragging) {
      // It was a tap - execute action
      browser.runtime.sendMessage({ action: 'navigate', direction: 'back' });
    } else {
      this.snapToEdge();
    }
    this.isDragging = false;
  }

  private updatePosition(): void {
    const x = Math.max(0, Math.min(this.currentX, window.innerWidth - 48));
    const y = Math.max(0, Math.min(this.currentY, window.innerHeight - 48));
    this.button!.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  private snapToEdge(): void {
    const midX = window.innerWidth / 2;
    this.currentX = this.currentX < midX ? 8 : window.innerWidth - 56;
    this.button!.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
    this.updatePosition();
    setTimeout(() => {
      if (this.button) this.button.style.transition = '';
    }, 250);
  }
}
