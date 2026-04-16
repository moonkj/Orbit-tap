import { TouchTracker } from './TouchTracker';
import { ShapeDetector, GestureType } from './ShapeDetector';
import { IntentDetector } from '../intent/IntentDetector';
import { FeedbackOverlay } from '../ui/FeedbackOverlay';
import { SearchOverlay } from '../ui/SearchOverlay';
import type { GestureConfig } from '../config/ConfigBridge';

type GestureState = 'IDLE' | 'DETECTING' | 'GESTURE_LOCKED' | 'RECOGNIZED' | 'COOLDOWN';

const GESTURE_CONFIG_KEY: Partial<Record<GestureType, string>> = {
  [GestureType.V_SHAPE]: 'vShape',
  [GestureType.L_SHAPE]: 'lShape',
  [GestureType.CIRCLE]: 'circle',
  [GestureType.C_SHAPE]: 'cShape',
  [GestureType.DIAGONAL_SWIPE_UP]: 'diagonalSwipeUp',
};

const IDLE_TIMEOUT_MS = 30_000;

export class GestureEngine {
  private state: GestureState = 'IDLE';
  private touchTracker: TouchTracker;
  private shapeDetector: ShapeDetector;
  private intentDetector: IntentDetector;
  private feedback: FeedbackOverlay;
  private searchOverlay: SearchOverlay;
  private config: GestureConfig;

  private cooldownTimer: number | null = null;
  private idleTimer: number | null = null;
  private activeAbort: AbortController | null = null;
  private visibilityAbort: AbortController | null = null;

  // 스크롤 vs 제스처 판별용
  private moveCount = 0;
  private startX = 0;
  private startY = 0;
  private isGestureLocked = false; // true면 스크롤 차단, 제스처 캡처 중

  private readonly onIdleTouchStart = (): void => { this.enterActiveMode(); };

  constructor(config: GestureConfig, intentDetector: IntentDetector) {
    this.config = config;
    this.intentDetector = intentDetector;
    this.touchTracker = new TouchTracker();
    this.shapeDetector = new ShapeDetector(config);
    this.feedback = new FeedbackOverlay();
    this.searchOverlay = new SearchOverlay();
  }

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

  pause(): void { this.state = 'IDLE'; }
  resume(): void { this.state = 'IDLE'; }

  private registerVisibilityListener(): void {
    this.visibilityAbort = new AbortController();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.activeAbort?.abort();
        this.activeAbort = null;
        this.clearIdleTimer();
        document.removeEventListener('touchstart', this.onIdleTouchStart);
      } else {
        this.enterActiveMode();
      }
    }, { signal: this.visibilityAbort.signal });
  }

  private enterActiveMode(): void {
    if (this.activeAbort) return;
    document.removeEventListener('touchstart', this.onIdleTouchStart);

    this.activeAbort = new AbortController();
    const signal = this.activeAbort.signal;

    // touchstart: passive로 시작 (스크롤 차단 안 함)
    document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true, signal });
    // touchmove: passive: FALSE → 제스처 감지 시 preventDefault 가능
    document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false, signal });
    document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true, signal });
    // touchcancel도 제스처 분석 시도
    document.addEventListener('touchcancel', this.onTouchCancel.bind(this), { passive: true, signal });

    this.state = 'IDLE';
    this.resetIdleTimer();
  }

  private enterIdleMode(): void {
    if (!this.activeAbort) return;
    this.activeAbort.abort();
    this.activeAbort = null;
    this.clearIdleTimer();
    document.addEventListener('touchstart', this.onIdleTouchStart, { passive: true });
  }

  private resetIdleTimer(): void {
    this.clearIdleTimer();
    this.idleTimer = window.setTimeout(() => { this.idleTimer = null; this.enterIdleMode(); }, IDLE_TIMEOUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) { clearTimeout(this.idleTimer); this.idleTimer = null; }
  }

  // ── Touch Handlers ──────────────────────────────────────────
  private onTouchStart(e: TouchEvent): void {
    this.resetIdleTimer();
    if (this.state === 'COOLDOWN') return;
    if (this.intentDetector.isInputFocused()) return;
    if (e.touches.length > 1) return; // 멀티터치 무시

    this.touchTracker.onTouchStart(e);
    this.state = 'DETECTING';
    this.moveCount = 0;
    this.isGestureLocked = false;
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.state !== 'DETECTING' && this.state !== 'GESTURE_LOCKED') return;

    this.touchTracker.onTouchMove(e);
    this.moveCount++;

    const dx = e.touches[0].clientX - this.startX;
    const dy = e.touches[0].clientY - this.startY;

    // 3번째 touchmove 이후 스크롤 vs 제스처 판별
    if (!this.isGestureLocked && this.moveCount >= 3) {
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const totalDist = Math.sqrt(dx * dx + dy * dy);

      // 순수 세로 스크롤이면 제스처 포기 (세로 이동이 가로의 3배 이상)
      if (absDy > absDx * 3 && totalDist > 15) {
        this.state = 'IDLE';
        this.touchTracker.reset();
        return;
      }

      // 비스크롤 패턴이면 제스처 잠금 (스크롤 차단)
      if (totalDist > 15) {
        this.isGestureLocked = true;
        this.state = 'GESTURE_LOCKED';
      }
    }

    // 제스처 잠금 상태면 스크롤 차단
    if (this.isGestureLocked) {
      e.preventDefault();
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    this.resetIdleTimer();
    if (this.state !== 'DETECTING' && this.state !== 'GESTURE_LOCKED') return;
    this.analyzeAndExecute(e);
  }

  private onTouchCancel(e: TouchEvent): void {
    this.resetIdleTimer();
    // touchcancel도 포인트 분석 시도 (브라우저가 스크롤로 가져갔을 때)
    if (this.state === 'DETECTING' || this.state === 'GESTURE_LOCKED') {
      this.analyzeAndExecute(e);
    } else {
      this.touchTracker.reset();
      this.state = 'IDLE';
    }
  }

  private analyzeAndExecute(e: TouchEvent): void {
    const session = this.touchTracker.onTouchEnd(e);
    this.state = 'IDLE';
    this.isGestureLocked = false;

    if (session && session.points.length >= 4) {
      const gesture = this.shapeDetector.detect(session);
      if (gesture !== GestureType.UNKNOWN) {
        this.executeGesture(gesture, session.points);
      }
    }
  }

  // ── 제스처 실행 ─────────────────────────────────────────────
  private executeGesture(gesture: GestureType, points?: any[]): void {
    const configKey = GESTURE_CONFIG_KEY[gesture];
    if (configKey && this.config.gesturesEnabled[configKey] === false) {
      this.state = 'IDLE';
      return;
    }

    this.state = 'RECOGNIZED';
    this.feedback.show(gesture, points);

    switch (gesture) {
      case GestureType.V_SHAPE:
        browser.runtime.sendMessage({ action: 'closeTab' });
        break;
      case GestureType.L_SHAPE:
        browser.runtime.sendMessage({ action: 'restoreTab' });
        break;
      case GestureType.CIRCLE:
        this.searchOverlay.show();
        break;
      case GestureType.C_SHAPE:
        browser.runtime.sendMessage({ action: 'clearSiteData' });
        break;
      case GestureType.DIAGONAL_SWIPE_UP:
        browser.runtime.sendMessage({ action: 'newTab' });
        break;
    }

    this.enterCooldown(500);
  }

  private enterCooldown(ms: number): void {
    this.state = 'COOLDOWN';
    this.cooldownTimer = window.setTimeout(() => { this.state = 'IDLE'; this.cooldownTimer = null; }, ms);
  }

  private clearAllTimers(): void {
    if (this.cooldownTimer !== null) { clearTimeout(this.cooldownTimer); this.cooldownTimer = null; }
    this.clearIdleTimer();
  }
}
