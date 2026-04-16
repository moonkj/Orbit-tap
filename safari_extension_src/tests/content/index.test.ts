import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock all dependencies before importing SwiftExtension
vi.mock('../../src/content/gesture/GestureEngine', () => ({
  GestureEngine: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    activateGestureMode: vi.fn(),
  })),
}));

vi.mock('../../src/content/ui/FloatingButton', () => ({
  FloatingButton: vi.fn().mockImplementation(() => ({
    mount: vi.fn(),
    unmount: vi.fn(),
    updateConfig: vi.fn(),
    setGestureActivator: vi.fn(),
    setUsageTracker: vi.fn(),
  })),
}));

vi.mock('../../src/content/intent/IntentDetector', () => ({
  IntentDetector: vi.fn().mockImplementation(() => ({
    dispose: vi.fn(),
  })),
}));

vi.mock('../../src/content/exclusion/ExclusionManager', () => ({
  ExclusionManager: vi.fn().mockImplementation(() => ({
    shouldExclude: vi.fn().mockReturnValue(false),
  })),
}));

vi.mock('../../src/content/config/ConfigBridge', () => ({
  ConfigBridge: vi.fn().mockImplementation(() => ({
    loadConfig: vi.fn().mockResolvedValue({
      masterEnabled: true,
      floatingButtonEnabled: true,
      sensitivity: 50,
      buttonSize: 'medium',
      buttonOpacity: 90,
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
      gesturesEnabled: {},
    }),
    onConfigChange: vi.fn(),
    startListening: vi.fn(),
    getConfig: vi.fn(),
  })),
}));

vi.mock('../../src/content/usage/UsageTracker', () => ({
  UsageTracker: vi.fn().mockImplementation(() => ({
    load: vi.fn().mockResolvedValue(undefined),
    startListening: vi.fn(),
    recordUse: vi.fn(),
  })),
}));

import { GestureEngine } from '../../src/content/gesture/GestureEngine';
import { FloatingButton } from '../../src/content/ui/FloatingButton';
import { IntentDetector } from '../../src/content/intent/IntentDetector';
import { ExclusionManager } from '../../src/content/exclusion/ExclusionManager';
import { ConfigBridge } from '../../src/content/config/ConfigBridge';
import { UsageTracker } from '../../src/content/usage/UsageTracker';

/**
 * SwiftExtension is not exported from content/index.ts. The module auto-runs
 * at import time. To test it properly, we extract the class definition.
 * We'll re-import the module after mocking to test the auto-initialization path,
 * and also construct the class manually for unit tests.
 *
 * Since the class is not exported, we test via side effects of importing the module.
 * However, the auto-init only runs when window.self === window.top, which is true in jsdom.
 */

describe('content/index.ts — SwiftExtension', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  afterEach(() => {
    document.documentElement.innerHTML = '';
  });

  describe('SwiftExtension constructor', () => {
    it('creates ConfigBridge and UsageTracker', async () => {
      vi.resetModules();
      await import('../../src/content/index');

      expect(ConfigBridge).toHaveBeenCalledTimes(1);
      expect(UsageTracker).toHaveBeenCalledTimes(1);
    });
  });

  describe('init() with masterEnabled=true', () => {
    it('loads config and creates GestureEngine', async () => {
      vi.resetModules();

      // Wait for module load + init
      await import('../../src/content/index');

      // Allow async init to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(ConfigBridge).toHaveBeenCalled();
      const bridgeInstance = vi.mocked(ConfigBridge).mock.results[0].value;
      expect(bridgeInstance.loadConfig).toHaveBeenCalled();

      expect(GestureEngine).toHaveBeenCalled();
      const engineInstance = vi.mocked(GestureEngine).mock.results[0].value;
      expect(engineInstance.start).toHaveBeenCalled();
    });

    it('creates FloatingButton when floatingButtonEnabled', async () => {
      vi.resetModules();

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(FloatingButton).toHaveBeenCalled();
      const fbInstance = vi.mocked(FloatingButton).mock.results[0].value;
      expect(fbInstance.mount).toHaveBeenCalled();
      expect(fbInstance.setUsageTracker).toHaveBeenCalled();
      expect(fbInstance.setGestureActivator).toHaveBeenCalled();
    });

    it('creates IntentDetector and ExclusionManager', async () => {
      vi.resetModules();

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(IntentDetector).toHaveBeenCalled();
      expect(ExclusionManager).toHaveBeenCalled();
    });

    it('starts listening for config changes', async () => {
      vi.resetModules();

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      const bridgeInstance = vi.mocked(ConfigBridge).mock.results[0].value;
      expect(bridgeInstance.onConfigChange).toHaveBeenCalled();
      expect(bridgeInstance.startListening).toHaveBeenCalled();
    });

    it('loads UsageTracker', async () => {
      vi.resetModules();

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      const trackerInstance = vi.mocked(UsageTracker).mock.results[0].value;
      expect(trackerInstance.load).toHaveBeenCalled();
      expect(trackerInstance.startListening).toHaveBeenCalled();
    });
  });

  describe('init() with masterEnabled=false', () => {
    it('does not create GestureEngine when masterEnabled is false', async () => {
      vi.resetModules();
      vi.mocked(ConfigBridge).mockImplementation(() => ({
        loadConfig: vi.fn().mockResolvedValue({
          masterEnabled: false,
          floatingButtonEnabled: true,
          sensitivity: 50,
          buttonSize: 'medium',
          buttonOpacity: 90,
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
          gesturesEnabled: {},
        }),
        onConfigChange: vi.fn(),
        startListening: vi.fn(),
        getConfig: vi.fn(),
      }) as any);

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(GestureEngine).not.toHaveBeenCalled();
    });

    it('does not create FloatingButton when masterEnabled is false', async () => {
      vi.resetModules();
      vi.mocked(ConfigBridge).mockImplementation(() => ({
        loadConfig: vi.fn().mockResolvedValue({
          masterEnabled: false,
          floatingButtonEnabled: true,
          sensitivity: 50,
          buttonSize: 'medium',
          buttonOpacity: 90,
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
          gesturesEnabled: {},
        }),
        onConfigChange: vi.fn(),
        startListening: vi.fn(),
        getConfig: vi.fn(),
      }) as any);

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(FloatingButton).not.toHaveBeenCalled();
    });
  });

  describe('init() with floatingButtonEnabled=false', () => {
    it('creates GestureEngine but not FloatingButton', async () => {
      vi.resetModules();
      vi.mocked(ConfigBridge).mockImplementation(() => ({
        loadConfig: vi.fn().mockResolvedValue({
          masterEnabled: true,
          floatingButtonEnabled: false,
          sensitivity: 50,
          buttonSize: 'medium',
          buttonOpacity: 90,
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
          gesturesEnabled: {},
        }),
        onConfigChange: vi.fn(),
        startListening: vi.fn(),
        getConfig: vi.fn(),
      }) as any);

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(GestureEngine).toHaveBeenCalled();
      expect(FloatingButton).not.toHaveBeenCalled();
    });
  });

  describe('init() skips when shouldExclude returns true', () => {
    it('does not create GestureEngine or FloatingButton', async () => {
      vi.resetModules();
      vi.mocked(ExclusionManager).mockImplementation(() => ({
        shouldExclude: vi.fn().mockReturnValue(true),
      }) as any);

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(ExclusionManager).toHaveBeenCalled();
      expect(GestureEngine).not.toHaveBeenCalled();
      expect(FloatingButton).not.toHaveBeenCalled();
    });
  });

  describe('config change handling', () => {
    it('onConfigChange callback is registered', async () => {
      vi.resetModules();

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      const bridgeInstance = vi.mocked(ConfigBridge).mock.results[0].value;
      expect(bridgeInstance.onConfigChange).toHaveBeenCalledWith(expect.any(Function));
    });

    it('config change with masterEnabled=true restarts GestureEngine', async () => {
      vi.resetModules();

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      const bridgeInstance = vi.mocked(ConfigBridge).mock.results[0].value;
      const changeCallback = vi.mocked(bridgeInstance.onConfigChange).mock.calls[0][0];

      vi.clearAllMocks();

      // Trigger config change
      changeCallback({
        masterEnabled: true,
        floatingButtonEnabled: true,
        sensitivity: 50,
        buttonSize: 'medium',
        buttonOpacity: 90,
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
        gesturesEnabled: {},
      });

      // A new GestureEngine should be created
      expect(GestureEngine).toHaveBeenCalled();
    });

    it('config change with masterEnabled=false stops GestureEngine', async () => {
      vi.resetModules();

      await import('../../src/content/index');
      await new Promise(resolve => setTimeout(resolve, 10));

      const bridgeInstance = vi.mocked(ConfigBridge).mock.results[0].value;
      const changeCallback = vi.mocked(bridgeInstance.onConfigChange).mock.calls[0][0];

      // The initial GestureEngine instance
      const initialEngine = vi.mocked(GestureEngine).mock.results[0].value;

      // Trigger config change with masterEnabled=false
      changeCallback({
        masterEnabled: false,
        floatingButtonEnabled: false,
        sensitivity: 50,
        buttonSize: 'medium',
        buttonOpacity: 90,
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
        gesturesEnabled: {},
      });

      expect(initialEngine.stop).toHaveBeenCalled();
    });
  });
});
