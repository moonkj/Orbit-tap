import { GestureEngine } from './gesture/GestureEngine';
import { FloatingButton } from './ui/FloatingButton';
import { IntentDetector } from './intent/IntentDetector';
import { ExclusionManager } from './exclusion/ExclusionManager';
import { ConfigBridge } from './config/ConfigBridge';

class SwiftExtension {
  private gestureEngine: GestureEngine | null = null;
  private floatingButton: FloatingButton | null = null;
  private intentDetector: IntentDetector | null = null;
  private exclusionManager: ExclusionManager | null = null;
  private configBridge: ConfigBridge;

  constructor() {
    this.configBridge = new ConfigBridge();
  }

  async init(): Promise<void> {
    try {
      // Load config via background (falls back to storage cache)
      const config = await this.configBridge.loadConfig();

      this.exclusionManager = new ExclusionManager();
      if (this.exclusionManager.shouldExclude()) return;

      this.intentDetector = new IntentDetector();

      // Start gesture engine only if master switch is on
      if (config.masterEnabled !== false) {
        this.gestureEngine = new GestureEngine(config, this.intentDetector);
        this.gestureEngine.start();
      }

      // Floating button — mount only when master and floatingButtonEnabled are both on
      this.floatingButton = new FloatingButton(config);
      if (config.masterEnabled !== false && config.floatingButtonEnabled) {
        this.floatingButton.mount();
      }

      // Listen for config changes broadcast by background
      this.configBridge.onConfigChange((updatedConfig) => {
        try {
          // Tear down existing gesture engine
          this.gestureEngine?.stop();
          this.gestureEngine = null;

          // Restart engine only if master switch is on
          if (updatedConfig.masterEnabled !== false) {
            this.gestureEngine = new GestureEngine(updatedConfig, this.intentDetector!);
            this.gestureEngine.start();
          }

          // Floating button: show only when master + floatingButtonEnabled
          if (updatedConfig.masterEnabled !== false && updatedConfig.floatingButtonEnabled) {
            if (!this.floatingButton) {
              this.floatingButton = new FloatingButton(updatedConfig);
            }
            this.floatingButton.mount();
          } else {
            this.floatingButton?.unmount();
          }
        } catch (err) {
          console.error('[SwiftExtension] Failed to apply config update:', err);
        }
      });
      this.configBridge.startListening();

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.gestureEngine?.pause();
        } else {
          this.gestureEngine?.resume();
        }
      });
    } catch (err) {
      // Error boundary: log and degrade gracefully — never crash the page
      console.error('[SwiftExtension] Initialization failed:', err);
    }
  }

  destroy(): void {
    this.gestureEngine?.stop();
    this.floatingButton?.unmount();
    this.intentDetector?.dispose();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const ext = new SwiftExtension();
    ext.init();
  });
} else {
  const ext = new SwiftExtension();
  ext.init();
}
