export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface TouchSession {
  points: TouchPoint[];
  secondFingerPoints: TouchPoint[];
  fingerCount: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export class TouchTracker {
  private readonly maxPoints = 128;

  // Primary finger ring buffers
  private xBuffer: Float32Array;
  private yBuffer: Float32Array;
  private tBuffer: Float64Array;
  private head = 0;
  private length = 0;

  // Second finger ring buffers (timestamp 불필요 — 방향 계산에만 사용)
  private x2Buffer: Float32Array;
  private y2Buffer: Float32Array;
  private head2 = 0;
  private length2 = 0;

  private fingerCount = 0;
  private startTime = 0;
  private lastSampleTime = 0;

  // Adaptive sampling
  private readonly baseInterval = 33;   // 30Hz
  private readonly preciseInterval = 16; // 60Hz
  private currentInterval: number;
  private directionChanges = 0;
  private lastDx = 0;
  private lastDy = 0;

  constructor() {
    this.xBuffer = new Float32Array(this.maxPoints);
    this.yBuffer = new Float32Array(this.maxPoints);
    this.tBuffer = new Float64Array(this.maxPoints);
    this.x2Buffer = new Float32Array(this.maxPoints);
    this.y2Buffer = new Float32Array(this.maxPoints);
    this.currentInterval = this.baseInterval;
  }

  onTouchStart(e: TouchEvent): void {
    // Ring buffer 초기화
    this.head = 0;
    this.length = 0;
    this.head2 = 0;
    this.length2 = 0;

    // Adaptive sampling 상태 초기화
    this.directionChanges = 0;
    this.lastDx = 0;
    this.lastDy = 0;
    this.currentInterval = this.baseInterval;

    this.fingerCount = e.touches.length;
    this.startTime = performance.now();
    this.lastSampleTime = 0;

    this.pushPoint(e.touches[0].clientX, e.touches[0].clientY, this.startTime);

    if (e.touches.length >= 2) {
      this.pushSecondFinger(e.touches[1].clientX, e.touches[1].clientY);
    }
  }

  onTouchMove(e: TouchEvent): void {
    const now = performance.now();
    if (now - this.lastSampleTime < this.currentInterval) return;

    this.lastSampleTime = now;
    this.fingerCount = Math.max(this.fingerCount, e.touches.length);

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    // 방향 전환 감지 → V/L 형태이므로 60Hz 정밀 샘플링으로 전환
    if (this.length > 1) {
      const prevIdx = (this.head - 1 + this.maxPoints) % this.maxPoints;
      const dx = x - this.xBuffer[prevIdx];
      const dy = y - this.yBuffer[prevIdx];

      if ((this.lastDx !== 0 && dx * this.lastDx < 0) || (this.lastDy !== 0 && dy * this.lastDy < 0)) {
        this.directionChanges++;
        if (this.directionChanges >= 1) {
          this.currentInterval = this.preciseInterval; // 60Hz로 전환
        }
      }

      this.lastDx = dx;
      this.lastDy = dy;
    }

    this.pushPoint(x, y, now);

    if (e.touches.length >= 2) {
      this.pushSecondFinger(e.touches[1].clientX, e.touches[1].clientY);
    }
  }

  onTouchEnd(_e: TouchEvent): TouchSession | null {
    if (this.length < 2) return null;

    const endTime = performance.now();
    return {
      points: this.getPoints(),
      secondFingerPoints: this.getSecondFingerPoints(),
      fingerCount: this.fingerCount,
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime,
    };
  }

  getSession(): TouchSession | null {
    if (this.length < 2) return null;
    const endTime = performance.now();
    return {
      points: this.getPoints(),
      secondFingerPoints: this.getSecondFingerPoints(),
      fingerCount: this.fingerCount,
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime,
    };
  }

  reset(): void {
    this.head = 0;
    this.length = 0;
    this.head2 = 0;
    this.length2 = 0;
    this.fingerCount = 0;
    this.startTime = 0;
    this.lastSampleTime = 0;
    this.currentInterval = this.baseInterval;
    this.directionChanges = 0;
    this.lastDx = 0;
    this.lastDy = 0;
  }

  // ── Ring Buffer helpers ────────────────────────────────────────────────────

  private pushPoint(x: number, y: number, t: number): void {
    this.xBuffer[this.head] = x;
    this.yBuffer[this.head] = y;
    this.tBuffer[this.head] = t;
    this.head = (this.head + 1) % this.maxPoints;
    if (this.length < this.maxPoints) this.length++;
  }

  private pushSecondFinger(x: number, y: number): void {
    this.x2Buffer[this.head2] = x;
    this.y2Buffer[this.head2] = y;
    this.head2 = (this.head2 + 1) % this.maxPoints;
    if (this.length2 < this.maxPoints) this.length2++;
  }

  /** Ring Buffer를 시간순 배열로 읽기 */
  private getPoints(): TouchPoint[] {
    const result: TouchPoint[] = [];
    for (let i = 0; i < this.length; i++) {
      const idx = (this.head - this.length + i + this.maxPoints) % this.maxPoints;
      result.push({
        x: this.xBuffer[idx],
        y: this.yBuffer[idx],
        timestamp: this.tBuffer[idx],
      });
    }
    return result;
  }

  private getSecondFingerPoints(): TouchPoint[] {
    const result: TouchPoint[] = [];
    for (let i = 0; i < this.length2; i++) {
      const idx = (this.head2 - this.length2 + i + this.maxPoints) % this.maxPoints;
      result.push({ x: this.x2Buffer[idx], y: this.y2Buffer[idx], timestamp: 0 });
    }
    return result;
  }
}
