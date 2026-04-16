import type { TouchSession, TouchPoint } from './TouchTracker';
import type { GestureConfig } from '../config/ConfigBridge';

export enum GestureType {
  UNKNOWN = 'UNKNOWN',
  X_SHAPE = 'X_SHAPE',
  L_SHAPE = 'L_SHAPE',
  CIRCLE = 'CIRCLE',
  C_SHAPE = 'C_SHAPE',
}

interface Segment {
  start: TouchPoint;
  end: TouchPoint;
  dx: number;
  dy: number;
  distance: number;
  angle: number;
}

export class ShapeDetector {
  private config: GestureConfig;
  private screenWidth: number;
  private edgeZone: number;
  private resizeHandler: (() => void) | null = null;

  constructor(config: GestureConfig) {
    this.config = config;
    this.screenWidth = window.innerWidth;
    this.edgeZone = Math.max(40, Math.min(80, this.screenWidth * config.edgeZonePercent));

    this.resizeHandler = () => {
      this.screenWidth = window.innerWidth;
      this.edgeZone = Math.max(40, Math.min(80, this.screenWidth * config.edgeZonePercent));
    };
    window.addEventListener('resize', this.resizeHandler);
  }

  destroy(): void {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  detect(session: TouchSession): GestureType {
    const { points } = session;
    if (points.length < 3) return GestureType.UNKNOWN;

    const start = points[0];

    // Safari 네이티브 제스처 영역 회피
    if (start.x < this.edgeZone || start.x > this.screenWidth - this.edgeZone) {
      return GestureType.UNKNOWN;
    }

    // 1. 세그먼트 기반 감지 먼저 (V, L, 대각선 — 직선 제스처 우선)
    const segments = this.extractSegments(points);

    if (segments.length === 2) {
      const shape = this.classifyShape(segments, session);
      if (shape !== GestureType.UNKNOWN) return shape;
    }

    // X 감지: 3~4세그먼트, 방향 전환이 2회 이상, 경로가 교차
    if (segments.length >= 2 && segments.length <= 4) {
      const xResult = this.classifyXShape(points, segments, session);
      if (xResult !== GestureType.UNKNOWN) return xResult;
    }

    // 2. 곡선 감지 (원, C — 세그먼트로 안 잡히는 경우만)
    if (points.length >= 5) {
      const curveResult = this.detectCurve(points, session);
      if (curveResult !== GestureType.UNKNOWN) return curveResult;
    }

    return GestureType.UNKNOWN;
  }

  // ── 원형/C형 감지 ──────────────────────────────────────────
  private detectCurve(points: TouchPoint[], session: TouchSession): GestureType {
    if (session.duration < 200 || session.duration > 2000) return GestureType.UNKNOWN;

    // 중심점 계산
    let cx = 0, cy = 0;
    for (const p of points) { cx += p.x; cy += p.y; }
    cx /= points.length;
    cy /= points.length;

    // 각 포인트의 중심 대비 각도 계산
    const angles: number[] = [];
    let totalRadius = 0;
    for (const p of points) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      angles.push(Math.atan2(dy, dx));
      totalRadius += Math.sqrt(dx * dx + dy * dy);
    }
    const avgRadius = totalRadius / points.length;

    // 반지름이 너무 작으면 무시
    if (avgRadius < 30) return GestureType.UNKNOWN;

    // 반지름 편차 체크 (원형인지)
    let radiusVariance = 0;
    for (const p of points) {
      const r = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
      radiusVariance += ((r - avgRadius) / avgRadius) ** 2;
    }
    radiusVariance /= points.length;
    if (radiusVariance > 0.15) return GestureType.UNKNOWN; // 원에서 너무 벗어남

    // 각도 커버리지 계산 (총 회전각)
    let totalAngle = 0;
    for (let i = 1; i < angles.length; i++) {
      let diff = angles[i] - angles[i - 1];
      // -π ~ π 범위로 정규화
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff < -Math.PI) diff += 2 * Math.PI;
      totalAngle += diff;
    }
    const coverage = Math.abs(totalAngle);
    const coverageDeg = coverage * (180 / Math.PI);

    // 시작점과 끝점 거리
    const startEnd = Math.sqrt(
      (points[0].x - points[points.length - 1].x) ** 2 +
      (points[0].y - points[points.length - 1].y) ** 2
    );
    const closedRatio = startEnd / avgRadius;

    // 원: 300°+ 커버리지 + 시작/끝점 근접 (반지름의 60% 이내)
    if (coverageDeg >= 300 && closedRatio < 0.6) {
      return GestureType.CIRCLE;
    }

    // C형: 150~300° 커버리지 + 열린 형태 (시작/끝점 떨어져있음)
    if (coverageDeg >= 150 && coverageDeg < 300 && closedRatio >= 0.4) {
      return GestureType.C_SHAPE;
    }

    return GestureType.UNKNOWN;
  }

  // ── X 형태 감지 ─────────────────────────────────────────────
  // 한 손가락 X: ↘ → ↗ (또는 반대) — 2~3세그먼트, 방향 급전환
  private classifyXShape(_points: TouchPoint[], segments: Segment[], session: TouchSession): GestureType {
    if (session.duration < 150 || session.duration > 1200) return GestureType.UNKNOWN;

    // X: 급격한 방향 전환이 있는 지그재그
    let bigTurnCount = 0;
    let totalDist = 0;
    for (let i = 0; i < segments.length; i++) {
      totalDist += segments[i].distance;
      if (i > 0) {
        let diff = Math.abs(segments[i].angle - segments[i - 1].angle);
        if (diff > 180) diff = 360 - diff;
        if (diff >= 60) bigTurnCount++;
      }
    }

    // 1회 이상 급전환 + 충분한 거리 (L에서 안 잡힌 것만 여기 옴)
    if (bigTurnCount >= 1 && totalDist >= 40) {
      return GestureType.X_SHAPE;
    }

    return GestureType.UNKNOWN;
  }

  // ── L 형태 감지 ─────────────────────────────────────────────
  private classifyShape(segments: Segment[], session: TouchSession): GestureType {
    const [seg1, seg2] = segments;
    const angleDiff = Math.abs(seg2.angle - seg1.angle);
    const normalizedAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;

    // L Shape: 직각 꺾임 (60-120°)
    if (
      seg1.distance >= 40 &&
      seg2.distance >= 30 &&
      normalizedAngle >= 60 &&
      normalizedAngle <= 120 &&
      session.duration >= 150 &&
      session.duration <= 1500
    ) {
      return GestureType.L_SHAPE;
    }

    return GestureType.UNKNOWN;
  }

  // ── 유틸리티 ────────────────────────────────────────────────
  private extractSegments(points: TouchPoint[]): Segment[] {
    const simplified = this.douglasPeucker(points, 15);
    const segments: Segment[] = [];

    for (let i = 0; i < simplified.length - 1; i++) {
      const start = simplified[i];
      const end = simplified[i + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);

      if (distance > 20) {
        segments.push({ start, end, dx, dy, distance, angle });
      }
    }
    return segments;
  }

  private douglasPeucker(points: TouchPoint[], epsilon: number): TouchPoint[] {
    if (points.length <= 2) return points;

    let maxDist = 0;
    let maxIdx = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const dist = this.perpendicularDistance(points[i], first, last);
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon) {
      const left = this.douglasPeucker(points.slice(0, maxIdx + 1), epsilon);
      const right = this.douglasPeucker(points.slice(maxIdx), epsilon);
      return [...left.slice(0, -1), ...right];
    }

    return [first, last];
  }

  private perpendicularDistance(point: TouchPoint, lineStart: TouchPoint, lineEnd: TouchPoint): number {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
    return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / len;
  }
}
