export interface GestureConfig {
  masterEnabled: boolean;
  edgeZonePercent: number;
  floatingButtonEnabled: boolean;
  gesturesEnabled: Record<string, boolean>;
  sensitivity: number;
  buttonSize: string;
  buttonOpacity: number;
}

const DEFAULT_CONFIG: GestureConfig = {
  masterEnabled: true,
  edgeZonePercent: 0.12,
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
};

export class ConfigBridge {
  private config: GestureConfig | null = null;
  private configChangeCallbacks: Array<(config: GestureConfig) => void> = [];
  private lastNotifiedSig: string = '';

  /** Suppress duplicate notifications when the popup pushes via multiple
   *  paths (sendMessage + storage.set + saveConfig relay). All three
   *  surfaces converge here; we only want callbacks once per real change. */
  private notifyIfChanged(next: GestureConfig): void {
    const sig = JSON.stringify(next);
    if (sig === this.lastNotifiedSig) return;
    this.lastNotifiedSig = sig;
    this.configChangeCallbacks.forEach(cb => cb(next));
  }

  async loadConfig(): Promise<GestureConfig> {
    try {
      const stored = await browser.storage.local.get('gestureConfig');
      if (stored?.gestureConfig) {
        this.config = { ...DEFAULT_CONFIG, ...stored.gestureConfig };
        return this.config;
      }
    } catch {}

    try {
      const result = await browser.runtime.sendMessage({ action: 'getConfig' });
      if (result && Object.keys(result).length > 0) {
        this.config = { ...DEFAULT_CONFIG, ...result };
        return this.config;
      }
    } catch {}

    this.config = { ...DEFAULT_CONFIG };
    return this.config;
  }

  getConfig(): GestureConfig {
    return this.config ?? { ...DEFAULT_CONFIG };
  }

  onConfigChange(callback: (config: GestureConfig) => void): void {
    this.configChangeCallbacks.push(callback);
  }

  startListening(): void {
    browser.runtime.onMessage.addListener((message: any, _sender: any, sendResponse: any) => {
      if (message.action === 'getState') {
        try {
          browser.storage.local.get('swiftSettings').then((data: any) => {
            sendResponse({ action: 'currentState', settings: data?.swiftSettings ?? null });
          }).catch(() => {
            sendResponse({ action: 'currentState', settings: null });
          });
        } catch {
          sendResponse({ action: 'currentState', settings: null });
        }
        return true;
      }

      if (message.action === 'configUpdated' && message.config) {
        this.config = { ...DEFAULT_CONFIG, ...message.config };

        const toSave: Record<string, any> = { gestureConfig: message.config };
        if (message.swiftSettings) {
          toSave.swiftSettings = message.swiftSettings;
        }
        try {
          browser.storage.local.set(toSave).catch(() => {});
        } catch {}

        this.notifyIfChanged(this.config);
      }
    });

    try {
      browser.storage.onChanged.addListener((changes: any, areaName: string) => {
        if (areaName === 'local' && changes.gestureConfig?.newValue) {
          this.config = { ...DEFAULT_CONFIG, ...changes.gestureConfig.newValue };
          this.notifyIfChanged(this.config);
        }
      });
    } catch {}
  }
}
