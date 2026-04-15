import { GestureType } from '../gesture/ShapeDetector';

export class FeedbackOverlay {
  private overlay: HTMLElement | null = null;

  show(gesture: GestureType): void {
    this.hide();

    const label = this.getLabel(gesture);
    const icon = this.getIcon(gesture);

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
    `;
    this.overlay.textContent = `${icon} ${label}`;
    document.body.appendChild(this.overlay);

    requestAnimationFrame(() => {
      if (this.overlay) this.overlay.style.opacity = '1';
    });

    setTimeout(() => this.hide(), 300);
  }

  private hide(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private getLabel(gesture: GestureType): string {
    const labels: Record<string, string> = {
      [GestureType.SWIPE_BACK]: 'Back',
      [GestureType.SWIPE_FORWARD]: 'Forward',
      [GestureType.V_SHAPE]: 'Close Tab',
      [GestureType.L_SHAPE]: 'Restore Tab',
      [GestureType.DOUBLE_TAP]: 'Search',
      [GestureType.LONG_PRESS]: 'Scroll',
      [GestureType.TWO_FINGER_FLICK_UP]: 'Refresh',
      [GestureType.TWO_FINGER_FLICK_DOWN]: 'Fullscreen',
    };
    return labels[gesture] ?? '';
  }

  private getIcon(gesture: GestureType): string {
    const icons: Record<string, string> = {
      [GestureType.SWIPE_BACK]: '\u2190',
      [GestureType.SWIPE_FORWARD]: '\u2192',
      [GestureType.V_SHAPE]: '\u2715',
      [GestureType.L_SHAPE]: '\u21B6',
      [GestureType.DOUBLE_TAP]: '\uD83D\uDD0D',
      [GestureType.LONG_PRESS]: '\u2195',
      [GestureType.TWO_FINGER_FLICK_UP]: '\u21BB',
      [GestureType.TWO_FINGER_FLICK_DOWN]: '\u2922',
    };
    return icons[gesture] ?? '';
  }
}
