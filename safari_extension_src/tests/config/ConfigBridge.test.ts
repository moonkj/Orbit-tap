import { ConfigBridge } from '../../src/content/config/ConfigBridge';

const storageMock = (globalThis as any).__storageMock as Record<string, any>;

describe('ConfigBridge', () => {
  let bridge: ConfigBridge;

  beforeEach(() => {
    Object.keys(storageMock).forEach(k => delete storageMock[k]);
    vi.clearAllMocks();
    bridge = new ConfigBridge();
  });

  describe('loadConfig()', () => {
    it('returns defaults when storage is empty', async () => {
      const config = await bridge.loadConfig();
      expect(config.masterEnabled).toBe(true);
      expect(config.sensitivity).toBe(50);
      expect(config.gesturesEnabled.xShape).toBe(true);
    });

    it('reads from storage', async () => {
      storageMock['gestureConfig'] = { masterEnabled: false, sensitivity: 80 };
      const config = await bridge.loadConfig();
      expect(config.masterEnabled).toBe(false);
      expect(config.sensitivity).toBe(80);
    });

    it('merges with defaults', async () => {
      storageMock['gestureConfig'] = { sensitivity: 30 };
      const config = await bridge.loadConfig();
      expect(config.sensitivity).toBe(30);
      expect(config.masterEnabled).toBe(true);
    });
  });

  describe('getConfig()', () => {
    it('returns defaults before load', () => {
      expect(bridge.getConfig().masterEnabled).toBe(true);
    });

    it('returns loaded config', async () => {
      storageMock['gestureConfig'] = { masterEnabled: false };
      await bridge.loadConfig();
      expect(bridge.getConfig().masterEnabled).toBe(false);
    });
  });

  describe('onConfigChange()', () => {
    it('registers callback', () => {
      const cb = vi.fn();
      bridge.onConfigChange(cb);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('startListening()', () => {
    it('registers listeners', () => {
      bridge.startListening();
      expect(browser.runtime.onMessage.addListener).toHaveBeenCalled();
      expect(browser.storage.onChanged.addListener).toHaveBeenCalled();
    });
  });
});
