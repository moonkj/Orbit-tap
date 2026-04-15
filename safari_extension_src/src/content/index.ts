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
    const config = await this.configBridge.loadConfig();

    this.exclusionManager = new ExclusionManager();
    if (this.exclusionManager.shouldExclude()) return;

    this.intentDetector = new IntentDetector();
    this.gestureEngine = new GestureEngine(config, this.intentDetector);
    this.floatingButton = new FloatingButton(config);

    this.gestureEngine.start();
    this.floatingButton.mount();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.gestureEngine?.pause();
      } else {
        this.gestureEngine?.resume();
      }
    });
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
