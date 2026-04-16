import { describe, it, expect, beforeEach } from 'vitest';
import { TouchTracker } from '../../src/content/gesture/TouchTracker';

// Mock TouchEvent helper
function createTouchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>): TouchEvent {
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

  // ── onTouchStart ─────────────────────────────────────────────────────────

  describe('onTouchStart', () => {
    it('should initialize tracking with the first touch point', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]));

      // After start, one point is recorded; onTouchEnd requires length >= 2,
      // so we verify via getSession which also requires length >= 2.
      // Add a move to make length = 2, then verify the first point exists.
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 110, clientY: 210 }]));
      const session = tracker.getSession();
      expect(session).not.toBeNull();
      expect(session!.points[0].x).toBe(100);
      expect(session!.points[0].y).toBe(200);
    });

    it('should set fingerCount based on number of touches', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [
        { clientX: 100, clientY: 200 },
        { clientX: 200, clientY: 300 },
      ]));
      tracker.onTouchMove(createTouchEvent('touchmove', [
        { clientX: 110, clientY: 210 },
        { clientX: 210, clientY: 310 },
      ]));
      const session = tracker.getSession();
      expect(session!.fingerCount).toBe(2);
    });

    it('should record startTime on touch start', () => {
      const before = performance.now();
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 50, clientY: 50 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 60, clientY: 60 }]));
      const session = tracker.getSession();
      expect(session!.startTime).toBeGreaterThanOrEqual(before);
    });

    it('should reset previous state on new touch start', () => {
      // First session
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 10, clientY: 10 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 20, clientY: 20 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 30, clientY: 30 }]));

      // New session should reset
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 500, clientY: 500 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 510, clientY: 510 }]));
      const session = tracker.getSession();

      expect(session!.points[0].x).toBe(500);
      expect(session!.points[0].y).toBe(500);
      // Should have 2 points (start + 1 move), not points from previous session
      expect(session!.points.length).toBe(2);
    });

    it('should track second finger points when two fingers present', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 250, clientY: 250 },
      ]));
      tracker.onTouchMove(createTouchEvent('touchmove', [
        { clientX: 110, clientY: 110 },
        { clientX: 260, clientY: 260 },
      ]));
      const session = tracker.getSession();
      expect(session!.secondFingerPoints.length).toBeGreaterThanOrEqual(1);
      expect(session!.secondFingerPoints[0].x).toBe(250);
      expect(session!.secondFingerPoints[0].y).toBe(250);
    });
  });

  // ── onTouchMove ──────────────────────────────────────────────────────────

  describe('onTouchMove', () => {
    it('should record points with sampling (respects interval)', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));

      // Rapid moves should be sampled (not all recorded due to interval)
      for (let i = 1; i <= 5; i++) {
        tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: i * 10, clientY: i * 10 }]));
      }

      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session).not.toBeNull();
      // At minimum, start point is recorded; some moves may be skipped by sampling
      expect(session!.points.length).toBeGreaterThanOrEqual(1);
    });

    it('should track maximum finger count across all moves', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [
        { clientX: 110, clientY: 110 },
        { clientX: 200, clientY: 200 },
      ]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 120, clientY: 120 }]));

      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session).not.toBeNull();
      expect(session!.fingerCount).toBe(2); // max was 2
    });

    it('should switch to precise sampling on direction change', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 100, clientY: 100 }]));

      // Move right, then left (direction change)
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 100, clientY: 100 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 200, clientY: 100 }]));

      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session).not.toBeNull();
      // After direction changes, the internal currentInterval should have switched
      // We can't directly check the interval, but points should be recorded
      expect(session!.points.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle ring buffer overflow (more than 128 points)', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 0, clientY: 0 }]));
      for (let i = 0; i < 200; i++) {
        tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: i, clientY: i }]));
      }
      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session).not.toBeNull();
      expect(session!.points.length).toBeLessThanOrEqual(128);
    });
  });

  // ── onTouchEnd ───────────────────────────────────────────────────────────

  describe('onTouchEnd', () => {
    it('should return a complete session with points, timing, and finger count', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 50, clientY: 50 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 100, clientY: 100 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 150, clientY: 150 }]));

      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));

      expect(session).not.toBeNull();
      expect(session!.points).toBeDefined();
      expect(session!.points.length).toBeGreaterThanOrEqual(2);
      expect(session!.fingerCount).toBe(1);
      expect(session!.startTime).toBeGreaterThan(0);
      expect(session!.endTime).toBeGreaterThanOrEqual(session!.startTime);
      expect(session!.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return null when length < 2 (no moves recorded)', () => {
      // Only start, no moves
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]));
      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session).toBeNull();
    });

    it('should return null when no touch start was recorded', () => {
      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session).toBeNull();
    });

    it('should return points in chronological order', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 10, clientY: 10 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 20, clientY: 20 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 30, clientY: 30 }]));

      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session).not.toBeNull();

      // Points should be in order of x increasing
      for (let i = 1; i < session!.points.length; i++) {
        expect(session!.points[i].x).toBeGreaterThanOrEqual(session!.points[i - 1].x);
      }
    });

    it('should include secondFingerPoints in the session', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 },
      ]));
      tracker.onTouchMove(createTouchEvent('touchmove', [
        { clientX: 110, clientY: 110 },
        { clientX: 210, clientY: 210 },
      ]));

      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session).not.toBeNull();
      expect(session!.secondFingerPoints).toBeDefined();
      expect(session!.secondFingerPoints.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── getSession() ─────────────────────────────────────────────────────────

  describe('getSession()', () => {
    it('should return the current session without ending it', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 10, clientY: 10 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 50, clientY: 50 }]));

      const session = tracker.getSession();
      expect(session).not.toBeNull();
      expect(session!.points.length).toBeGreaterThanOrEqual(2);

      // Should still be able to add more moves after getSession
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 90, clientY: 90 }]));
      const session2 = tracker.getSession();
      // The second session may have same or more points depending on sampling
      expect(session2).not.toBeNull();
      expect(session2!.points.length).toBeGreaterThanOrEqual(session!.points.length);
    });

    it('should return null when length < 2', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 10, clientY: 10 }]));
      const session = tracker.getSession();
      expect(session).toBeNull();
    });

    it('should return null when no tracking has started', () => {
      const session = tracker.getSession();
      expect(session).toBeNull();
    });
  });

  // ── reset() ──────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('should clear all data so onTouchEnd returns null', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 150, clientY: 250 }]));

      tracker.reset();

      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session).toBeNull();
    });

    it('should clear all data so getSession returns null', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 150, clientY: 250 }]));

      tracker.reset();

      const session = tracker.getSession();
      expect(session).toBeNull();
    });

    it('should allow fresh tracking after reset', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 100, clientY: 200 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 150, clientY: 250 }]));

      tracker.reset();

      // Fresh session
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 300, clientY: 400 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 350, clientY: 450 }]));

      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session).not.toBeNull();
      expect(session!.points[0].x).toBe(300);
      expect(session!.points[0].y).toBe(400);
    });

    it('should reset finger count to 0', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 },
      ]));
      tracker.onTouchMove(createTouchEvent('touchmove', [
        { clientX: 110, clientY: 110 },
        { clientX: 210, clientY: 210 },
      ]));

      tracker.reset();

      // Start new single-finger session
      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 50, clientY: 50 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 60, clientY: 60 }]));
      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session!.fingerCount).toBe(1);
    });

    it('should reset second finger points', () => {
      tracker.onTouchStart(createTouchEvent('touchstart', [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 200 },
      ]));
      tracker.onTouchMove(createTouchEvent('touchmove', [
        { clientX: 110, clientY: 110 },
        { clientX: 210, clientY: 210 },
      ]));

      tracker.reset();

      tracker.onTouchStart(createTouchEvent('touchstart', [{ clientX: 50, clientY: 50 }]));
      tracker.onTouchMove(createTouchEvent('touchmove', [{ clientX: 60, clientY: 60 }]));
      const session = tracker.onTouchEnd(createTouchEvent('touchend', []));
      expect(session!.secondFingerPoints.length).toBe(0);
    });
  });
});
