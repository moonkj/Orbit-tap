import { TouchTracker } from './TouchTracker';
import { ShapeDetector, GestureType } from './ShapeDetector';
import { IntentDetector } from '../intent/IntentDetector';
import { FeedbackOverlay } from '../ui/FeedbackOverlay';
import { SearchOverlay } from '../ui/SearchOverlay';
import { UsageTracker } from '../usage/UsageTracker';
import type { GestureConfig } from '../config/ConfigBridge';

type GestureState = 'IDLE' | 'DETECTING' | 'COOLDOWN';

const GESTURE_CONFIG_KEY: Partial<Record<GestureType, string>> = {
  [GestureType.X_SHAPE]: 'xShape',
  [GestureType.L_SHAPE]: 'lShape',
  [GestureType.CIRCLE]: 'circle',
  [GestureType.C_SHAPE]: 'cShape',
};

const GESTURE_MODE_DURATION = 5000;

function i18n(ko: string, en: string): string {
  return (navigator.language || 'en').toLowerCase().startsWith('ko') ? ko : en;
}

export class GestureEngine {
  private state: GestureState = 'IDLE';
  private touchTracker: TouchTracker;
  private shapeDetector: ShapeDetector;
  private intentDetector: IntentDetector;
  private feedback: FeedbackOverlay;
  private searchOverlay: SearchOverlay;
  private config: GestureConfig;
  private cooldownTimer: number | null = null;

  // X 제스처: 두 획 연속 감지
  private firstStroke: { points: any[]; angle: number } | null = null;
  private xStrokeTimer: number | null = null;
  private readonly X_STROKE_TIMEOUT = 1000; // 두 번째 획 대기 시간

  private gestureMode = false;
  private gestureModeTimer: number | null = null;
  private overlay: HTMLElement | null = null;
  private overlayStyle: HTMLStyleElement | null = null;
  private overlayAbort: AbortController | null = null;
  private liveCanvas: HTMLCanvasElement | null = null;
  private liveCtx: CanvasRenderingContext2D | null = null;
  private lastX = 0;
  private lastY = 0;
  private toast: HTMLElement | null = null;

  private usageTracker: UsageTracker;

  constructor(config: GestureConfig, intentDetector: IntentDetector, usageTracker: UsageTracker) {
    this.config = config;
    this.intentDetector = intentDetector;
    this.usageTracker = usageTracker;
    this.touchTracker = new TouchTracker();
    this.shapeDetector = new ShapeDetector(config);
    this.feedback = new FeedbackOverlay();
    this.searchOverlay = new SearchOverlay();
  }

  start(): void {}
  stop(): void {
    this.deactivate();
    this.shapeDetector.destroy();
    if (this.cooldownTimer) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
  }

  /** 플로팅 버튼 3탭으로 호출 */
  async activateGestureMode(): Promise<void> {
    if (this.gestureMode) return;

    // 최신 구독 상태 갱신 후 체크
    await this.usageTracker.refresh();
    if (!this.usageTracker.canUse()) {
      this.showSubscriptionPrompt();
      return;
    }
    this.gestureMode = true;

    // 토스트
    this.showToast(i18n('제스처 모드', 'Gesture Mode'), 'bottom');

    // 오버레이 스타일
    this.overlayStyle = document.createElement('style');
    this.overlayStyle.textContent = `
      .swift-gm-overlay {
        position:fixed; top:0; left:0; right:0; bottom:0;
        z-index:2147483644; touch-action:none;
        background:transparent;
        transition: background 0.2s;
      }
      .swift-gm-overlay.active { background:rgba(0,0,0,0.05); }
      .swift-gm-border {
        position:fixed; top:0; left:0; right:0; bottom:0;
        z-index:2147483643; pointer-events:none;
        border: 2px solid;
        border-image: linear-gradient(135deg, #a855f7, #ec4899, #06b6d4) 1;
        box-sizing:border-box;
        opacity:0; transition: opacity 0.3s;
        animation: swift-border-glow 2s ease-in-out infinite;
      }
      .swift-gm-border.active { opacity:1; }
      @keyframes swift-border-glow {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.4); }
      }
    `;
    document.head.appendChild(this.overlayStyle);

    // 테두리 표시
    const border = document.createElement('div');
    border.className = 'swift-gm-border';
    document.documentElement.appendChild(border);
    requestAnimationFrame(() => border.classList.add('active'));

    // 투명 오버레이 (touch-action:none)
    this.overlay = document.createElement('div');
    this.overlay.className = 'swift-gm-overlay';

    this.liveCanvas = document.createElement('canvas');
    this.liveCanvas.width = window.innerWidth;
    this.liveCanvas.height = window.innerHeight;
    this.liveCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
    this.overlay.appendChild(this.liveCanvas);
    this.liveCtx = this.liveCanvas.getContext('2d');

    document.documentElement.appendChild(this.overlay);
    requestAnimationFrame(() => this.overlay?.classList.add('active'));

    this.overlayAbort = new AbortController();
    const sig = this.overlayAbort.signal;
    this.overlay.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false, signal: sig });
    this.overlay.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false, signal: sig });
    this.overlay.addEventListener('touchend', this.onTouchEnd.bind(this), { signal: sig });

    // 5초 후 자동 비활성화
    this.gestureModeTimer = window.setTimeout(() => this.deactivate(), GESTURE_MODE_DURATION);
  }

  private deactivate(): void {
    if (!this.gestureMode) return;
    this.gestureMode = false;
    this.overlayAbort?.abort();
    this.overlayAbort = null;

    if (this.gestureModeTimer) { clearTimeout(this.gestureModeTimer); this.gestureModeTimer = null; }
    if (this.xStrokeTimer) { clearTimeout(this.xStrokeTimer); this.xStrokeTimer = null; }
    this.firstStroke = null;

    // 테두리 페이드아웃
    const border = document.querySelector('.swift-gm-border');
    if (border) { border.classList.remove('active'); setTimeout(() => border.remove(), 300); }

    // 오버레이 제거
    if (this.overlay) {
      this.overlay.classList.remove('active');
      setTimeout(() => { this.overlay?.remove(); this.overlay = null; }, 200);
    }
    this.overlayStyle?.remove();
    this.overlayStyle = null;
    this.liveCanvas = null;
    this.liveCtx = null;
    this.state = 'IDLE';
  }

  private showToast(text: string, pos: 'center' | 'bottom' = 'center'): void {
    this.toast?.remove();
    this.toast = document.createElement('div');
    const posStyle = pos === 'bottom'
      ? 'bottom:120px; left:50%; transform:translateX(-50%);'
      : 'top:50%; left:50%; transform:translate(-50%,-50%);';
    this.toast.style.cssText = `
      position:fixed; ${posStyle}
      background:rgba(0,0,0,0.8); color:#fff;
      padding:14px 32px; border-radius:14px;
      font:600 17px -apple-system,BlinkMacSystemFont,sans-serif;
      z-index:2147483647; pointer-events:none;
      opacity:0; transition:opacity 0.15s;
      text-align:center;
    `;
    this.toast.textContent = text;
    document.documentElement.appendChild(this.toast);
    requestAnimationFrame(() => { if (this.toast) this.toast.style.opacity = '1'; });
    setTimeout(() => {
      if (this.toast) { this.toast.style.opacity = '0'; setTimeout(() => { this.toast?.remove(); this.toast = null; }, 200); }
    }, 2000);
  }

  // ── Touch (오버레이 위) ───────────────────────────────────
  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    if (this.state === 'COOLDOWN') return;

    this.touchTracker.onTouchStart(e);
    this.state = 'DETECTING';
    this.lastX = e.touches[0].clientX;
    this.lastY = e.touches[0].clientY;

    // 타이머 리셋
    if (this.gestureModeTimer) clearTimeout(this.gestureModeTimer);
    this.gestureModeTimer = window.setTimeout(() => this.deactivate(), GESTURE_MODE_DURATION);

    // 첫 획 대기 중이 아니면 캔버스 클리어
    if (!this.firstStroke && this.liveCtx && this.liveCanvas) {
      this.liveCtx.clearRect(0, 0, this.liveCanvas.width, this.liveCanvas.height);
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    if (this.state !== 'DETECTING') return;
    this.touchTracker.onTouchMove(e);

    // 실시간 궤적 그리기 — 네온 그라데이션
    if (this.liveCtx && this.liveCanvas) {
      const x = e.touches[0].clientX;
      const y = e.touches[0].clientY;

      // 그라데이션 스트로크 (보라 → 핑크 → 시안)
      const grad = this.liveCtx.createLinearGradient(this.lastX, this.lastY, x, y);
      const hue = (performance.now() * 0.15) % 360;
      grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.9)`);
      grad.addColorStop(1, `hsla(${(hue + 60) % 360}, 100%, 70%, 0.9)`);

      // 글로우 효과
      this.liveCtx.shadowColor = `hsla(${hue}, 100%, 60%, 0.6)`;
      this.liveCtx.shadowBlur = 12;

      this.liveCtx.beginPath();
      this.liveCtx.moveTo(this.lastX, this.lastY);
      this.liveCtx.lineTo(x, y);
      this.liveCtx.strokeStyle = grad;
      this.liveCtx.lineWidth = 4;
      this.liveCtx.lineCap = 'round';
      this.liveCtx.stroke();

      this.liveCtx.shadowBlur = 0;
      this.lastX = x;
      this.lastY = y;
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (this.state !== 'DETECTING') return;

    const session = this.touchTracker.onTouchEnd(e);
    this.state = 'IDLE';

    const pts = session?.points?.length ?? 0;

    if (session && pts >= 3) {
      const gesture = this.shapeDetector.detect(session);

      // 다른 제스처 인식 성공 → 실행
      if (gesture !== GestureType.UNKNOWN && gesture !== GestureType.X_SHAPE) {
        this.firstStroke = null;
        if (this.xStrokeTimer) { clearTimeout(this.xStrokeTimer); this.xStrokeTimer = null; }
        this.deactivate();
        this.executeGesture(gesture, session.points);
        return;
      }

      // X 두 획 감지: 직선 한 획이면 저장하고 두 번째 대기
      const p = session.points;
      const strokeAngle = Math.atan2(
        p[p.length - 1].y - p[0].y,
        p[p.length - 1].x - p[0].x
      ) * (180 / Math.PI);
      const strokeDist = Math.sqrt(
        (p[p.length - 1].x - p[0].x) ** 2 + (p[p.length - 1].y - p[0].y) ** 2
      );

      if (strokeDist >= 30) {
        if (this.firstStroke) {
          // 두 번째 획: 첫 번째와 각도 차이 확인
          let angleDiff = Math.abs(strokeAngle - this.firstStroke.angle);
          if (angleDiff > 180) angleDiff = 360 - angleDiff;

          if (angleDiff >= 30) {
            // X 인식 성공!
            const allPoints = [...this.firstStroke.points, ...p];
            this.firstStroke = null;
            if (this.xStrokeTimer) { clearTimeout(this.xStrokeTimer); this.xStrokeTimer = null; }
            this.deactivate();
            this.executeGesture(GestureType.X_SHAPE, allPoints);
            return;
          }
        }

        // 첫 번째 획 저장
        this.firstStroke = { points: p, angle: strokeAngle };
        if (this.xStrokeTimer) clearTimeout(this.xStrokeTimer);
        this.xStrokeTimer = window.setTimeout(() => {
          this.firstStroke = null;
          this.xStrokeTimer = null;
        }, this.X_STROKE_TIMEOUT);

        this.showToast(i18n('한 획 더 그리세요', 'Draw one more'), 'bottom');
        return;
      }
    }

    // 인식 실패
    this.showToast(`${pts}pts`, 'bottom');
    if (this.liveCtx && this.liveCanvas) {
      this.liveCtx.clearRect(0, 0, this.liveCanvas.width, this.liveCanvas.height);
    }
  }

  private executeGesture(gesture: GestureType, points?: any[]): void {
    const configKey = GESTURE_CONFIG_KEY[gesture];
    if (configKey && this.config.gesturesEnabled[configKey] !== true) return;

    // 사용량 기록
    this.usageTracker.recordUse();

    this.feedback.show(gesture, points);

    const names: Record<string, [string, string]> = {
      [GestureType.X_SHAPE]: ['X — 탭 닫기', 'X — Close Tab'],
      [GestureType.L_SHAPE]: ['L — 새 탭 열기', 'L — New Tab'],
      [GestureType.CIRCLE]: ['○ — 페이지 내 검색', '○ — Find on Page'],
      [GestureType.C_SHAPE]: ['C — 새로고침', 'C — Hard Refresh'],
    };
    const label = names[gesture];
    if (label) this.showToast(i18n(label[0], label[1]));

    switch (gesture) {
      case GestureType.X_SHAPE:
        browser.runtime.sendMessage({ action: 'closeTab' });
        break;
      case GestureType.L_SHAPE:
        browser.runtime.sendMessage({ action: 'newTab' });
        break;
      case GestureType.CIRCLE:
        this.searchOverlay.show();
        break;
      case GestureType.C_SHAPE:
        browser.runtime.sendMessage({ action: 'clearSiteData' });
        break;
    }

    this.state = 'COOLDOWN';
    this.cooldownTimer = window.setTimeout(() => { this.state = 'IDLE'; this.cooldownTimer = null; }, 500);
  }

  private showSubscriptionPrompt(): void {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; top:0; left:0; right:0; bottom:0;
      z-index:2147483647; display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.6);
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    `;
    el.innerHTML = `
      <div style="background:#1c1c1e;border-radius:16px;padding:28px 24px;max-width:300px;text-align:center;color:#fff;">
        <div style="font-size:32px;margin-bottom:12px;">⚡</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:8px;">
          ${i18n('오늘 무료 사용 완료', 'Free Limit Reached')}
        </div>
        <div style="font-size:13px;color:#98989d;margin-bottom:20px;line-height:1.5;">
          ${i18n(
            '무료 사용자는 하루 10회까지 사용할 수 있습니다.\nOrbit Tap Pro를 구독하면 무제한으로 사용하세요!',
            'Free users can use up to 10 times per day.\nSubscribe to Orbit Tap Pro for unlimited access!'
          )}
        </div>
        <div style="font-size:22px;font-weight:700;color:#0a84ff;margin-bottom:16px;">Pro</div>
        <button id="swift-sub-btn" style="
          width:100%;padding:14px;border:none;border-radius:12px;
          background:#0a84ff;color:#fff;font-size:16px;font-weight:600;cursor:pointer;
          font-family:-apple-system,BlinkMacSystemFont,sans-serif;
        ">${i18n('구독하기', 'Subscribe')}</button>
        <button id="swift-sub-close" style="
          width:100%;padding:10px;border:none;background:none;
          color:#98989d;font-size:13px;cursor:pointer;margin-top:8px;
          font-family:-apple-system,BlinkMacSystemFont,sans-serif;
        ">${i18n('나중에', 'Later')}</button>
      </div>
    `;
    document.documentElement.appendChild(el);

    el.querySelector('#swift-sub-close')?.addEventListener('click', () => el.remove());
    el.querySelector('#swift-sub-btn')?.addEventListener('click', () => {
      // ShieldMail 패턴: URL scheme으로 앱 구독 화면 열기
      window.location.href = 'swiftgesture://subscribe';
      el.remove();
    });
  }
}
