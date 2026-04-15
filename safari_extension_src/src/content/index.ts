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

      // Load subscription status to gate premium features
      const isSubscribed = await this.configBridge.loadSubscriptionStatus();

      this.exclusionManager = new ExclusionManager();
      if (this.exclusionManager.shouldExclude()) return;

      this.intentDetector = new IntentDetector();

      // Gate gesture engine on subscription or free-tier allowance
      if (isSubscribed || this.isFreeFeatureSet(config)) {
        this.gestureEngine = new GestureEngine(config, this.intentDetector);
        this.gestureEngine.start();
      }

      // Floating button available to all users
      this.floatingButton = new FloatingButton(config);
      this.floatingButton.mount();

      // Listen for config changes broadcast by background
      this.configBridge.onConfigChange((updatedConfig) => {
        try {
          if (this.gestureEngine) {
            this.gestureEngine.stop();
            this.gestureEngine = new GestureEngine(updatedConfig, this.intentDetector!);
            this.gestureEngine.start();
          }
          if (this.floatingButton) {
            this.floatingButton.unmount();
            this.floatingButton = new FloatingButton(updatedConfig);
            this.floatingButton.mount();
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

  /** Free tier: only basic swipe gestures are enabled without a subscription. */
  private isFreeFeatureSet(config: ReturnType<ConfigBridge['getConfig']>): boolean {
    const freeGestures = ['swipeBack', 'swipeForward'];
    return freeGestures.some(g => config.gesturesEnabled[g]);
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
