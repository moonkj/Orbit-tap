export interface GestureConfig {
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
  async loadConfig(): Promise<GestureConfig> {
    try {
      const result = await browser.runtime.sendNativeMessage(
        'com.swift.app',
        { action: 'getConfig' }
      );
      return { ...DEFAULT_CONFIG, ...result };
    } catch {
      // Fallback to storage
      const stored = await browser.storage.local.get('gestureConfig');
      if (stored.gestureConfig) {
        return { ...DEFAULT_CONFIG, ...stored.gestureConfig };
      }
      return DEFAULT_CONFIG;
    }
  }

  async saveConfig(config: Partial<GestureConfig>): Promise<void> {
    await browser.storage.local.set({ gestureConfig: config });
  }
}
