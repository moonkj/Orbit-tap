import { TouchTracker, TouchSession } from './TouchTracker';
import { ShapeDetector, GestureType } from './ShapeDetector';
import { TapDetector } from './TapDetector';
import { IntentDetector } from '../intent/IntentDetector';
import { FeedbackOverlay } from '../ui/FeedbackOverlay';
import type { GestureConfig } from '../config/ConfigBridge';

type GestureState = 'IDLE' | 'DETECTING' | 'RECOGNIZED' | 'COOLDOWN' | 'SUPPRESSED';

/** GestureType → gesturesEnabled キー のマッピング */
const GESTURE_CONFIG_KEY: Partial<Record<GestureType, string>> = {
  [GestureType.SWIPE_BACK]: 'swipeBack',
  [GestureType.SWIPE_FORWARD]: 'swipeForward',
  [GestureType.V_SHAPE]: 'vShape',
  [GestureType.L_SHAPE]: 'lShape',
  [GestureType.DOUBLE_TAP]: 'doubleTap',
  [GestureType.LONG_PRESS]: 'longPress',
  [GestureType.TWO_FINGER_FLICK_UP]: 'twoFingerFlick',
  [GestureType.TWO_FINGER_FLICK_DOWN]: 'twoFingerFlick',
};

/** 배터리 최적화: idle 판정까지의 무터치 대기 시간 (ms) */
const IDLE_TIMEOUT_MS = 30_000;

/** SUPPRESSED → IDLE 복귀를 위해 scrollend 후 대기하는 시간 (ms) */
const SUPPRESSED_RECOVERY_DELAY_MS = 150;

export class GestureEngine {
  private state: GestureState = 'IDLE';
  private touchTracker: TouchTracker;
  private shapeDetector: ShapeDetector;
  private tapDetector: TapDetector;
  private intentDetector: IntentDetector;
  private feedback: FeedbackOverlay;
  private config: GestureConfig;

  // 타이머 핸들
  private cooldownTimer: number | null = null;
  private idleTimer: number | null = null;
  private suppressedRecoveryTimer: number | null = null;

  // AbortController: 활성/idle 모드 각각 관리
  private activeAbort: AbortController | null = null;
  private visibilityAbort: AbortController | null = null;

  /** idle 모드에서 등록되는 touchstart 단일 리스너 — 활성 모드 복귀용 */
  private readonly onIdleTouchStart = (): void => {
    this.enterActiveMode();
  };

  constructor(config: GestureConfig, intentDetector: IntentDetector) {
    this.config = config;
    this.intentDetector = intentDetector;
    this.touchTracker = new TouchTracker();
    this.shapeDetector = new ShapeDetector(config);
    this.tapDetector = new TapDetector(config);
    this.feedback = new FeedbackOverlay();
  }

  // ── 공개 수명주기 ────────────────────────────────────────────────────────

  start(): void {
    this.registerVisibilityListener();
    this.enterActiveMode();
  }

  stop(): void {
    this.activeAbort?.abort();
    this.activeAbort = null;
    this.visibilityAbort?.abort();
    this.visibilityAbort = null;
    this.clearAllTimers();
    document.removeEventListener('touchstart', this.onIdleTouchStart);
  }

  pause(): void {
    this.state = 'SUPPRESSED';
  }

  resume(): void {
    if (this.state === 'SUPPRESSED') {
      this.state = 'IDLE';
    }
  }

  // ── visibilitychange 리스너 ───────────────────────────────────────────────

  private registerVisibilityListener(): void {
    this.visibilityAbort = new AbortController();
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          // 탭이 백그라운드로 전환 → 모든 입력 리스너 해제로 배터리 절약
          this.activeAbort?.abort();
          this.activeAbort = null;
          this.clearIdleTimer();
          document.removeEventListener('touchstart', this.onIdleTouchStart);
        } else {
          // 탭이 다시 보이면 활성 모드로 복귀
          this.enterActiveMode();
        }
      },
      { signal: this.visibilityAbort.signal }
    );
  }

  // ── 활성/idle 모드 전환 ──────────────────────────────────────────────────

  /**
   * 완전 활성 모드: 4개 touch 이벤트 리스너를 모두 등록하고 idle 타이머를 시작.
   */
  private enterActiveMode(): void {
    if (this.activeAbort) return; // 이미 활성 상태

    document.removeEventListener('touchstart', this.onIdleTouchStart);

    this.activeAbort = new AbortController();
    const signal = this.activeAbort.signal;

    document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true, signal });
    document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true, signal });
    document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true, signal });
    document.addEventListener('touchcancel', this.onTouchCancel.bind(this), { passive: true, signal });

    this.state = 'IDLE';
    this.resetIdleTimer();
  }

  /**
   * idle 모드: 3개 이동성 리스너를 해제하고 touchstart 단일 리스너만 유지.
   * GC 및 배터리 절약을 위해 touch 이벤트 처리를 최소화한다.
   */
  private enterIdleMode(): void {
    if (!this.activeAbort) return; // 이미 idle 또는 stopped

    this.activeAbort.abort();
    this.activeAbort = null;
    this.clearIdleTimer();

    // 다음 터치가 오면 즉시 활성 모드로 복귀
    document.addEventListener('touchstart', this.onIdleTouchStart, { passive: true });
  }

  // ── Idle 타이머 ──────────────────────────────────────────────────────────

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = window.setTimeout(() => {
      this.idleTimer = null;
      this.enterIdleMode();
    }, IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  // ── Touch 이벤트 핸들러 ──────────────────────────────────────────────────

  private onTouchStart(e: TouchEvent): void {
    // 활성 모드이므로 idle 타이머 재시작
    this.resetIdleTimer();

    if (this.state === 'COOLDOWN' || this.state === 'SUPPRESSED') return;

    if (this.intentDetector.isScrolling() || this.intentDetector.isInputFocused()) {
      this.state = 'SUPPRESSED';
      this.scheduleSuppressedRecovery();
      return;
    }

    this.touchTracker.onTouchStart(e);
    this.tapDetector.onTouchStart(e);
    this.state = 'DETECTING';
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.state !== 'DETECTING') return;
    this.touchTracker.onTouchMove(e);
  }

  private onTouchEnd(e: TouchEvent): void {
    // 터치가 끝날 때마다 idle 타이머 재시작
    this.resetIdleTimer();

    if (this.state === 'COOLDOWN' || this.state === 'SUPPRESSED') {
      // SUPPRESSED 상태에서 스크롤이 끝났으면 즉시 복귀 시도
      if (
        this.state === 'SUPPRESSED' &&
        !this.intentDetector.isScrolling() &&
        !this.intentDetector.isInputFocused()
      ) {
        this.state = 'IDLE';
        this.clearSuppressedRecoveryTimer();
      }
      return;
    }

    const session = this.touchTracker.onTouchEnd(e);
    const tapResult = this.tapDetector.onTouchEnd(e);

    if (session && session.points.length >= 3) {
      const gesture = this.shapeDetector.detect(session);
      if (gesture !== GestureType.UNKNOWN) {
        this.executeGesture(gesture);
        return;
      }
    }

    if (tapResult) {
      this.executeGesture(tapResult);
    }
  }

  private onTouchCancel(_e: TouchEvent): void {
    this.touchTracker.reset();
    this.state = 'IDLE';
    this.resetIdleTimer();
  }

  // ── SUPPRESSED 자동 복귀 (scrollend 후 150ms) ────────────────────────────

  private scheduleSuppressedRecovery(): void {
    this.clearSuppressedRecoveryTimer();

    const tryRecover = () => {
      if (this.state !== 'SUPPRESSED') return;
      if (this.intentDetector.isScrolling() || this.intentDetector.isInputFocused()) {
        // 아직 스크롤 중 — scrollend 이벤트를 한 번 더 기다림
        document.addEventListener('scrollend', tryRecover, { once: true, passive: true });
        return;
      }
      this.suppressedRecoveryTimer = window.setTimeout(() => {
        this.suppressedRecoveryTimer = null;
        if (this.state === 'SUPPRESSED') {
          this.state = 'IDLE';
        }
      }, SUPPRESSED_RECOVERY_DELAY_MS);
    };

    // scrollend 이벤트가 발생하면 복귀 시도
    document.addEventListener('scrollend', tryRecover, { once: true, passive: true });
  }

  private clearSuppressedRecoveryTimer(): void {
    if (this.suppressedRecoveryTimer !== null) {
      clearTimeout(this.suppressedRecoveryTimer);
      this.suppressedRecoveryTimer = null;
    }
  }

  // ── 제스처 실행 ──────────────────────────────────────────────────────────

  private executeGesture(gesture: GestureType): void {
    // gesturesEnabled 체크: config에서 해당 제스처가 비활성이면 무시
    const configKey = GESTURE_CONFIG_KEY[gesture];
    if (configKey && this.config.gesturesEnabled[configKey] === false) {
      this.state = 'IDLE';
      return;
    }

    this.state = 'RECOGNIZED';
    this.feedback.show(gesture);

    const cooldownMs = this.getCooldown(gesture);

    switch (gesture) {
      case GestureType.SWIPE_BACK:
        browser.runtime.sendMessage({ action: 'navigate', direction: 'back' });
        break;
      case GestureType.SWIPE_FORWARD:
        browser.runtime.sendMessage({ action: 'navigate', direction: 'forward' });
        break;
      case GestureType.V_SHAPE:
        browser.runtime.sendMessage({ action: 'closeTab' });
        break;
      case GestureType.L_SHAPE:
        browser.runtime.sendMessage({ action: 'restoreTab' });
        break;
      case GestureType.DOUBLE_TAP:
        this.showSearchBar();
        break;
      case GestureType.LONG_PRESS:
        this.scrollToEdge();
        break;
      case GestureType.TWO_FINGER_FLICK_UP:
        location.reload();
        break;
      case GestureType.TWO_FINGER_FLICK_DOWN:
        document.documentElement.requestFullscreen?.();
        break;
    }

    this.enterCooldown(cooldownMs);
  }

  private getCooldown(gesture: GestureType): number {
    switch (gesture) {
      case GestureType.SWIPE_BACK:
      case GestureType.SWIPE_FORWARD:
        return this.config.cooldownSwipe;
      case GestureType.V_SHAPE:
      case GestureType.L_SHAPE:
        return this.config.cooldownShape;
      case GestureType.DOUBLE_TAP:
        return this.config.cooldownTap;
      case GestureType.TWO_FINGER_FLICK_UP:
      case GestureType.TWO_FINGER_FLICK_DOWN:
        return this.config.cooldownTwoFinger;
      default:
        return 300;
    }
  }

  private enterCooldown(ms: number): void {
    this.state = 'COOLDOWN';
    this.cooldownTimer = window.setTimeout(() => {
      this.state = 'IDLE';
      this.cooldownTimer = null;
    }, ms);
  }

  private clearAllTimers(): void {
    if (this.cooldownTimer !== null) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
    this.clearIdleTimer();
    this.clearSuppressedRecoveryTimer();
  }

  // ── 유틸리티 ─────────────────────────────────────────────────────────────

  private showSearchBar(): void {
    // TODO: Implement in-page search bar
  }

  private scrollToEdge(): void {
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollY < maxScroll / 2) {
      window.scrollTo({ top: maxScroll, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
