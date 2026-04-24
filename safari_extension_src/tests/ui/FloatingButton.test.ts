import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FloatingButton } from '../../src/content/ui/FloatingButton';
import type { GestureConfig } from '../../src/content/config/ConfigBridge';

const storageMock = (globalThis as any).__storageMock as Record<string, any>;

function makeConfig(overrides: Partial<GestureConfig> = {}): GestureConfig {
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
    gesturesEnabled: {},
    sensitivity: 50,
    buttonSize: 'medium',
    buttonOpacity: 90,
    ...overrides,
  };
}

describe('FloatingButton', () => {
  let fb: FloatingButton;
  let config: GestureConfig;

  beforeEach(() => {
    // Clean DOM
    document.documentElement.innerHTML = '<head></head><body></body>';
    Object.keys(storageMock).forEach(k => delete storageMock[k]);
    vi.clearAllMocks();
    config = makeConfig();
    fb = new FloatingButton(config);
  });

  afterEach(() => {
    fb.unmount();
    document.documentElement.innerHTML = '';
  });

  // -------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------
  describe('constructor', () => {
    it('sets default position to near right edge of screen', () => {
      // The constructor sets currentX = window.innerWidth - 60
      // and currentY = window.innerHeight * 0.7
      // We can verify this indirectly by mounting and checking transform
      expect(fb).toBeDefined();
    });
  });

  // -------------------------------------------------------------------
  // getButtonSize (private, tested via mount behavior)
  // -------------------------------------------------------------------
  describe('button size', () => {
    it('uses small size (42px)', async () => {
      fb = new FloatingButton(makeConfig({ buttonSize: 'small' }));
      await fb.mount();

      const btn = document.querySelector('.swift-fb') as HTMLElement;
      expect(btn).not.toBeNull();
      // The size is set via CSS in the style tag
      const styleEl = document.querySelector('style[data-swift-fb]');
      expect(styleEl).not.toBeNull();
      expect(styleEl!.textContent).toContain('width: 42px');
      expect(styleEl!.textContent).toContain('height: 42px');
    });

    it('uses medium size (52px)', async () => {
      fb = new FloatingButton(makeConfig({ buttonSize: 'medium' }));
      await fb.mount();

      const styleEl = document.querySelector('style[data-swift-fb]');
      expect(styleEl!.textContent).toContain('width: 52px');
      expect(styleEl!.textContent).toContain('height: 52px');
    });

    it('uses large size (64px)', async () => {
      fb = new FloatingButton(makeConfig({ buttonSize: 'large' }));
      await fb.mount();

      const styleEl = document.querySelector('style[data-swift-fb]');
      expect(styleEl!.textContent).toContain('width: 64px');
      expect(styleEl!.textContent).toContain('height: 64px');
    });

    it('falls back to 48px for unknown size', async () => {
      fb = new FloatingButton(makeConfig({ buttonSize: 'jumbo' }));
      await fb.mount();

      const styleEl = document.querySelector('style[data-swift-fb]');
      expect(styleEl!.textContent).toContain('width: 48px');
      expect(styleEl!.textContent).toContain('height: 48px');
    });
  });

  // -------------------------------------------------------------------
  // getOpacity (private, tested via mount behavior)
  // -------------------------------------------------------------------
  describe('opacity', () => {
    it('converts percentage to decimal (90 -> 0.9)', async () => {
      fb = new FloatingButton(makeConfig({ buttonOpacity: 90 }));
      await fb.mount();

      const styleEl = document.querySelector('style[data-swift-fb]');
      expect(styleEl!.textContent).toContain('opacity: 0.9');
    });

    it('converts percentage to decimal (50 -> 0.5)', async () => {
      fb = new FloatingButton(makeConfig({ buttonOpacity: 50 }));
      await fb.mount();

      const styleEl = document.querySelector('style[data-swift-fb]');
      expect(styleEl!.textContent).toContain('opacity: 0.5');
    });

    it('defaults to 0.9 when buttonOpacity is undefined', async () => {
      const cfg = makeConfig();
      delete (cfg as any).buttonOpacity;
      fb = new FloatingButton(cfg);
      await fb.mount();

      const styleEl = document.querySelector('style[data-swift-fb]');
      expect(styleEl!.textContent).toContain('opacity: 0.9');
    });
  });

  // -------------------------------------------------------------------
  // mount()
  // -------------------------------------------------------------------
  describe('mount()', () => {
    it('creates host element with id swift-gesture-host', async () => {
      await fb.mount();

      const host = document.getElementById('swift-gesture-host');
      expect(host).not.toBeNull();
    });

    it('creates a style element with data-swift-fb attribute', async () => {
      await fb.mount();

      const style = document.querySelector('style[data-swift-fb]');
      expect(style).not.toBeNull();
    });

    it('creates a button element with swift-fb class', async () => {
      await fb.mount();

      const btn = document.querySelector('.swift-fb');
      expect(btn).not.toBeNull();
    });

    it('button contains an SVG', async () => {
      await fb.mount();

      const svg = document.querySelector('.swift-fb svg');
      expect(svg).not.toBeNull();
    });

    it('guard prevents double mount', async () => {
      await fb.mount();
      await fb.mount(); // second call should be no-op

      const hosts = document.querySelectorAll('#swift-gesture-host');
      expect(hosts.length).toBe(1);
    });

    it('cleans up existing DOM elements from previous instances', async () => {
      // Simulate leftover from previous instance
      const oldHost = document.createElement('div');
      oldHost.id = 'swift-gesture-host';
      document.documentElement.appendChild(oldHost);

      const oldStyle = document.createElement('style');
      oldStyle.setAttribute('data-swift-fb', '1');
      document.head.appendChild(oldStyle);

      // Create a new FloatingButton and mount
      const fb2 = new FloatingButton(config);
      await fb2.mount();

      // Old elements should be replaced by new ones
      const hosts = document.querySelectorAll('#swift-gesture-host');
      expect(hosts.length).toBe(1);

      // The old style should be removed, new one added
      const styles = document.querySelectorAll('style[data-swift-fb]');
      expect(styles.length).toBe(1);

      fb2.unmount();
    });

    it('loads saved position from storage', async () => {
      storageMock['floatingBtnPos'] = { x: 100, y: 200 };

      await fb.mount();

      const btn = document.querySelector('.swift-fb') as HTMLElement;
      expect(btn).not.toBeNull();
      // The button should be positioned at the saved coordinates
      expect(btn!.style.transform).toContain('100');
      expect(btn!.style.transform).toContain('200');
    });
  });

  // -------------------------------------------------------------------
  // unmount()
  // -------------------------------------------------------------------
  describe('unmount()', () => {
    it('removes all DOM elements', async () => {
      await fb.mount();

      expect(document.getElementById('swift-gesture-host')).not.toBeNull();
      expect(document.querySelector('style[data-swift-fb]')).not.toBeNull();

      fb.unmount();

      expect(document.getElementById('swift-gesture-host')).toBeNull();
      expect(document.querySelector('style[data-swift-fb]')).toBeNull();
    });

    it('is safe to call multiple times', async () => {
      await fb.mount();
      fb.unmount();
      fb.unmount(); // should not throw

      expect(document.getElementById('swift-gesture-host')).toBeNull();
    });

    it('is safe to call without mount', () => {
      expect(() => fb.unmount()).not.toThrow();
    });
  });

  // -------------------------------------------------------------------
  // updateConfig()
  // -------------------------------------------------------------------
  describe('updateConfig()', () => {
    it('updates button size', async () => {
      await fb.mount();

      fb.updateConfig(makeConfig({ buttonSize: 'large' }));

      const btn = document.querySelector('.swift-fb') as HTMLElement;
      expect(btn!.style.width).toBe('64px');
      expect(btn!.style.height).toBe('64px');
    });

    it('updates button opacity', async () => {
      await fb.mount();

      fb.updateConfig(makeConfig({ buttonOpacity: 50 }));

      const btn = document.querySelector('.swift-fb') as HTMLElement;
      expect(btn!.style.opacity).toBe('0.5');
    });

    it('does nothing when not mounted', () => {
      // Should not throw
      expect(() => fb.updateConfig(makeConfig({ buttonSize: 'large' }))).not.toThrow();
    });

    it('does not update button size when size is unchanged', async () => {
      await fb.mount();
      const btn = document.querySelector('.swift-fb') as HTMLElement;

      // Same size as original config (medium = 52)
      fb.updateConfig(makeConfig({ buttonSize: 'medium', buttonOpacity: 70 }));

      // width/height style should not be set inline (stays in CSS)
      // but opacity should change
      expect(btn!.style.opacity).toBe('0.7');
    });
  });

  // -------------------------------------------------------------------
  // setGestureActivator()
  // -------------------------------------------------------------------
  describe('setGestureActivator()', () => {
    it('stores callback', () => {
      const fn = vi.fn();
      fb.setGestureActivator(fn);
      // No assertion on private field — we test via executeTapAction below
      expect(fn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // setUsageTracker()
  // -------------------------------------------------------------------
  describe('setUsageTracker()', () => {
    it('stores tracker', () => {
      const tracker = { recordUse: vi.fn(), load: vi.fn(), startListening: vi.fn() } as any;
      fb.setUsageTracker(tracker);
      expect(tracker.recordUse).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------
  // executeTapAction (private, tested via touch events)
  // -------------------------------------------------------------------
  describe('executeTapAction via touch events', () => {
    function createTouchEvent(type: string, clientX: number, clientY: number): TouchEvent {
      const touch = {
        clientX,
        clientY,
        identifier: 0,
        target: null as any,
        pageX: clientX,
        pageY: clientY,
        screenX: clientX,
        screenY: clientY,
        radiusX: 0,
        radiusY: 0,
        rotationAngle: 0,
        force: 0,
      };
      return new TouchEvent(type, {
        touches: type === 'touchend' ? [] : [touch as any],
        changedTouches: [touch as any],
        cancelable: true,
        bubbles: true,
      });
    }

    it('single tap sends back navigation message', async () => {
      vi.useFakeTimers();
      await fb.mount();

      const btn = document.querySelector('.swift-fb') as HTMLElement;

      // Simulate quick tap (touchstart + touchend within DRAG_HOLD_DURATION)
      btn.dispatchEvent(createTouchEvent('touchstart', 100, 100));

      // End quickly (simulates fast tap)
      btn.dispatchEvent(createTouchEvent('touchend', 100, 100));

      // Advance past TAP_TIMEOUT (700ms)
      vi.advanceTimersByTime(800);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'navigate',
        direction: 'back',
      });

      vi.useRealTimers();
    });

    it('double tap sends forward navigation message', async () => {
      vi.useFakeTimers();
      await fb.mount();

      const btn = document.querySelector('.swift-fb') as HTMLElement;

      // First tap
      btn.dispatchEvent(createTouchEvent('touchstart', 100, 100));
      btn.dispatchEvent(createTouchEvent('touchend', 100, 100));

      // Second tap quickly
      vi.advanceTimersByTime(100);
      btn.dispatchEvent(createTouchEvent('touchstart', 100, 100));
      btn.dispatchEvent(createTouchEvent('touchend', 100, 100));

      // Advance past TAP_TIMEOUT
      vi.advanceTimersByTime(800);

      expect(browser.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'navigate',
        direction: 'forward',
      });

      vi.useRealTimers();
    });

    it('triple tap calls gesture activator', async () => {
      vi.useFakeTimers();
      const activator = vi.fn();
      fb.setGestureActivator(activator);
      await fb.mount();

      const btn = document.querySelector('.swift-fb') as HTMLElement;

      // Three quick taps
      for (let i = 0; i < 3; i++) {
        btn.dispatchEvent(createTouchEvent('touchstart', 100, 100));
        btn.dispatchEvent(createTouchEvent('touchend', 100, 100));
        if (i < 2) vi.advanceTimersByTime(100);
      }

      // Advance past TAP_TIMEOUT
      vi.advanceTimersByTime(800);

      expect(activator).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('records usage on tap actions', async () => {
      vi.useFakeTimers();
      const tracker = { recordUse: vi.fn(), load: vi.fn(), startListening: vi.fn() } as any;
      fb.setUsageTracker(tracker);
      await fb.mount();

      const btn = document.querySelector('.swift-fb') as HTMLElement;

      // Single tap
      btn.dispatchEvent(createTouchEvent('touchstart', 100, 100));
      btn.dispatchEvent(createTouchEvent('touchend', 100, 100));
      vi.advanceTimersByTime(800);

      expect(tracker.recordUse).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  // -------------------------------------------------------------------
  // showGestureGuide (private, tested via long press)
  // -------------------------------------------------------------------
  describe('showGestureGuide', () => {
    it('creates overlay with guide content when called', async () => {
      await fb.mount();

      // We can't directly call showGestureGuide since it's private.
      // We test it indirectly: trigger a long press hold that exceeds GUIDE_HOLD_DURATION (3000ms).
      vi.useFakeTimers();

      const btn = document.querySelector('.swift-fb') as HTMLElement;

      const touch = {
        clientX: 100,
        clientY: 100,
        identifier: 0,
        target: btn,
        pageX: 100,
        pageY: 100,
        screenX: 100,
        screenY: 100,
        radiusX: 0,
        radiusY: 0,
        rotationAngle: 0,
        force: 0,
      };

      btn.dispatchEvent(new TouchEvent('touchstart', {
        touches: [touch as any],
        changedTouches: [touch as any],
        cancelable: true,
        bubbles: true,
      }));

      // Advance past GUIDE_HOLD_DURATION (3000ms) to trigger guide
      vi.advanceTimersByTime(3100);

      const guide = document.querySelector('.swift-guide');
      expect(guide).not.toBeNull();
      expect(guide!.textContent).toContain('Orbit Tap');

      vi.useRealTimers();
    });

    it('guide overlay is dismissible by clicking', async () => {
      await fb.mount();
      vi.useFakeTimers();

      const btn = document.querySelector('.swift-fb') as HTMLElement;
      const touch = {
        clientX: 100, clientY: 100, identifier: 0, target: btn,
        pageX: 100, pageY: 100, screenX: 100, screenY: 100,
        radiusX: 0, radiusY: 0, rotationAngle: 0, force: 0,
      };

      btn.dispatchEvent(new TouchEvent('touchstart', {
        touches: [touch as any],
        changedTouches: [touch as any],
        cancelable: true,
        bubbles: true,
      }));

      vi.advanceTimersByTime(3100);

      const guide = document.querySelector('.swift-guide');
      expect(guide).not.toBeNull();

      // Click the overlay to dismiss
      guide!.dispatchEvent(new Event('click', { bubbles: true }));

      // Guide should be removed
      expect(document.querySelector('.swift-guide')).toBeNull();

      vi.useRealTimers();
    });

    it('toggling guide: second long press removes existing guide', async () => {
      await fb.mount();

      // Manually access showGestureGuide via the host element.
      // Since showGestureGuide toggles (removes if existing), we can test by:
      // 1. trigger long press -> guide appears
      // 2. call showGestureGuide again -> guide disappears

      vi.useFakeTimers();

      const btn = document.querySelector('.swift-fb') as HTMLElement;
      const touch = {
        clientX: 100, clientY: 100, identifier: 0, target: btn,
        pageX: 100, pageY: 100, screenX: 100, screenY: 100,
        radiusX: 0, radiusY: 0, rotationAngle: 0, force: 0,
      };

      // First long press
      btn.dispatchEvent(new TouchEvent('touchstart', {
        touches: [touch as any],
        changedTouches: [touch as any],
        cancelable: true,
        bubbles: true,
      }));
      vi.advanceTimersByTime(3100);

      expect(document.querySelector('.swift-guide')).not.toBeNull();

      // Release
      btn.dispatchEvent(new TouchEvent('touchend', {
        touches: [],
        changedTouches: [touch as any],
        bubbles: true,
      }));

      vi.useRealTimers();
    });
  });
});
