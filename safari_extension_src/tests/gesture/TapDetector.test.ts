import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TapDetector } from '../../src/content/gesture/TapDetector';
import { GestureType } from '../../src/content/gesture/ShapeDetector';

function createTouchEvent(type: string, x: number, y: number): TouchEvent {
  return {
    type,
    touches: [{ clientX: x, clientY: y, identifier: 0 }],
    changedTouches: [{ clientX: x, clientY: y, identifier: 0 }],
  } as unknown as TouchEvent;
}

const DEFAULT_CONFIG = {
  doubleTapMaxInterval: 300,
  longPressMinDuration: 700,
} as any;

describe('TapDetector', () => {
  let detector: TapDetector;

  beforeEach(() => {
    detector = new TapDetector(DEFAULT_CONFIG);
    vi.useFakeTimers();
  });

  it('should return null for single tap (no immediate result)', () => {
    detector.onTouchStart(createTouchEvent('touchstart', 200, 400));
    vi.advanceTimersByTime(50);
    const result = detector.onTouchEnd(createTouchEvent('touchend', 200, 400));
    // Single tap returns null immediately, would be resolved by timer
    expect(result).toBeNull();
  });

  it('should detect DOUBLE_TAP', () => {
    // First tap
    detector.onTouchStart(createTouchEvent('touchstart', 200, 400));
    vi.advanceTimersByTime(50);
    detector.onTouchEnd(createTouchEvent('touchend', 200, 400));

    // Second tap within interval
    vi.advanceTimersByTime(150);
    detector.onTouchStart(createTouchEvent('touchstart', 202, 402));
    vi.advanceTimersByTime(50);
    const result = detector.onTouchEnd(createTouchEvent('touchend', 202, 402));

    expect(result).toBe(GestureType.DOUBLE_TAP);
  });

  it('should detect LONG_PRESS', () => {
    detector.onTouchStart(createTouchEvent('touchstart', 200, 400));
    vi.advanceTimersByTime(800); // Over 700ms threshold
    const result = detector.onTouchEnd(createTouchEvent('touchend', 200, 400));
    expect(result).toBe(GestureType.LONG_PRESS);
  });

  it('should not detect tap if moved too far', () => {
    detector.onTouchStart(createTouchEvent('touchstart', 200, 400));
    vi.advanceTimersByTime(50);
    const result = detector.onTouchEnd(createTouchEvent('touchend', 250, 450));
    expect(result).toBeNull();
  });

  it('should not detect double tap if too far apart in position', () => {
    detector.onTouchStart(createTouchEvent('touchstart', 200, 400));
    vi.advanceTimersByTime(50);
    detector.onTouchEnd(createTouchEvent('touchend', 200, 400));

    vi.advanceTimersByTime(100);
    detector.onTouchStart(createTouchEvent('touchstart', 300, 500)); // Too far
    vi.advanceTimersByTime(50);
    const result = detector.onTouchEnd(createTouchEvent('touchend', 300, 500));
    expect(result).toBeNull();
  });
});
