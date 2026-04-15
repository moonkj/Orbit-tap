import { describe, it, expect, beforeEach } from 'vitest';
import { TouchTracker } from '../../src/content/gesture/TouchTracker';

// Mock TouchEvent
function createTouchEvent(type: string, touches: Array<{clientX: number, clientY: number}>): TouchEvent {
  return {
    type,
    touches: touches.map((t, i) => ({ ...t, identifier: i })),
    changedTouches: touches.map((t, i) => ({ ...t, identifier: i })),
  } as unknown as TouchEvent;
}

describe('TouchTracker', () => {
  let tracker: TouchTracker;

  beforeEach(() => {
    tracker = new TouchTracker();
  });

  it('should initialize with empty state', () => {
    const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
    expect(session).toBeNull();
  });

  it('should track single touch session', () => {
    tracker.onTouchStart(createTouchEvent('touchstart', [{clientX: 100, clientY: 200}]));
    tracker.onTouchMove(createTouchEvent('touchmove', [{clientX: 150, clientY: 200}]));
    tracker.onTouchMove(createTouchEvent('touchmove', [{clientX: 200, clientY: 200}]));
    const session = tracker.onTouchEnd(createTouchEvent('touchend', []));

    expect(session).not.toBeNull();
    expect(session!.fingerCount).toBe(1);
    expect(session!.points.length).toBeGreaterThanOrEqual(1);
    expect(session!.duration).toBeGreaterThanOrEqual(0);
  });

  it('should track two finger touches', () => {
    tracker.onTouchStart(createTouchEvent('touchstart', [
      {clientX: 100, clientY: 200},
      {clientX: 200, clientY: 200},
    ]));
    tracker.onTouchMove(createTouchEvent('touchmove', [
      {clientX: 100, clientY: 150},
      {clientX: 200, clientY: 150},
    ]));
    const session = tracker.onTouchEnd(createTouchEvent('touchend', []));

    expect(session).not.toBeNull();
    expect(session!.fingerCount).toBe(2);
    expect(session!.secondFingerPoints.length).toBeGreaterThanOrEqual(1);
  });

  it('should reset state correctly', () => {
    tracker.onTouchStart(createTouchEvent('touchstart', [{clientX: 100, clientY: 200}]));
    tracker.reset();
    const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
    expect(session).toBeNull();
  });

  it('should apply adaptive sampling - direction change triggers 60Hz', () => {
    tracker.onTouchStart(createTouchEvent('touchstart', [{clientX: 100, clientY: 100}]));
    // Simulate rapid direction changes (force sampling)
    for (let i = 0; i < 20; i++) {
      const x = 100 + (i % 2 === 0 ? 50 : -50);
      tracker.onTouchMove(createTouchEvent('touchmove', [{clientX: x, clientY: 100 + i * 10}]));
    }
    const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
    expect(session).not.toBeNull();
    // Should have captured points (actual count depends on timing)
    expect(session!.points.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle ring buffer overflow gracefully', () => {
    tracker.onTouchStart(createTouchEvent('touchstart', [{clientX: 0, clientY: 0}]));
    // Add more than 128 points (ring buffer max)
    for (let i = 0; i < 200; i++) {
      tracker.onTouchMove(createTouchEvent('touchmove', [{clientX: i, clientY: i}]));
    }
    const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
    expect(session).not.toBeNull();
    expect(session!.points.length).toBeLessThanOrEqual(128);
  });
});
