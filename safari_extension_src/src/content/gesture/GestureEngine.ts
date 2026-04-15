import { TouchTracker, TouchSession } from './TouchTracker';
import { ShapeDetector, GestureType } from './ShapeDetector';
import { TapDetector } from './TapDetector';
import { IntentDetector } from '../intent/IntentDetector';
import { FeedbackOverlay } from '../ui/FeedbackOverlay';
import type { GestureConfig } from '../config/ConfigBridge';

type GestureState = 'IDLE' | 'DETECTING' | 'RECOGNIZED' | 'COOLDOWN' | 'SUPPRESSED';

export class GestureEngine {
  private state: GestureState = 'IDLE';
  private touchTracker: TouchTracker;
  private shapeDetector: ShapeDetector;
  private tapDetector: TapDetector;
  private intentDetector: IntentDetector;
  private feedback: FeedbackOverlay;
  private config: GestureConfig;
  private cooldownTimer: number | null = null;
  private abortController: AbortController | null = null;

  constructor(config: GestureConfig, intentDetector: IntentDetector) {
    this.config = config;
    this.intentDetector = intentDetector;
    this.touchTracker = new TouchTracker();
    this.shapeDetector = new ShapeDetector(config);
    this.tapDetector = new TapDetector(config);
    this.feedback = new FeedbackOverlay();
  }

  start(): void {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true, signal });
    document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true, signal });
    document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true, signal });
    document.addEventListener('touchcancel', this.onTouchCancel.bind(this), { passive: true, signal });

    this.state = 'IDLE';
  }

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
    if (this.cooldownTimer) {
      clearTimeout(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  pause(): void {
    this.state = 'SUPPRESSED';
  }

  resume(): void {
    this.state = 'IDLE';
  }

  private onTouchStart(e: TouchEvent): void {
    if (this.state === 'COOLDOWN' || this.state === 'SUPPRESSED') return;
    if (this.intentDetector.isScrolling() || this.intentDetector.isInputFocused()) {
      this.state = 'SUPPRESSED';
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
    if (this.state === 'COOLDOWN' || this.state === 'SUPPRESSED') {
      if (this.state === 'SUPPRESSED' && !this.intentDetector.isScrolling() && !this.intentDetector.isInputFocused()) {
        this.state = 'IDLE';
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
  }

  private executeGesture(gesture: GestureType): void {
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
