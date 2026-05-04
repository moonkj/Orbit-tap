import { UsageTracker, UsageData } from '../../src/content/usage/UsageTracker';

const storageMock = (globalThis as any).__storageMock as Record<string, any>;

// 테스트용 서명 헬퍼 (UsageTracker 내부와 동일 알고리즘 - Track A 강화 후)
function computeTestSig(data: any): string {
  const raw = `sw1ft_2026:${data.isSubscribed}:${data.date}:${data.count}:${data.weekStart}:${data.weekFreeCount}:${data.totalFreeCount}:${data.monthKey}:${data.monthSubDays}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weekStartStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthKeyStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Build a complete UsageData fixture and attach a valid _sig.
 *  Tests must use this — Track A strengthened the load() check so any
 *  fixture without a matching signature now fail-closes (count=limit). */
function mkUsage(overrides: Partial<UsageData> = {}): UsageData & { _sig: string } {
  const data: UsageData = {
    date: todayStr(), count: 0, isSubscribed: false,
    totalFreeCount: 0, weekStart: weekStartStr(), weekFreeCount: 0,
    monthKey: monthKeyStr(), monthSubDays: 0,
    ...overrides,
  };
  return { ...data, _sig: computeTestSig(data) };
}

describe('UsageTracker', () => {
  let tracker: UsageTracker;

  beforeEach(() => {
    // Clear storage mock
    Object.keys(storageMock).forEach(k => delete storageMock[k]);
    // Reset all browser mock call records
    vi.clearAllMocks();
    tracker = new UsageTracker();
  });

  // ---------------------------------------------------------------
  // load()
  // ---------------------------------------------------------------
  describe('load()', () => {
    it('reads from browser.storage.local', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 3,
        isSubscribed: false,
        totalFreeCount: 10,
        weekStart: weekStartStr(),
        weekFreeCount: 5,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.load();

      expect(browser.storage.local.get).toHaveBeenCalledWith('swiftUsage');
      expect(tracker.remaining()).toBe(7); // 10 - 3
      expect(tracker.getStats().todayCount).toBe(3);
      expect(tracker.getStats().totalFree).toBe(10);
    });

    it('initializes with defaults when storage is empty', async () => {
      await tracker.load();

      expect(tracker.remaining()).toBe(10);
      expect(tracker.canUse()).toBe(true);
      expect(tracker.getStats().todayCount).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // canUse()
  // ---------------------------------------------------------------
  describe('canUse()', () => {
    it('returns true when count < 10', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 5,
        isSubscribed: false,
        totalFreeCount: 5,
        weekStart: weekStartStr(),
        weekFreeCount: 5,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.load();
      expect(tracker.canUse()).toBe(true);
    });

    it('returns false when count >= 10', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 10,
        isSubscribed: false,
        totalFreeCount: 10,
        weekStart: weekStartStr(),
        weekFreeCount: 10,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.load();
      expect(tracker.canUse()).toBe(false);
    });

    it('returns false when count exceeds 10', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 15,
        isSubscribed: false,
        totalFreeCount: 15,
        weekStart: weekStartStr(),
        weekFreeCount: 15,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.load();
      expect(tracker.canUse()).toBe(false);
    });

    it('returns true when isSubscribed regardless of count', async () => {
      storageMock['swiftUsage'] = mkUsage({
        count: 999,
        isSubscribed: true,
        monthSubDays: 5,
      });

      await tracker.load();
      expect(tracker.canUse()).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // recordUse()
  // ---------------------------------------------------------------
  describe('recordUse()', () => {
    it('increments count', async () => {
      await tracker.load();
      expect(tracker.getStats().todayCount).toBe(0);

      await tracker.recordUse();
      expect(tracker.getStats().todayCount).toBe(1);

      await tracker.recordUse();
      expect(tracker.getStats().todayCount).toBe(2);
    });

    it('increments totalFreeCount and weekFreeCount when not subscribed', async () => {
      await tracker.load();

      await tracker.recordUse();
      await tracker.recordUse();
      await tracker.recordUse();

      const stats = tracker.getStats();
      expect(stats.totalFree).toBe(3);
      expect(stats.weekFree).toBe(3);
    });

    it('does not increment totalFreeCount or weekFreeCount when subscribed', async () => {
      storageMock['swiftUsage'] = mkUsage({
        isSubscribed: true,
        monthSubDays: 1,
      });

      await tracker.load();
      await tracker.recordUse();
      await tracker.recordUse();

      const stats = tracker.getStats();
      expect(stats.todayCount).toBe(2);
      expect(stats.totalFree).toBe(0);
      expect(stats.weekFree).toBe(0);
    });

    it('persists to storage after recording', async () => {
      vi.useFakeTimers();
      await tracker.load();
      vi.clearAllMocks();

      await tracker.recordUse();
      // Save is debounced (Track D) — flush the trailing-edge timer
      // and let the resulting microtask settle.
      await vi.runAllTimersAsync();
      vi.useRealTimers();

      expect(browser.storage.local.set).toHaveBeenCalled();
      const setCall = vi.mocked(browser.storage.local.set).mock.calls[0][0] as any;
      expect(setCall.swiftUsage.count).toBe(1);
    });
  });

  // ---------------------------------------------------------------
  // remaining()
  // ---------------------------------------------------------------
  describe('remaining()', () => {
    it('returns correct remaining count for free user', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 7,
        isSubscribed: false,
        totalFreeCount: 7,
        weekStart: weekStartStr(),
        weekFreeCount: 7,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.load();
      expect(tracker.remaining()).toBe(3);
    });

    it('returns 0 when count >= limit', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 12,
        isSubscribed: false,
        totalFreeCount: 12,
        weekStart: weekStartStr(),
        weekFreeCount: 12,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.load();
      expect(tracker.remaining()).toBe(0);
    });

    it('returns Infinity for subscribed users', async () => {
      storageMock['swiftUsage'] = mkUsage({
        count: 50,
        isSubscribed: true,
        monthSubDays: 3,
      });

      await tracker.load();
      expect(tracker.remaining()).toBe(Infinity);
    });
  });

  // ---------------------------------------------------------------
  // setSubscription()
  // ---------------------------------------------------------------
  describe('setSubscription()', () => {
    it('changes isSubscribed to true', async () => {
      await tracker.load();
      expect(tracker.isSubscribed()).toBe(false);

      await tracker.setSubscription(true);
      expect(tracker.isSubscribed()).toBe(true);
    });

    it('changes isSubscribed to false', async () => {
      storageMock['swiftUsage'] = mkUsage({
        isSubscribed: true,
        monthSubDays: 1,
      });

      await tracker.load();
      expect(tracker.isSubscribed()).toBe(true);

      await tracker.setSubscription(false);
      expect(tracker.isSubscribed()).toBe(false);
    });

    it('increments monthSubDays when activated', async () => {
      await tracker.load();

      await tracker.setSubscription(true);
      expect(tracker.getStats().monthSub).toBe(1);

      await tracker.setSubscription(true);
      expect(tracker.getStats().monthSub).toBe(2);
    });

    it('does not increment monthSubDays when deactivated', async () => {
      await tracker.load();

      await tracker.setSubscription(false);
      expect(tracker.getStats().monthSub).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // resetStats()
  // ---------------------------------------------------------------
  describe('resetStats()', () => {
    it('clears all counters to defaults', async () => {
      storageMock['swiftUsage'] = {
        date: todayStr(),
        count: 8,
        isSubscribed: true,
        _sig: computeTestSig({ isSubscribed: true, date: todayStr(), count: 8 }),
        totalFreeCount: 50,
        weekStart: weekStartStr(),
        weekFreeCount: 20,
        monthKey: monthKeyStr(),
        monthSubDays: 10,
      };

      await tracker.load();
      await tracker.resetStats();

      expect(tracker.getStats().todayCount).toBe(0);
      expect(tracker.getStats().totalFree).toBe(0);
      expect(tracker.getStats().weekFree).toBe(0);
      expect(tracker.getStats().monthSub).toBe(0);
      expect(tracker.isSubscribed()).toBe(false);
      expect(tracker.canUse()).toBe(true);
      expect(tracker.remaining()).toBe(10);
    });

    it('persists reset to storage', async () => {
      await tracker.load();
      vi.clearAllMocks();

      await tracker.resetStats();

      expect(browser.storage.local.set).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // getStats()
  // ---------------------------------------------------------------
  describe('getStats()', () => {
    it('returns correct stats object', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 4,
        isSubscribed: false,
        totalFreeCount: 100,
        weekStart: weekStartStr(),
        weekFreeCount: 25,
        monthKey: monthKeyStr(),
        monthSubDays: 3,
      });

      await tracker.load();

      const stats = tracker.getStats();
      expect(stats).toEqual({
        weekFree: 25,
        totalFree: 100,
        monthSub: 3,
        todayCount: 4,
      });
    });

    it('returns zeroed stats for fresh tracker', async () => {
      await tracker.load();

      const stats = tracker.getStats();
      expect(stats).toEqual({
        weekFree: 0,
        totalFree: 0,
        monthSub: 0,
        todayCount: 0,
      });
    });
  });

  // ---------------------------------------------------------------
  // refresh()
  // ---------------------------------------------------------------
  describe('refresh()', () => {
    it('re-reads from storage', async () => {
      await tracker.load();
      expect(tracker.getStats().todayCount).toBe(0);

      // Simulate another tab updating storage
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 7,
        isSubscribed: false,
        totalFreeCount: 7,
        weekStart: weekStartStr(),
        weekFreeCount: 7,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.refresh();

      expect(tracker.getStats().todayCount).toBe(7);
      expect(tracker.remaining()).toBe(3);
    });

    it('calls browser.storage.local.get', async () => {
      vi.clearAllMocks();
      await tracker.refresh();
      expect(browser.storage.local.get).toHaveBeenCalledWith('swiftUsage');
    });
  });

  // ---------------------------------------------------------------
  // Date rollover
  // ---------------------------------------------------------------
  describe('date rollover', () => {
    it('resets daily count when date changes', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: '2025-01-01', // yesterday or earlier
        count: 8,
        isSubscribed: false,
        totalFreeCount: 50,
        weekStart: weekStartStr(),
        weekFreeCount: 20,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.load();

      // Daily count should be reset since stored date != today
      expect(tracker.getStats().todayCount).toBe(0);
      expect(tracker.canUse()).toBe(true);
      expect(tracker.remaining()).toBe(10);
      // totalFreeCount should be preserved
      expect(tracker.getStats().totalFree).toBe(50);
    });
  });

  // ---------------------------------------------------------------
  // Week rollover
  // ---------------------------------------------------------------
  describe('week rollover', () => {
    it('resets weekFreeCount when weekStart changes', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 3,
        isSubscribed: false,
        totalFreeCount: 100,
        weekStart: '2024-01-07', // an old week
        weekFreeCount: 42,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.load();

      // weekFreeCount should be reset since stored weekStart != current weekStart
      expect(tracker.getStats().weekFree).toBe(0);
      // Other stats should remain intact
      expect(tracker.getStats().todayCount).toBe(3);
      expect(tracker.getStats().totalFree).toBe(100);
    });

    it('preserves weekFreeCount when weekStart has not changed', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 3,
        isSubscribed: false,
        totalFreeCount: 100,
        weekStart: weekStartStr(), // same week
        weekFreeCount: 42,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.load();

      expect(tracker.getStats().weekFree).toBe(42);
    });
  });

  // ---------------------------------------------------------------
  // Month rollover
  // ---------------------------------------------------------------
  describe('month rollover', () => {
    it('resets monthSubDays when monthKey changes', async () => {
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 0,
        isSubscribed: false,
        totalFreeCount: 0,
        weekStart: weekStartStr(),
        weekFreeCount: 0,
        monthKey: '2024-01', // old month
        monthSubDays: 15,
      });

      await tracker.load();

      expect(tracker.getStats().monthSub).toBe(0);
    });
  });

  // ---------------------------------------------------------------
  // startListening()
  // ---------------------------------------------------------------
  describe('startListening()', () => {
    it('registers storage.onChanged listener', () => {
      tracker.startListening();
      expect(browser.storage.onChanged.addListener).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------
  // Native subscription check during load
  // ---------------------------------------------------------------
  describe('native subscription check', () => {
    it('sets isSubscribed true when native app returns active', async () => {
      vi.mocked(browser.runtime.sendNativeMessage).mockResolvedValueOnce({ isActive: true });

      await tracker.load();
      expect(tracker.isSubscribed()).toBe(true);
    });

    it('preserves storage value when native messaging fails', async () => {
      vi.mocked(browser.runtime.sendNativeMessage).mockRejectedValueOnce(new Error('fail'));
      storageMock['swiftUsage'] = mkUsage({
        date: todayStr(),
        count: 0,
        isSubscribed: false,
        totalFreeCount: 0,
        weekStart: weekStartStr(),
        weekFreeCount: 0,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      });

      await tracker.load();
      expect(tracker.isSubscribed()).toBe(false);
    });

    // Track A regression guard — count tampering must also fail closed,
    // not just isSubscribed tampering. Anyone editing storage to set
    // count=0 without recomputing the signature should land at the
    // daily limit (canUse() === false), never granted free uses.
    it('tampered count → fail closed (canUse=false)', async () => {
      const realData: UsageData = {
        date: todayStr(),
        count: 5,
        isSubscribed: false,
        totalFreeCount: 5,
        weekStart: weekStartStr(),
        weekFreeCount: 5,
        monthKey: monthKeyStr(),
        monthSubDays: 0,
      };
      const sigForFiveUses = computeTestSig(realData);
      // Forge: write count=0 with the signature computed for count=5.
      // The load() check must catch the mismatch and fail-close.
      storageMock.swiftUsage = { ...realData, count: 0, _sig: sigForFiveUses };
      await tracker.load();
      expect(tracker.canUse()).toBe(false);
    });
  });
});
