export interface GestureConfig {
  masterEnabled: boolean;
  swipeMinDistance: number;
  edgeZonePercent: number;
  vShapeMinSegment: number;
  vShapeAngleMin: number;
  vShapeAngleMax: number;
  lShapeAngleMin: number;
  lShapeAngleMax: number;
  doubleTapMaxInterval: number;
  longPressMinDuration: number;
  cooldownSwipe: number;
  cooldownShape: number;
  cooldownTap: number;
  cooldownTwoFinger: number;
  floatingButtonEnabled: boolean;
  gesturesEnabled: Record<string, boolean>;
  sensitivity: number;
  buttonSize: string;
  buttonOpacity: number;
}

const DEFAULT_CONFIG: GestureConfig = {
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
    vShape: true,
    lShape: true,
    circle: true,
    cShape: true,
    diagonalSwipeUp: true,
  },
  sensitivity: 50,
  buttonSize: 'medium',
  buttonOpacity: 90,
};

export class ConfigBridge {
  private config: GestureConfig | null = null;
  private subscriptionActive = false;
  private configChangeCallbacks: Array<(config: GestureConfig) => void> = [];

  /**
   * Storage에서 직접 읽기 (background sendNativeMessage 우회)
   * 가장 신뢰성 높은 경로: content script → browser.storage.local → 직접 읽기
   */
  async loadConfig(): Promise<GestureConfig> {
    try {
      // 1차: storage에서 gestureConfig 직접 읽기
      const stored = await browser.storage.local.get('gestureConfig');
      if (stored?.gestureConfig) {
        this.config = this.applySensitivity({ ...DEFAULT_CONFIG, ...stored.gestureConfig });
        return this.config;
      }
    } catch {}

    try {
      // 2차: background에 요청 (fallback)
      const result = await browser.runtime.sendMessage({ action: 'getConfig' });
      if (result && Object.keys(result).length > 0) {
        this.config = this.applySensitivity({ ...DEFAULT_CONFIG, ...result });
        return this.config;
      }
    } catch {}

    // 3차: defaults
    this.config = { ...DEFAULT_CONFIG };
    return this.config;
  }

  /**
   * sensitivity (20-100) → 실제 제스처 감지 임계값 매핑
   */
  private applySensitivity(config: GestureConfig): GestureConfig {
    const s = (config.sensitivity ?? 50) / 100;
    const factor = 1.6 - s * 1.2;
    config.swipeMinDistance = Math.round(DEFAULT_CONFIG.swipeMinDistance * factor);
    config.vShapeMinSegment = Math.round(DEFAULT_CONFIG.vShapeMinSegment * factor);
    config.doubleTapMaxInterval = Math.round(DEFAULT_CONFIG.doubleTapMaxInterval * (2 - factor));
    config.longPressMinDuration = Math.round(DEFAULT_CONFIG.longPressMinDuration * factor);
    return config;
  }

  async loadSubscriptionStatus(): Promise<boolean> {
    try {
      const result = await browser.runtime.sendMessage({ action: 'getSubscriptionStatus' });
      this.subscriptionActive = result?.isActive === true;
    } catch {
      this.subscriptionActive = false;
    }
    return this.subscriptionActive;
  }

  isSubscriptionActive(): boolean {
    return this.subscriptionActive;
  }

  getConfig(): GestureConfig {
    return this.config ?? { ...DEFAULT_CONFIG };
  }

  onConfigChange(callback: (config: GestureConfig) => void): void {
    this.configChangeCallbacks.push(callback);
  }

  /**
   * 2가지 경로로 config 변경 감지:
   * 1. runtime.onMessage (popup → background → content script)
   * 2. storage.onChanged (popup이 직접 storage에 쓸 때)
   */
  startListening(): void {
    browser.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      // getState: popup이 현재 상태 요청 (Scrolly pattern)
      if (message.action === 'getState') {
        try {
          browser.storage.local.get('swiftSettings').then((data: any) => {
            const ss = data?.swiftSettings;
            if (ss) {
              sendResponse({ action: 'currentState', settings: ss });
            }
          }).catch(() => {});
        } catch {}
        return true; // async sendResponse
      }

      // configUpdated: popup이 설정 변경 전달
      if (message.action === 'configUpdated' && message.config) {
        this.config = this.applySensitivity({ ...DEFAULT_CONFIG, ...message.config });

        // Scrolly autoSaveSettings: content script가 storage에 직접 저장
        const toSave: Record<string, any> = { gestureConfig: message.config };
        if (message.swiftSettings) {
          toSave.swiftSettings = message.swiftSettings;
        }
        try {
          browser.storage.local.set(toSave).catch(() => {});
        } catch {}

        this.configChangeCallbacks.forEach(cb => cb(this.config!));
      }
    });

    // 경로 2: storage.onChanged 기반
    try {
      browser.storage.onChanged.addListener((changes: any, areaName: string) => {
        if (areaName === 'local' && changes.gestureConfig?.newValue) {
          this.config = this.applySensitivity({ ...DEFAULT_CONFIG, ...changes.gestureConfig.newValue });
          this.configChangeCallbacks.forEach(cb => cb(this.config!));
        }
      });
    } catch {}
  }

  async saveConfig(config: Partial<GestureConfig>): Promise<void> {
    await browser.storage.local.set({ gestureConfig: config });
  }
}
