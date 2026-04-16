import type { GestureConfig } from '../config/ConfigBridge';

type ButtonAction = 'back' | 'forward' | 'tabOverview' | 'gestureGuide';

const SIZE_MAP: Record<string, number> = {
  small: 42,
  medium: 52,
  large: 64,
};

export class FloatingButton {
  private host: HTMLElement | null = null;
  private button: HTMLElement | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private guideOverlay: HTMLElement | null = null;
  private config: GestureConfig;
  private isDragging = false;
  private dragReady = false; // long-press 완료 후 드래그 가능 상태
  private currentX: number;
  private currentY: number;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartTime = 0;
  private totalDragDistance = 0;
  private rafId: number | null = null;
  private tapCount = 0;
  private tapTimer: number | null = null;
  private longPressTimer: number | null = null;
  private readonly TAP_TIMEOUT = 350;
  private readonly LONG_PRESS_DURATION = 5000;
  private abortController: AbortController | null = null;

  constructor(config: GestureConfig) {
    this.config = config;
    this.currentX = window.innerWidth - 60;
    this.currentY = window.innerHeight * 0.7;
  }

  private getButtonSize(): number {
    return SIZE_MAP[this.config.buttonSize] ?? 48;
  }

  private getOpacity(): number {
    return (this.config.buttonOpacity ?? 90) / 100;
  }

  async mount(): Promise<void> {
    // Guard: already mounted
    if (this.host) return;

    // 기존 DOM 잔존물 제거 (이전 인스턴스 / 페이지 캐시 / 확장 리로드 대응)
    const existing = document.getElementById('swift-gesture-host');
    if (existing) existing.remove();
    const existingStyles = document.querySelectorAll('style[data-swift-fb]');
    existingStyles.forEach(el => el.remove());

    const size = this.getButtonSize();
    const opacity = this.getOpacity();

    // Inject scoped styles via <style> tag (no Shadow DOM — iOS Safari compatible)
    this.styleEl = document.createElement('style');
    this.styleEl.setAttribute('data-swift-fb', '1');
    const rad = Math.round(size * 0.22);
    this.styleEl.textContent = `
      #swift-gesture-host { all: initial; display: block; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none; }
      .swift-fb {
        position: fixed;
        width: ${size}px;
        height: ${size}px;
        border-radius: ${rad}px;
        background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.12), transparent 60%),
                    linear-gradient(145deg, rgba(60,60,68,0.7), rgba(28,28,30,0.75));
        -webkit-backdrop-filter: saturate(180%) blur(24px);
        backdrop-filter: saturate(180%) blur(24px);
        border: 0.5px solid rgba(255, 255, 255, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2147483647;
        will-change: transform, opacity;
        transform: translate3d(0, 0, 0);
        touch-action: none;
        -webkit-backface-visibility: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.12),
                    0 4px 14px rgba(0,0,0,0.18),
                    inset 0 0.5px 0 rgba(255,255,255,0.08);
        transition: opacity 0.2s ease;
        user-select: none;
        -webkit-user-select: none;
        pointer-events: auto;
        opacity: ${opacity};
      }
      .swift-fb.ready {
        transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1), box-shadow 0.3s ease;
      }
      .swift-fb.drag-ready {
        transform: scale(1.12);
        box-shadow: 0 2px 6px rgba(0,0,0,0.15),
                    0 8px 28px rgba(0,0,0,0.25),
                    inset 0 0.5px 0 rgba(255,255,255,0.12);
      }
      .swift-fb.pressed {
        transform: scale(0.88);
        box-shadow: 0 1px 4px rgba(0,0,0,0.2),
                    inset 0 1px 3px rgba(0,0,0,0.15);
      }
      .swift-fb.pressed svg circle {
        transform: scale(0.85);
        transform-origin: center;
        transition: transform 0.1s ease;
      }
      .swift-fb.dragging {
        transition: none !important;
        opacity: 0.6;
      }
      .swift-fb svg {
        width: 70%;
        height: 70%;
        pointer-events: none;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25));
      }
      .swift-guide {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.85);
        z-index: 2147483646;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 24px;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        opacity: 0;
        transition: opacity 0.2s ease;
        pointer-events: auto;
      }
      .swift-guide.visible { opacity: 1; }
      .swift-guide h2 { font-size: 22px; margin: 0; }
      .swift-guide-item {
        display: flex; align-items: center; gap: 16px;
        padding: 12px 20px; background: rgba(255,255,255,0.1);
        border-radius: 12px; min-width: 260px;
      }
      .swift-guide-icon { font-size: 24px; width: 40px; text-align: center; }
      .swift-guide-text { font-size: 14px; }
      .swift-guide-label { font-weight: 600; }
      .swift-guide-desc { color: rgba(255,255,255,0.6); font-size: 12px; }
    `;
    document.head.appendChild(this.styleEl);

    // Host container (no Shadow DOM)
    this.host = document.createElement('div');
    this.host.id = 'swift-gesture-host';

    this.button = document.createElement('div');
    this.button.className = 'swift-fb';
    this.button.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><defs><linearGradient id="sr" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="rgba(255,255,255,0.95)"/><stop offset="100%" stop-color="rgba(255,255,255,0.4)"/></linearGradient><radialGradient id="sf" cx="40%" cy="38%" r="50%"><stop offset="0%" stop-color="rgba(255,255,255,0.12)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs><circle cx="12" cy="12" r="8" stroke="url(#sr)" stroke-width="1.8"/><circle cx="12" cy="12" r="7" fill="url(#sf)"/></svg>`;

    this.host.appendChild(this.button);
    document.documentElement.appendChild(this.host);

    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    this.button.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false, signal });
    this.button.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false, signal });
    this.button.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true, signal });

    // Load saved position from storage
    try {
      const data = await browser.storage.local.get('floatingBtnPos');
      if (data?.floatingBtnPos) {
        this.currentX = data.floatingBtnPos.x;
        this.currentY = data.floatingBtnPos.y;
      }
    } catch {}

    // Clamp position to viewport
    const btnSize = this.getButtonSize();
    this.currentX = Math.max(0, Math.min(this.currentX, window.innerWidth - btnSize));
    this.currentY = Math.max(0, Math.min(this.currentY, window.innerHeight - btnSize));

    this.updatePosition();

    // 위치 설정 후 다음 프레임에서 transition 활성화 (날아오는 효과 방지)
    requestAnimationFrame(() => {
      this.button?.classList.add('ready');
    });
  }

  unmount(): void {
    this.abortController?.abort();
    this.host?.remove();
    this.styleEl?.remove();
    this.host = null;
    this.styleEl = null;
    this.button = null;
    if (this.tapTimer) clearTimeout(this.tapTimer);
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  /**
   * 외부에서 config 변경 시 호출 — 크기/투명도 실시간 반영
   */
  updateConfig(config: GestureConfig): void {
    const oldSize = this.getButtonSize();
    this.config = config;
    const newSize = this.getButtonSize();
    const newOpacity = this.getOpacity();

    if (!this.button || !this.styleEl) return;

    // 크기 변경 시 스타일 재생성
    if (oldSize !== newSize) {
      this.button.style.width = `${newSize}px`;
      this.button.style.height = `${newSize}px`;
      this.button.style.borderRadius = `${newSize / 2}px`;
      const svg = this.button.querySelector('svg') as unknown as HTMLElement | null;
      if (svg) {
        const svgSize = Math.round(newSize * 0.46);
        svg.style.width = `${svgSize}px`;
        svg.style.height = `${svgSize}px`;
      }
    }

    // 투명도 변경
    this.button.style.opacity = `${newOpacity}`;

    // 위치 재조정 (화면 밖으로 나가지 않도록)
    this.currentX = Math.max(0, Math.min(this.currentX, window.innerWidth - newSize));
    this.currentY = Math.max(0, Math.min(this.currentY, window.innerHeight - newSize));
    this.updatePosition();
  }

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();

    this.isDragging = false;
    this.dragReady = false;
    this.totalDragDistance = 0;
    this.dragStartX = e.touches[0].clientX;
    this.dragStartY = e.touches[0].clientY;
    this.dragStartTime = performance.now();

    // 눌림 효과
    this.button?.classList.add('pressed');

    // 꾹 누르기 감지: LONG_PRESS_DURATION 후 드래그 가능 상태로 전환
    this.longPressTimer = window.setTimeout(() => {
      if (this.totalDragDistance < 25) {
        this.dragReady = true;
        this.button?.classList.add('drag-ready');
        // 햅틱 피드백 (지원 시)
        if (navigator.vibrate) navigator.vibrate(30);
      }
    }, this.LONG_PRESS_DURATION);
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.button) return;

    const dx = e.touches[0].clientX - this.dragStartX;
    const dy = e.touches[0].clientY - this.dragStartY;
    this.totalDragDistance = Math.sqrt(dx * dx + dy * dy);

    // 드래그 준비 전에 많이 움직이면 long press 취소
    if (!this.dragReady && this.totalDragDistance > 25) {
      if (this.longPressTimer) {
        clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      return;
    }

    // 꾹 누른 후에만 드래그 시작
    if (this.dragReady && this.totalDragDistance > 5) {
      this.isDragging = true;
      e.preventDefault();

      const size = this.getButtonSize();
      this.currentX = e.touches[0].clientX - size / 2;
      this.currentY = e.touches[0].clientY - size / 2;

      // Clamp to viewport
      this.currentX = Math.max(0, Math.min(this.currentX, window.innerWidth - size));
      this.currentY = Math.max(60, Math.min(this.currentY, window.innerHeight - size - 60));

      if (!this.button.classList.contains('dragging')) {
        this.button.classList.remove('drag-ready');
        this.button.classList.add('dragging');
      }

      if (!this.rafId) {
        this.rafId = requestAnimationFrame(() => {
          this.updatePosition();
          this.rafId = null;
        });
      }
    }
  }

  private onTouchEnd(_e: TouchEvent): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    this.button?.classList.remove('drag-ready');
    this.button?.classList.remove('dragging');
    this.button?.classList.remove('pressed');

    if (this.isDragging) {
      this.isDragging = false;
      this.dragReady = false;
      // 자유 배치: 스냅 없이 현재 위치에 그대로 저장
      this.updatePosition();
      this.savePosition();
      return;
    }

    // 꾹 눌러서 drag-ready 됐지만 안 움직인 경우 → 제스처 가이드
    if (this.dragReady) {
      this.dragReady = false;
      this.executeTapAction('gestureGuide');
      return;
    }

    // 탭 감지
    const duration = performance.now() - this.dragStartTime;
    if (duration < this.LONG_PRESS_DURATION && this.totalDragDistance < 10) {
      this.tapCount++;
      if (this.tapTimer) clearTimeout(this.tapTimer);

      this.tapTimer = window.setTimeout(() => {
        switch (this.tapCount) {
          case 1: this.executeTapAction('back'); break;
          case 2: this.executeTapAction('forward'); break;
          default: this.executeTapAction('tabOverview'); break;
        }
        this.tapCount = 0;
      }, this.TAP_TIMEOUT);
    }
  }

  private executeTapAction(action: ButtonAction): void {
    switch (action) {
      case 'back':
        browser.runtime.sendMessage({ action: 'navigate', direction: 'back' });
        break;
      case 'forward':
        browser.runtime.sendMessage({ action: 'navigate', direction: 'forward' });
        break;
      case 'tabOverview':
        browser.runtime.sendMessage({ action: 'navigate', direction: 'back' });
        break;
      case 'gestureGuide':
        this.showGestureGuide();
        break;
    }
    browser.runtime.sendMessage({ action: 'logGesture', gestureType: `button_${action}` });
  }

  private updatePosition(): void {
    if (!this.button) return;
    const size = this.getButtonSize();
    const x = Math.max(0, Math.min(this.currentX, window.innerWidth - size));
    const y = Math.max(0, Math.min(this.currentY, window.innerHeight - size));
    this.button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  }

  private savePosition(): void {
    try {
      browser.storage.local.set({
        floatingBtnPos: { x: this.currentX, y: this.currentY }
      });
    } catch {}
  }

  private showGestureGuide(): void {
    if (!this.host) return;

    const existing = this.host.querySelector('.swift-guide');
    if (existing) { existing.remove(); return; }

    this.guideOverlay = document.createElement('div');
    this.guideOverlay.className = 'swift-guide';
    this.guideOverlay.innerHTML = `
      <h2>Swift Gesture Guide</h2>
      <div class="swift-guide-item">
        <div class="swift-guide-icon" style="color:#FF453A">V</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">V 모양</div>
          <div class="swift-guide-desc">현재 탭 닫기</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon" style="color:#30D158">L</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">L 모양</div>
          <div class="swift-guide-desc">닫은 탭 복구</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon" style="color:#0A84FF">○</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">원 그리기</div>
          <div class="swift-guide-desc">페이지 내 텍스트 검색</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon" style="color:#FF9F0A">C</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">C 모양</div>
          <div class="swift-guide-desc">쿠키/캐시 삭제 및 새로고침</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon" style="color:#AF52DE">↗</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">대각선 위로</div>
          <div class="swift-guide-desc">새 빈 탭 열기</div>
        </div>
      </div>
    `;

    this.guideOverlay.addEventListener('click', () => {
      this.guideOverlay?.remove();
      this.guideOverlay = null;
    }, { once: true });

    this.host.appendChild(this.guideOverlay);
    requestAnimationFrame(() => this.guideOverlay?.classList.add('visible'));
  }
}
