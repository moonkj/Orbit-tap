export type QuickAction = 'bookmark' | 'share' | 'translate' | 'readMode' | 'screenshot';

interface ActionItem {
  id: QuickAction;
  icon: string;
  label: string;
}

const ACTIONS: ActionItem[] = [
  { id: 'bookmark', icon: '\u2606', label: 'Bookmark' },
  { id: 'share', icon: '\u21AA', label: 'Share' },
  { id: 'readMode', icon: '\u2261', label: 'Read Mode' },
  { id: 'screenshot', icon: '\u2B1A', label: 'Screenshot' },
];

export class QuickActionHUD {
  private overlay: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private onActionCallback: ((action: QuickAction) => void) | null = null;

  onAction(callback: (action: QuickAction) => void): void {
    this.onActionCallback = callback;
  }

  show(): void {
    this.hide();

    this.overlay = document.createElement('div');
    this.overlay.id = 'swift-quick-action-host';
    this.shadow = this.overlay.attachShadow({ mode: 'closed' });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      :host { all: initial; }
      .swift-hud-backdrop {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.4);
        z-index: 2147483645;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.15s ease;
      }
      .swift-hud-backdrop.visible { opacity: 1; }
      .swift-hud {
        background: rgba(44, 44, 46, 0.95);
        -webkit-backdrop-filter: blur(20px);
        backdrop-filter: blur(20px);
        border-radius: 20px;
        padding: 20px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        max-width: 280px;
      }
      .swift-hud-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 16px 12px;
        border-radius: 14px;
        background: rgba(255,255,255,0.08);
        cursor: pointer;
        transition: background 0.15s ease;
        -webkit-tap-highlight-color: transparent;
      }
      .swift-hud-item:active {
        background: rgba(255,255,255,0.2);
      }
      .swift-hud-icon {
        font-size: 28px;
        color: #0A84FF;
      }
      .swift-hud-label {
        font-size: 12px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        text-align: center;
      }
    `);
    this.shadow.adoptedStyleSheets = [sheet];

    const backdrop = document.createElement('div');
    backdrop.className = 'swift-hud-backdrop';

    const hud = document.createElement('div');
    hud.className = 'swift-hud';

    ACTIONS.forEach(action => {
      const item = document.createElement('div');
      item.className = 'swift-hud-item';
      item.innerHTML = `
        <div class="swift-hud-icon">${action.icon}</div>
        <div class="swift-hud-label">${action.label}</div>
      `;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onActionCallback?.(action.id);
        this.hide();
      });
      hud.appendChild(item);
    });

    backdrop.appendChild(hud);
    backdrop.addEventListener('click', () => this.hide());

    this.shadow.appendChild(backdrop);
    document.documentElement.appendChild(this.overlay);

    requestAnimationFrame(() => backdrop.classList.add('visible'));
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.shadow = null;
  }

  isVisible(): boolean {
    return this.overlay !== null;
  }
}
