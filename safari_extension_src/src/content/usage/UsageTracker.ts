const USAGE_KEY = 'swiftUsage';
const DAILY_FREE_LIMIT = 10;
const SIGN_SALT = 'sw1ft_2026';

export interface UsageData {
  date: string;
  count: number;
  isSubscribed: boolean;
  totalFreeCount: number;
  weekStart: string;
  weekFreeCount: number;
  monthKey: string;
  monthSubDays: number;
  _sig?: string;
}

/** Storage tamper guard. Covers count, totalFreeCount, weekFreeCount, monthSubDays — all enforcement-relevant fields. */
function computeSignature(data: UsageData): string {
  const raw = `${SIGN_SALT}:${data.isSubscribed}:${data.date}:${data.count}:${data.weekStart}:${data.weekFreeCount}:${data.totalFreeCount}:${data.monthKey}:${data.monthSubDays}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

function pad2(n: number): string { return n < 10 ? `0${n}` : `${n}`; }

/** Local-timezone YYYY-MM-DD so the daily reset matches the user's wall clock. */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function weekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function monthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function defaultData(): UsageData {
  return {
    date: today(), count: 0, isSubscribed: false,
    totalFreeCount: 0, weekStart: weekStart(), weekFreeCount: 0,
    monthKey: monthKey(), monthSubDays: 0,
  };
}

export class UsageTracker {
  private data: UsageData = defaultData();

  /** storage 변경 실시간 감지 */
  startListening(): void {
    try {
      browser.storage.onChanged.addListener((changes: any, area: string) => {
        if (area === 'local' && changes[USAGE_KEY]?.newValue) {
          const updated = changes[USAGE_KEY].newValue;
          this.data = { ...defaultData(), ...updated };
        }
      });
    } catch {}
  }

  async load(): Promise<void> {
    try {
      const stored = await browser.storage.local.get(USAGE_KEY);
      if (stored?.[USAGE_KEY]) {
        const loaded = { ...defaultData(), ...stored[USAGE_KEY] };
        // Verify signature for ALL data, not just subscribed.
        // If tampered: drop subscription claim AND reset count to today's max
        // (treat as already at limit — fail closed, never bypass paywall).
        if (loaded._sig !== computeSignature(loaded)) {
          loaded.isSubscribed = false;
          loaded.count = DAILY_FREE_LIMIT;
        }
        this.data = loaded;
      }
    } catch {}

    // 날짜 변경 시 일일 카운트 리셋
    const t = today();
    if (this.data.date !== t) { this.data.date = t; this.data.count = 0; }

    const ws = weekStart();
    if (this.data.weekStart !== ws) { this.data.weekStart = ws; this.data.weekFreeCount = 0; }

    const mk = monthKey();
    if (this.data.monthKey !== mk) { this.data.monthKey = mk; this.data.monthSubDays = 0; }

    // ShieldMail 패턴: chrome.runtime.sendNativeMessage (콜백 + 타임아웃)
    try {
      const g = globalThis as any;
      const nativeResult: any = await new Promise((resolve) => {
        const TIMEOUT = 2000;
        const timer = setTimeout(() => resolve({ _timeout: true }), TIMEOUT);

        // chrome API 시도
        if (typeof g.chrome?.runtime?.sendNativeMessage === 'function') {
          g.chrome.runtime.sendNativeMessage(
            'com.shadowengine.app',
            { action: 'getSubscriptionStatus' },
            (resp: any) => { clearTimeout(timer); resolve(resp ?? { _noResp: true, lastErr: g.chrome?.runtime?.lastError?.message }); }
          );
        // browser API 시도
        } else if (typeof g.browser?.runtime?.sendNativeMessage === 'function') {
          g.browser.runtime.sendNativeMessage('com.shadowengine.app', { action: 'getSubscriptionStatus' }).then(
            (resp: any) => { clearTimeout(timer); resolve(resp ?? { _noResp: true }); },
            () => { clearTimeout(timer); resolve({ _browserErr: true }); }
          );
        } else {
          clearTimeout(timer);
          resolve({ _noApi: true });
        }
      });

      if (nativeResult?.isActive === true || nativeResult?.tier === 'pro') {
        this.data.isSubscribed = true;
        try { await browser.storage.local.set({ subscriptionActive: true }); } catch {}
      }
      try { await browser.storage.local.set({ subDbgContent: nativeResult }); } catch {}
    } catch {}

    await this.save();
  }

  /** 사용 전 storage에서 최신 상태 갱신 */
  async refresh(): Promise<void> {
    try {
      const stored = await browser.storage.local.get(USAGE_KEY);
      if (stored?.[USAGE_KEY]) {
        this.data = { ...defaultData(), ...stored[USAGE_KEY] };
      }
    } catch {}
  }

  canUse(): boolean {
    if (this.data.isSubscribed) return true;
    return this.data.count < DAILY_FREE_LIMIT;
  }

  remaining(): number {
    if (this.data.isSubscribed) return Infinity;
    return Math.max(0, DAILY_FREE_LIMIT - this.data.count);
  }

  async recordUse(): Promise<void> {
    this.data.count++;
    if (!this.data.isSubscribed) {
      this.data.totalFreeCount++;
      this.data.weekFreeCount++;
    }
    await this.save();
  }

  isSubscribed(): boolean {
    return this.data.isSubscribed;
  }

  async setSubscription(active: boolean): Promise<void> {
    this.data.isSubscribed = active;
    if (active) this.data.monthSubDays++;
    await this.save();
  }

  getStats() {
    return {
      weekFree: this.data.weekFreeCount,
      totalFree: this.data.totalFreeCount,
      monthSub: this.data.monthSubDays,
      todayCount: this.data.count,
    };
  }

  async resetStats(): Promise<void> {
    this.data = defaultData();
    await this.save();
  }

  private async save(): Promise<void> {
    try {
      const toSave = { ...this.data, _sig: computeSignature(this.data) };
      await browser.storage.local.set({ [USAGE_KEY]: toSave });
    } catch {}
  }
}
