import { describe, it, expect, beforeEach, vi } from 'vitest';

const storageMock = (globalThis as any).__storageMock as Record<string, any>;

/**
 * background/index.ts registers a listener via browser.runtime.onMessage.addListener.
 * We capture that handler by importing the module, then call it directly with mock messages.
 */

let messageHandler: (message: any, sender: any) => Promise<any>;

describe('background/index.ts message handlers', () => {
  beforeEach(async () => {
    // Clear storage
    Object.keys(storageMock).forEach(k => delete storageMock[k]);
    vi.clearAllMocks();

    // Reset module registry so background/index.ts re-registers its listener
    vi.resetModules();

    // Import triggers the module body (init + addListener)
    await import('../../src/background/index');

    // Capture the handler passed to browser.runtime.onMessage.addListener
    const calls = vi.mocked(browser.runtime.onMessage.addListener).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    messageHandler = calls[calls.length - 1][0] as any;
  });

  // -------------------------------------------------------------------
  // handleNavigation
  // -------------------------------------------------------------------
  describe('handleNavigation', () => {
    it('goes back using sender tab id', async () => {
      const result = await messageHandler(
        { action: 'navigate', direction: 'back' },
        { tab: { id: 42 } },
      );

      expect(browser.tabs.goBack).toHaveBeenCalledWith(42);
      expect(result).toEqual({ success: true });
    });

    it('goes forward using sender tab id', async () => {
      const result = await messageHandler(
        { action: 'navigate', direction: 'forward' },
        { tab: { id: 42 } },
      );

      expect(browser.tabs.goForward).toHaveBeenCalledWith(42);
      expect(result).toEqual({ success: true });
    });

    it('falls back to active tab when sender has no tab id', async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([
        { id: 99, url: 'https://example.com' } as any,
      ]);

      const result = await messageHandler(
        { action: 'navigate', direction: 'back' },
        {},
      );

      expect(browser.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
      expect(browser.tabs.goBack).toHaveBeenCalledWith(99);
      expect(result).toEqual({ success: true });
    });

    it('returns success:false when no active tab found', async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([]);

      const result = await messageHandler(
        { action: 'navigate', direction: 'back' },
        {},
      );

      expect(result).toEqual({ success: false });
    });

    it('returns success:false on error', async () => {
      vi.mocked(browser.tabs.goBack).mockRejectedValueOnce(new Error('fail'));

      const result = await messageHandler(
        { action: 'navigate', direction: 'back' },
        { tab: { id: 1 } },
      );

      expect(result).toEqual({ success: false });
    });

    it('goes forward when sender has no tab id', async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([
        { id: 77, url: 'https://example.com' } as any,
      ]);

      const result = await messageHandler(
        { action: 'navigate', direction: 'forward' },
        {},
      );

      expect(browser.tabs.goForward).toHaveBeenCalledWith(77);
      expect(result).toEqual({ success: true });
    });
  });

  // -------------------------------------------------------------------
  // handleCloseTab
  // -------------------------------------------------------------------
  describe('handleCloseTab', () => {
    it('saves tab info to closedTabs and removes the tab', async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([
        { id: 10, url: 'https://test.com', title: 'Test' } as any,
      ]);

      const result = await messageHandler(
        { action: 'closeTab' },
        { tab: { id: 10 } },
      );

      expect(browser.tabs.remove).toHaveBeenCalledWith(10);
      expect(result).toEqual({ success: true });
      // Verify closedTabs was persisted
      expect(browser.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ closedTabs: expect.any(Array) }),
      );
    });

    it('falls back to active tab when sender has no tab id', async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([
        { id: 5, url: 'https://fallback.com', title: 'Fallback' } as any,
      ]);

      const result = await messageHandler(
        { action: 'closeTab' },
        {},
      );

      expect(browser.tabs.remove).toHaveBeenCalledWith(5);
      expect(result).toEqual({ success: true });
    });

    it('returns success:false when no tab is found', async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([]);

      const result = await messageHandler(
        { action: 'closeTab' },
        {},
      );

      expect(result).toEqual({ success: false });
    });

    it('returns success:false on error', async () => {
      vi.mocked(browser.tabs.query).mockRejectedValueOnce(new Error('fail'));

      const result = await messageHandler(
        { action: 'closeTab' },
        { tab: { id: 1 } },
      );

      expect(result).toEqual({ success: false });
    });
  });

  // -------------------------------------------------------------------
  // handleNewTab
  // -------------------------------------------------------------------
  describe('handleNewTab', () => {
    it('creates a new active tab', async () => {
      const result = await messageHandler(
        { action: 'newTab' },
        {},
      );

      expect(browser.tabs.create).toHaveBeenCalledWith({ active: true });
      expect(result).toEqual({ success: true });
    });

    it('returns success:false on error', async () => {
      vi.mocked(browser.tabs.create).mockRejectedValueOnce(new Error('fail'));

      const result = await messageHandler(
        { action: 'newTab' },
        {},
      );

      expect(result).toEqual({ success: false });
    });
  });

  // -------------------------------------------------------------------
  // handleClearSiteData
  // -------------------------------------------------------------------
  describe('handleClearSiteData', () => {
    it('reloads sender tab with bypassCache', async () => {
      const result = await messageHandler(
        { action: 'clearSiteData' },
        { tab: { id: 33 } },
      );

      expect(browser.tabs.reload).toHaveBeenCalledWith(33, { bypassCache: true });
      expect(result).toEqual({ success: true });
    });

    it('falls back to active tab when sender has no tab id', async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([
        { id: 44, url: 'https://example.com' } as any,
      ]);

      const result = await messageHandler(
        { action: 'clearSiteData' },
        {},
      );

      expect(browser.tabs.reload).toHaveBeenCalledWith(44, { bypassCache: true });
      expect(result).toEqual({ success: true });
    });

    it('returns success:false on error', async () => {
      vi.mocked(browser.tabs.reload).mockRejectedValueOnce(new Error('fail'));

      const result = await messageHandler(
        { action: 'clearSiteData' },
        { tab: { id: 1 } },
      );

      expect(result).toEqual({ success: false });
    });
  });

  // -------------------------------------------------------------------
  // handleGetConfig
  // -------------------------------------------------------------------
  describe('handleGetConfig', () => {
    it('returns gestureConfig from storage', async () => {
      storageMock['gestureConfig'] = { masterEnabled: true, sensitivity: 60 };

      const result = await messageHandler(
        { action: 'getConfig' },
        {},
      );

      expect(result).toEqual({ masterEnabled: true, sensitivity: 60 });
    });

    it('returns empty object when no config in storage', async () => {
      const result = await messageHandler(
        { action: 'getConfig' },
        {},
      );

      expect(result).toEqual({});
    });

    it('returns empty object on error', async () => {
      vi.mocked(browser.storage.local.get).mockRejectedValueOnce(new Error('fail'));

      const result = await messageHandler(
        { action: 'getConfig' },
        {},
      );

      expect(result).toEqual({});
    });
  });

  // -------------------------------------------------------------------
  // handleSaveConfig
  // -------------------------------------------------------------------
  describe('handleSaveConfig', () => {
    it('saves swiftSettings and gestureConfig to storage', async () => {
      const swiftSettings = { version: 1 };
      const gestureConfig = { masterEnabled: true };

      const result = await messageHandler(
        { action: 'saveConfig', swiftSettings, gestureConfig },
        {},
      );

      expect(browser.storage.local.set).toHaveBeenCalledWith({ swiftSettings, gestureConfig });
      expect(result).toEqual({ success: true });
    });

    it('broadcasts configUpdated to active tab', async () => {
      vi.mocked(browser.tabs.query).mockResolvedValueOnce([
        { id: 55, url: 'https://example.com' } as any,
      ]);
      const gestureConfig = { masterEnabled: false };

      await messageHandler(
        { action: 'saveConfig', swiftSettings: {}, gestureConfig },
        {},
      );

      expect(browser.tabs.sendMessage).toHaveBeenCalledWith(55, {
        action: 'configUpdated',
        config: gestureConfig,
      });
    });

    it('returns success:false on storage error', async () => {
      vi.mocked(browser.storage.local.set).mockRejectedValueOnce(new Error('fail'));

      const result = await messageHandler(
        { action: 'saveConfig', swiftSettings: {}, gestureConfig: {} },
        {},
      );

      expect(result).toEqual({ success: false });
    });
  });

  // -------------------------------------------------------------------
  // handleGetSubscription
  // -------------------------------------------------------------------
  describe('handleGetSubscription', () => {
    it('returns isActive from native message', async () => {
      vi.mocked(browser.runtime.sendNativeMessage).mockResolvedValueOnce({ isActive: true });

      const result = await messageHandler(
        { action: 'getSubscriptionStatus' },
        {},
      );

      expect(browser.runtime.sendNativeMessage).toHaveBeenCalledWith('com.swift.app', {
        action: 'getSubscriptionStatus',
      });
      expect(result).toEqual({ isActive: true });
    });

    it('returns isActive:false when native message returns false', async () => {
      vi.mocked(browser.runtime.sendNativeMessage).mockResolvedValueOnce({ isActive: false });

      const result = await messageHandler(
        { action: 'getSubscriptionStatus' },
        {},
      );

      expect(result).toEqual({ isActive: false });
    });

    it('uses cache within TTL', async () => {
      vi.mocked(browser.runtime.sendNativeMessage).mockResolvedValueOnce({ isActive: true });

      // First call sets cache
      await messageHandler({ action: 'getSubscriptionStatus' }, {});

      vi.clearAllMocks();

      // Second call should use cache
      const result = await messageHandler(
        { action: 'getSubscriptionStatus' },
        {},
      );

      expect(browser.runtime.sendNativeMessage).not.toHaveBeenCalled();
      expect(result).toEqual({ isActive: true });
    });

    it('returns cached value on native message error', async () => {
      // First: populate cache
      vi.mocked(browser.runtime.sendNativeMessage).mockResolvedValueOnce({ isActive: true });
      await messageHandler({ action: 'getSubscriptionStatus' }, {});

      // Expire cache by mocking Date.now
      const originalNow = Date.now;
      Date.now = () => originalNow() + 10 * 60 * 1000; // 10 minutes later

      vi.mocked(browser.runtime.sendNativeMessage).mockRejectedValueOnce(new Error('fail'));

      const result = await messageHandler(
        { action: 'getSubscriptionStatus' },
        {},
      );

      expect(result).toEqual({ isActive: true }); // falls back to cached value
      Date.now = originalNow;
    });

    it('returns isActive:false when no cache and native message fails', async () => {
      vi.mocked(browser.runtime.sendNativeMessage).mockRejectedValueOnce(new Error('fail'));

      const result = await messageHandler(
        { action: 'getSubscriptionStatus' },
        {},
      );

      expect(result).toEqual({ isActive: false });
    });
  });

  // -------------------------------------------------------------------
  // Unknown action
  // -------------------------------------------------------------------
  describe('unknown action', () => {
    it('returns error for unknown action', async () => {
      const result = await messageHandler(
        { action: 'nonexistent' },
        {},
      );

      expect(result).toEqual({ success: false, error: 'Unknown action' });
    });
  });
});
