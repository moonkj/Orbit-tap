export class GesturePreview {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private host: HTMLElement | null = null;
  private isActive = false;

  mount(): void {
    this.host = document.createElement('div');
    this.host.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 2147483644;
    `;
    this.canvas = document.createElement('canvas');
    this.canvas.width = window.innerWidth * devicePixelRatio;
    this.canvas.height = window.innerHeight * devicePixelRatio;
    this.canvas.style.cssText = `width: 100%; height: 100%;`;
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.scale(devicePixelRatio, devicePixelRatio);
    }
    this.host.appendChild(this.canvas);
    document.documentElement.appendChild(this.host);
  }

  unmount(): void {
    this.host?.remove();
    this.host = null;
    this.canvas = null;
    this.ctx = null;
  }

  startPath(x: number, y: number): void {
    if (!this.ctx) return;
    this.isActive = true;
    this.ctx.clearRect(0, 0, this.canvas!.width, this.canvas!.height);
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.strokeStyle = 'rgba(100, 210, 255, 0.6)';
    this.ctx.lineWidth = 3;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  addPoint(x: number, y: number): void {
    if (!this.ctx || !this.isActive) return;
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  endPath(success: boolean): void {
    if (!this.ctx || !this.isActive) return;
    this.isActive = false;

    this.ctx.strokeStyle = success
      ? 'rgba(48, 209, 88, 0.8)'
      : 'rgba(255, 69, 58, 0.5)';
    this.ctx.stroke();

    setTimeout(() => {
      if (this.ctx && this.canvas) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      }
    }, 300);
  }

  clear(): void {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.isActive = false;
  }
}
