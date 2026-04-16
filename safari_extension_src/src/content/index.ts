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

      // Start gesture engine if master is on
      if (config.masterEnabled) {
        this.gestureEngine = new GestureEngine(config, this.intentDetector);
        this.gestureEngine.start();
      }

      // Floating button — mount only when both master and floating are on
      if (config.masterEnabled && config.floatingButtonEnabled) {
        this.floatingButton = new FloatingButton(config);
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

          // Floating button 관리
          const shouldShow = updatedConfig.masterEnabled && updatedConfig.floatingButtonEnabled;
          if (shouldShow) {
            if (!this.floatingButton) {
              this.floatingButton = new FloatingButton(updatedConfig);
            }
            this.floatingButton.mount();
            this.floatingButton.updateConfig(updatedConfig);
          } else {
            this.floatingButton?.unmount();
            this.floatingButton = null;
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

// iframe 내에서는 실행하지 않음 (중복 플로팅 버튼 방지)
if (window.self === window.top) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const ext = new SwiftExtension();
      ext.init();
    });
  } else {
    const ext = new SwiftExtension();
    ext.init();
  }
}
