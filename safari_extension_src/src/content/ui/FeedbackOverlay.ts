import { GestureType } from '../gesture/ShapeDetector';
import type { TouchPoint } from '../gesture/TouchTracker';

/**
 * 제스처 인식 시 손가락 궤적을 따라 그려지는 트레일 애니메이션
 * Apple 스타일: 70% 투명도, 0.3~0.5초 표시 후 페이드아웃
 */
export class FeedbackOverlay {
  private canvas: HTMLCanvasElement | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private animId: number | null = null;

  show(gesture: GestureType, points?: TouchPoint[]): void {
    this.hide();

    if (!points || points.length < 3) return;

    // Canvas 생성
    this.canvas = document.createElement('canvas');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100%; height: 100%;
      z-index: 2147483645;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
    `;
    document.documentElement.appendChild(this.canvas);

    // 페이드인
    requestAnimationFrame(() => {
      if (this.canvas) this.canvas.style.opacity = '1';
    });

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;

    const color = this.getColor(gesture);

    // 궤적 애니메이션 (포인트를 순차적으로 그림)
    const totalDuration = 350; // ms
    const startTime = performance.now();
    const totalPoints = points.length;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);
      const drawCount = Math.floor(progress * totalPoints);

      ctx.clearRect(0, 0, this.canvas!.width, this.canvas!.height);

      if (drawCount < 2) {
        this.animId = requestAnimationFrame(animate);
        return;
      }

      // 그라데이션 트레일
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 1; i < drawCount; i++) {
        const t = i / totalPoints;
        ctx.beginPath();
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
        ctx.lineTo(points[i].x, points[i].y);

        // 뒤쪽은 얇고 투명, 앞쪽은 굵고 선명
        const alpha = 0.3 + t * 0.4;
        const width = 2 + t * 3;
        ctx.strokeStyle = color.replace('ALPHA', String(alpha));
        ctx.lineWidth = width;
        ctx.stroke();
      }

      if (progress < 1) {
        this.animId = requestAnimationFrame(animate);
      } else {
        // 완료 후 페이드아웃
        setTimeout(() => {
          if (this.canvas) {
            this.canvas.style.opacity = '0';
            setTimeout(() => this.hide(), 200);
          }
        }, 150);
      }
    };

    this.animId = requestAnimationFrame(animate);
  }

  private hide(): void {
    if (this.animId) { cancelAnimationFrame(this.animId); this.animId = null; }
    this.canvas?.remove();
    this.canvas = null;
  }

  private getColor(gesture: GestureType): string {
    const colors: Record<string, string> = {
      [GestureType.V_SHAPE]: 'rgba(255, 69, 58, ALPHA)',      // 레드
      [GestureType.L_SHAPE]: 'rgba(48, 209, 88, ALPHA)',      // 그린
      [GestureType.CIRCLE]: 'rgba(10, 132, 255, ALPHA)',      // 블루
      [GestureType.C_SHAPE]: 'rgba(255, 159, 10, ALPHA)',     // 오렌지
      [GestureType.DIAGONAL_SWIPE_UP]: 'rgba(175, 82, 222, ALPHA)', // 퍼플
    };
    return colors[gesture] ?? 'rgba(255, 255, 255, ALPHA)';
  }
}
