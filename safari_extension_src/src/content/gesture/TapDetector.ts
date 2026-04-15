import type { GestureConfig } from '../config/ConfigBridge';
import { GestureType } from './ShapeDetector';

export class TapDetector {
  private tapCount = 0;
  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private touchStartTime = 0;
  private touchStartX = 0;
  private touchStartY = 0;
  private tapTimer: number | null = null;
  private config: GestureConfig;
  private pendingResolve: ((gesture: GestureType) => void) | null = null;

  constructor(config: GestureConfig) {
    this.config = config;
  }

  onTouchStart(e: TouchEvent): void {
    this.touchStartTime = performance.now();
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent): GestureType | null {
    const endTime = performance.now();
    const duration = endTime - this.touchStartTime;

    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const moveDistance = Math.sqrt(
      (endX - this.touchStartX) ** 2 + (endY - this.touchStartY) ** 2
    );

    // Long Press
    if (duration >= this.config.longPressMinDuration && moveDistance < 10) {
      this.resetTaps();
      return GestureType.LONG_PRESS;
    }

    // Not a tap if moved too much or held too long
    if (moveDistance > 20 || duration > 300) {
      this.resetTaps();
      return null;
    }

    // Check proximity to last tap
    const tapDistance = Math.sqrt(
      (endX - this.lastTapX) ** 2 + (endY - this.lastTapY) ** 2
    );
    const timeSinceLastTap = endTime - this.lastTapTime;

    if (timeSinceLastTap < this.config.doubleTapMaxInterval && tapDistance < 30) {
      this.tapCount++;
    } else {
      this.tapCount = 1;
    }

    this.lastTapTime = endTime;
    this.lastTapX = endX;
    this.lastTapY = endY;

    // Clear pending timer
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
    }

    // Wait to see if more taps come
    // For now, return double tap immediately when 2 taps detected
    if (this.tapCount >= 2) {
      const result = GestureType.DOUBLE_TAP;
      this.resetTaps();
      return result;
    }

    return null;
  }

  private resetTaps(): void {
    this.tapCount = 0;
    if (this.tapTimer) {
      clearTimeout(this.tapTimer);
      this.tapTimer = null;
    }
  }
}
