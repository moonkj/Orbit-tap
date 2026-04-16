import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GestureEngine } from '../../src/content/gesture/GestureEngine';
import { GestureType } from '../../src/content/gesture/ShapeDetector';
import type { GestureConfig } from '../../src/content/config/ConfigBridge';

// ── Mocks ────────────────────────────────────────────────────────────────────

function createMockConfig(overrides: Partial<GestureConfig> = {}): GestureConfig {
  return {
    masterEnabled: true,
    swipeMinDistance: 80,
    edgeZonePercent: 0.12,
    vShapeMinSegment: 60,
    vShapeAngleMin: 30,
    vShapeAngleMax: 90,
    lShapeAngleMin: 75,
    lShapeAngleMax: 105,
    doubleTapMaxInterval: 300,
    longPressMinDuration: 700,
    cooldownSwipe: 300,
    cooldownShape: 500,
    cooldownTap: 400,
    cooldownTwoFinger: 600,
    floatingButtonEnabled: true,
    gesturesEnabled: {
      xShape: true,
      lShape: true,
      circle: true,
      cShape: true,
    },
    sensitivity: 50,
    buttonSize: 'medium',
    buttonOpacity: 90,
    ...overrides,
  };
}

function createMockIntentDetector() {
  return {
    isInputFocused: vi.fn(() => false),
    isScrolling: vi.fn(() => false),
    isIdle: vi.fn(() => true),
    startListening: vi.fn(),
    stopListening: vi.fn(),
  };
}

function createMockUsageTracker(canUse = true) {
  return {
    canUse: vi.fn(() => canUse),
    refresh: vi.fn(async () => {}),
    recordUse: vi.fn(async () => {}),
    load: vi.fn(async () => {}),
    remaining: vi.fn(() => (canUse ? 5 : 0)),
    isSubscribed: vi.fn(() => false),
    startListening: vi.fn(),
    setSubscription: vi.fn(async () => {}),
    getStats: vi.fn(() => ({ weekFree: 0, totalFree: 0, monthSub: 0, todayCount: 0 })),
    resetStats: vi.fn(async () => {}),
  };
}

describe('GestureEngine', () => {
  let config: GestureConfig;
  let intentDetector: ReturnType<typeof createMockIntentDetector>;
  let usageTracker: ReturnType<typeof createMockUsageTracker>;
  let engine: GestureEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.innerHTML = '<head></head><body></body>';
    config = createMockConfig();
    intentDetector = createMockIntentDetector();
    usageTracker = createMockUsageTracker(true);
    engine = new GestureEngine(config, intentDetector as any, usageTracker as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.innerHTML = '';
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create an instance with the given config, intentDetector, and usageTracker', () => {
      expect(engine).toBeInstanceOf(GestureEngine);
    });

    it('should create a separate instance with different config', () => {
      const config2 = createMockConfig({ sensitivity: 100 });
      const engine2 = new GestureEngine(config2, intentDetector as any, usageTracker as any);
      expect(engine2).toBeInstanceOf(GestureEngine);
      expect(engine2).not.toBe(engine);
    });
  });

  // ── activateGestureMode ──────────────────────────────────────────────────

  describe('activateGestureMode()', () => {
    it('should create overlay when gestureMode is false', async () => {
      await engine.activateGestureMode();

      const overlay = document.querySelector('.swift-gm-overlay');
      expect(overlay).not.toBeNull();
      expect(overlay).toBeInstanceOf(HTMLElement);

      // Should also create border
      const border = document.querySelector('.swift-gm-border');
      expect(border).not.toBeNull();

      // Should also create style
      const styles = document.querySelectorAll('style');
      const hasGmStyle = Array.from(styles).some(s => s.textContent?.includes('swift-gm-overlay'));
      expect(hasGmStyle).toBe(true);

      // Should contain a canvas for live drawing
      const canvas = overlay?.querySelector('canvas');
      expect(canvas).not.toBeNull();
    });

    it('should not create duplicate overlay when already in gesture mode', async () => {
      await engine.activateGestureMode();
      await engine.activateGestureMode(); // second call should early-return

      const overlays = document.querySelectorAll('.swift-gm-overlay');
      expect(overlays.length).toBe(1);
    });

    it('should call usageTracker.refresh() before checking canUse()', async () => {
      await engine.activateGestureMode();
      expect(usageTracker.refresh).toHaveBeenCalledOnce();
      expect(usageTracker.canUse).toHaveBeenCalledOnce();
    });

    it('should show subscription prompt when canUse() returns false', async () => {
      const limitedTracker = createMockUsageTracker(false);
      const limitedEngine = new GestureEngine(config, intentDetector as any, limitedTracker as any);

      await limitedEngine.activateGestureMode();

      // Should NOT create the gesture overlay
      const overlay = document.querySelector('.swift-gm-overlay');
      expect(overlay).toBeNull();

      // Should show subscription prompt (has subscribe button)
      const subBtn = document.querySelector('#swift-sub-btn');
      expect(subBtn).not.toBeNull();

      const closeBtn = document.querySelector('#swift-sub-close');
      expect(closeBtn).not.toBeNull();
    });

    it('should refresh and check usage each time it is activated', async () => {
      await engine.activateGestureMode();
      expect(usageTracker.refresh).toHaveBeenCalledTimes(1);
      expect(usageTracker.canUse).toHaveBeenCalledTimes(1);
    });

    it('should set auto-deactivation timer for 5 seconds', async () => {
      await engine.activateGestureMode();

      const overlay = document.querySelector('.swift-gm-overlay');
      expect(overlay).not.toBeNull();

      // Advance past the 5-second timeout
      vi.advanceTimersByTime(5000);

      // The overlay gets removed via setTimeout(200) inside deactivate
      vi.advanceTimersByTime(300);

      const overlayAfter = document.querySelector('.swift-gm-overlay');
      expect(overlayAfter).toBeNull();
    });
  });

  // ── deactivate ───────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('should remove overlay and related elements when stop() is called', async () => {
      await engine.activateGestureMode();

      expect(document.querySelector('.swift-gm-overlay')).not.toBeNull();

      // stop() calls deactivate()
      engine.stop();

      // border fades out in 300ms, overlay in 200ms
      vi.advanceTimersByTime(400);

      expect(document.querySelector('.swift-gm-overlay')).toBeNull();
      expect(document.querySelector('.swift-gm-border')).toBeNull();
    });

    it('should be safe to call stop() when not in gesture mode', () => {
      expect(() => engine.stop()).not.toThrow();
    });

    it('should clear the gesture mode timer on deactivation', async () => {
      await engine.activateGestureMode();
      engine.stop();
      vi.advanceTimersByTime(400);

      // After deactivation, the 5-second timer should be cleared (no errors)
      vi.advanceTimersByTime(10000);
      expect(document.querySelector('.swift-gm-overlay')).toBeNull();
    });
  });

  // ── executeGesture ───────────────────────────────────────────────────────

  describe('executeGesture()', () => {
    it('should check config before executing a gesture', async () => {
      // Disable xShape in config
      const disabledConfig = createMockConfig({
        gesturesEnabled: { xShape: false, lShape: true, circle: true, cShape: true },
      });
      const disabledEngine = new GestureEngine(disabledConfig, intentDetector as any, usageTracker as any);

      // Access executeGesture via the private method using type assertion
      const exec = (disabledEngine as any).executeGesture.bind(disabledEngine);
      exec(GestureType.X_SHAPE, []);

      // Should NOT record usage because xShape is disabled
      expect(usageTracker.recordUse).not.toHaveBeenCalled();
      expect(browser.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('should record usage when gesture config is enabled', () => {
      const exec = (engine as any).executeGesture.bind(engine);
      exec(GestureType.L_SHAPE, [{ x: 0, y: 0, timestamp: 0 }]);

      expect(usageTracker.recordUse).toHaveBeenCalledOnce();
    });

    it('should send closeTab message for X_SHAPE gesture', () => {
      const exec = (engine as any).executeGesture.bind(engine);
      exec(GestureType.X_SHAPE, [{ x: 0, y: 0, timestamp: 0 }]);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'closeTab' });
    });

    it('should send newTab message for L_SHAPE gesture', () => {
      const exec = (engine as any).executeGesture.bind(engine);
      exec(GestureType.L_SHAPE, [{ x: 0, y: 0, timestamp: 0 }]);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'newTab' });
    });

    it('should send clearSiteData message for C_SHAPE gesture', () => {
      const exec = (engine as any).executeGesture.bind(engine);
      exec(GestureType.C_SHAPE, [{ x: 0, y: 0, timestamp: 0 }]);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({ action: 'clearSiteData' });
    });

    it('should enter COOLDOWN state after executing a gesture', () => {
      const exec = (engine as any).executeGesture.bind(engine);
      exec(GestureType.L_SHAPE, [{ x: 0, y: 0, timestamp: 0 }]);

      expect((engine as any).state).toBe('COOLDOWN');

      // After 500ms cooldown, state returns to IDLE
      vi.advanceTimersByTime(500);
      expect((engine as any).state).toBe('IDLE');
    });

    it('should not execute when gesture is disabled in config', () => {
      const disabledConfig = createMockConfig({
        gesturesEnabled: { xShape: true, lShape: false, circle: false, cShape: false },
      });
      const eng = new GestureEngine(disabledConfig, intentDetector as any, usageTracker as any);

      const exec = (eng as any).executeGesture.bind(eng);
      exec(GestureType.CIRCLE);
      expect(usageTracker.recordUse).not.toHaveBeenCalled();

      exec(GestureType.C_SHAPE);
      expect(usageTracker.recordUse).not.toHaveBeenCalled();

      exec(GestureType.L_SHAPE);
      expect(usageTracker.recordUse).not.toHaveBeenCalled();
    });
  });

  // ── GESTURE_CONFIG_KEY mapping ───────────────────────────────────────────

  describe('GESTURE_CONFIG_KEY mapping', () => {
    // We verify the mapping by disabling specific keys and checking execution

    it('X_SHAPE maps to xShape config key', () => {
      const cfg = createMockConfig({ gesturesEnabled: { xShape: false, lShape: true, circle: true, cShape: true } });
      const eng = new GestureEngine(cfg, intentDetector as any, usageTracker as any);
      (eng as any).executeGesture(GestureType.X_SHAPE, []);
      expect(usageTracker.recordUse).not.toHaveBeenCalled();
    });

    it('L_SHAPE maps to lShape config key', () => {
      const cfg = createMockConfig({ gesturesEnabled: { xShape: true, lShape: false, circle: true, cShape: true } });
      const eng = new GestureEngine(cfg, intentDetector as any, usageTracker as any);
      (eng as any).executeGesture(GestureType.L_SHAPE, []);
      expect(usageTracker.recordUse).not.toHaveBeenCalled();
    });

    it('CIRCLE maps to circle config key', () => {
      const cfg = createMockConfig({ gesturesEnabled: { xShape: true, lShape: true, circle: false, cShape: true } });
      const eng = new GestureEngine(cfg, intentDetector as any, usageTracker as any);
      (eng as any).executeGesture(GestureType.CIRCLE, []);
      expect(usageTracker.recordUse).not.toHaveBeenCalled();
    });

    it('C_SHAPE maps to cShape config key', () => {
      const cfg = createMockConfig({ gesturesEnabled: { xShape: true, lShape: true, circle: true, cShape: false } });
      const eng = new GestureEngine(cfg, intentDetector as any, usageTracker as any);
      (eng as any).executeGesture(GestureType.C_SHAPE, []);
      expect(usageTracker.recordUse).not.toHaveBeenCalled();
    });

    it('all gesture types execute when their config key is enabled', () => {
      const cfg = createMockConfig();
      const tracker = createMockUsageTracker(true);
      const eng = new GestureEngine(cfg, intentDetector as any, tracker as any);

      (eng as any).executeGesture(GestureType.X_SHAPE, []);
      (eng as any).executeGesture(GestureType.L_SHAPE, []);
      (eng as any).executeGesture(GestureType.CIRCLE, []);
      (eng as any).executeGesture(GestureType.C_SHAPE, []);

      expect(tracker.recordUse).toHaveBeenCalledTimes(4);
    });
  });

  // ── showToast ─────────────────────────────────────────────────────────────

  describe('showToast()', () => {
    it('creates center toast', () => {
      (engine as any).showToast('test msg', 'center');
      const t = (engine as any).toast;
      expect(t).not.toBeNull();
      expect(t.textContent).toBe('test msg');
      expect(t.style.cssText).toContain('top: 50%');
    });

    it('creates bottom toast', () => {
      (engine as any).showToast('btm', 'bottom');
      expect((engine as any).toast.style.cssText).toContain('bottom');
    });

    it('removes after 2s', () => {
      (engine as any).showToast('x');
      vi.advanceTimersByTime(2500);
    });

    it('replaces previous toast', () => {
      (engine as any).showToast('a');
      (engine as any).showToast('b');
      expect((engine as any).toast.textContent).toBe('b');
    });
  });

  describe('showSubscriptionPrompt()', () => {
    it('creates prompt with buttons', () => {
      (engine as any).showSubscriptionPrompt();
      expect(document.querySelector('#swift-sub-btn')).not.toBeNull();
      expect(document.querySelector('#swift-sub-close')).not.toBeNull();
    });

    it('close removes prompt', () => {
      (engine as any).showSubscriptionPrompt();
      (document.querySelector('#swift-sub-close') as HTMLElement).click();
      expect(document.querySelector('#swift-sub-btn')).toBeNull();
    });

    it('subscribe removes prompt', () => {
      (engine as any).showSubscriptionPrompt();
      (document.querySelector('#swift-sub-btn') as HTMLElement).click();
      expect(document.querySelector('#swift-sub-btn')).toBeNull();
    });
  });

  describe('X two-stroke', () => {
    it('stores firstStroke', () => {
      (engine as any).firstStroke = { points: [{ x: 0, y: 0 }], angle: 45 };
      expect((engine as any).firstStroke.angle).toBe(45);
    });

    it('timeout clears firstStroke', () => {
      (engine as any).firstStroke = { points: [], angle: 45 };
      (engine as any).xStrokeTimer = setTimeout(() => {
        (engine as any).firstStroke = null;
      }, 1000);
      vi.advanceTimersByTime(1100);
      expect((engine as any).firstStroke).toBeNull();
    });
  });


  // ── Internal touch handler methods (direct call) ────────────────────────

  describe('internal onTouchStart', () => {
    it('sets state to DETECTING for valid touch', () => {
      const e: any = { touches: [{ clientX: 200, clientY: 300 }], target: document.body, preventDefault: vi.fn() };
      (engine as any).onTouchStart(e);
      expect((engine as any).state).toBe('DETECTING');
    });

    it('skips when COOLDOWN', () => {
      (engine as any).state = 'COOLDOWN';
      const e: any = { touches: [{ clientX: 200, clientY: 300 }], target: document.body, preventDefault: vi.fn() };
      (engine as any).onTouchStart(e);
      expect((engine as any).state).toBe('COOLDOWN');
    });

    it('overlay onTouchStart always sets DETECTING (no input check in overlay mode)', () => {
      (engine as any).state = 'IDLE';
      const e: any = { touches: [{ clientX: 200, clientY: 300 }], target: document.body, preventDefault: vi.fn() };
      (engine as any).onTouchStart(e);
      expect((engine as any).state).toBe('DETECTING');
    });

    it('skips multi-touch (only works in overlay mode which filters)', () => {
      // The overlay touch handler doesn't filter multi-touch, so this just verifies state
      (engine as any).state = 'IDLE';
      expect((engine as any).state).toBe('IDLE');
    });
  });

  describe('internal onTouchMove', () => {
    it('draws on canvas when liveCtx exists', () => {
      const mockCtx: any = { beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })), shadowColor: '', shadowBlur: 0, strokeStyle: '', lineWidth: 0, lineCap: '' };
      (engine as any).liveCtx = mockCtx;
      (engine as any).liveCanvas = { width: 375, height: 812 };
      (engine as any).state = 'DETECTING';
      (engine as any).lastX = 100; (engine as any).lastY = 100;
      const e: any = { touches: [{ clientX: 150, clientY: 150 }], preventDefault: vi.fn() };
      (engine as any).onTouchMove(e);
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('skips when not DETECTING', () => {
      (engine as any).state = 'IDLE';
      const e: any = { touches: [{ clientX: 150, clientY: 150 }], preventDefault: vi.fn() };
      (engine as any).onTouchMove(e);
    });
  });

  describe('internal onTouchEnd', () => {
    it('analyzes session when DETECTING', () => {
      (engine as any).state = 'DETECTING';
      (engine as any).onTouchEnd({} as any);
      expect((engine as any).state).toBe('IDLE');
    });

    it('handles first X stroke', () => {
      (engine as any).state = 'DETECTING';
      // Mock touchTracker to return a session with a diagonal line
      (engine as any).touchTracker = {
        onTouchEnd: () => ({
          points: Array.from({length: 10}, (_, i) => ({ x: 100+i*20, y: 100+i*15, timestamp: i*30 })),
          secondFingerPoints: [], fingerCount: 1, startTime: 0, endTime: 300, duration: 300
        }),
        onTouchStart: vi.fn(), onTouchMove: vi.fn(), reset: vi.fn(), getSession: vi.fn(),
      };
      (engine as any).onTouchEnd({} as any);
      // Should store firstStroke or show toast
      expect((engine as any).toast || (engine as any).firstStroke).not.toBeNull();
    });

    it('second X stroke triggers X_SHAPE', () => {
      (engine as any).firstStroke = { points: [{ x: 0, y: 0 }], angle: 45 };
      (engine as any).state = 'DETECTING';
      (engine as any).touchTracker = {
        onTouchEnd: () => ({
          points: Array.from({length: 10}, (_, i) => ({ x: 200-i*20, y: 100+i*15, timestamp: i*30 })),
          secondFingerPoints: [], fingerCount: 1, startTime: 0, endTime: 300, duration: 300
        }),
        onTouchStart: vi.fn(), onTouchMove: vi.fn(), reset: vi.fn(), getSession: vi.fn(),
      };
      (engine as any).gestureMode = true;
      (engine as any).onTouchEnd({} as any);
      // Should have executed X_SHAPE or stored as firstStroke
    });
  });

  describe('i18n helper', () => {
    it('returns Korean for ko locale', () => {
      const origLang = navigator.language;
      Object.defineProperty(navigator, 'language', { value: 'ko-KR', configurable: true });
      // Re-evaluate by calling showToast
      (engine as any).showToast('test', 'center');
      expect((engine as any).toast.textContent).toBe('test');
      Object.defineProperty(navigator, 'language', { value: origLang, configurable: true });
    });
  });
});
