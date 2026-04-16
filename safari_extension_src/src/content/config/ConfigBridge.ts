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
    swipeBack: true,
    swipeForward: true,
    vShape: true,
    lShape: true,
    doubleTap: true,
    longPress: true,
    twoFingerFlick: true,
  },
};

export class ConfigBridge {
  private config: GestureConfig | null = null;
  private subscriptionActive = false;
  private configChangeCallbacks: Array<(config: GestureConfig) => void> = [];

  async loadConfig(): Promise<GestureConfig> {
    try {
      const result = await browser.runtime.sendMessage({ action: 'getConfig' });
      this.config = { ...DEFAULT_CONFIG, ...result };
    } catch {
      const stored = await browser.storage.local.get('gestureConfig');
      this.config = stored.gestureConfig
        ? { ...DEFAULT_CONFIG, ...stored.gestureConfig }
        : { ...DEFAULT_CONFIG };
    }
    return this.config!;
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

  startListening(): void {
    browser.runtime.onMessage.addListener((message: any) => {
      if (message.action === 'configUpdated' && message.config) {
        this.config = { ...DEFAULT_CONFIG, ...message.config };
        this.configChangeCallbacks.forEach(cb => cb(this.config!));
      }
    });
  }

  async saveConfig(config: Partial<GestureConfig>): Promise<void> {
    await browser.storage.local.set({ gestureConfig: config });
  }
}
