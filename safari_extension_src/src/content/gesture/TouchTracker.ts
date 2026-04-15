export interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

export interface TouchSession {
  points: TouchPoint[];
  fingerCount: number;
  startTime: number;
  endTime: number;
  duration: number;
}

export class TouchTracker {
  private points: TouchPoint[] = [];
  private fingerCount = 0;
  private startTime = 0;
  private lastSampleTime = 0;
  private readonly sampleInterval = 33; // ~30Hz

  onTouchStart(e: TouchEvent): void {
    this.points = [];
    this.fingerCount = e.touches.length;
    this.startTime = performance.now();
    this.lastSampleTime = 0;
    this.addPoint(e.touches[0]);
  }

  onTouchMove(e: TouchEvent): void {
    const now = performance.now();
    if (now - this.lastSampleTime < this.sampleInterval) return;

    this.lastSampleTime = now;
    this.fingerCount = Math.max(this.fingerCount, e.touches.length);
    this.addPoint(e.touches[0]);

    if (e.touches.length >= 2) {
      this.addPoint(e.touches[1], true);
    }
  }

  onTouchEnd(_e: TouchEvent): TouchSession | null {
    if (this.points.length < 2) return null;

    const endTime = performance.now();
    return {
      points: [...this.points],
      fingerCount: this.fingerCount,
      startTime: this.startTime,
      endTime,
      duration: endTime - this.startTime,
    };
  }

  reset(): void {
    this.points = [];
    this.fingerCount = 0;
    this.startTime = 0;
  }

  private addPoint(touch: Touch, _isSecondFinger = false): void {
    this.points.push({
      x: touch.clientX,
      y: touch.clientY,
      timestamp: performance.now(),
    });
  }
}
