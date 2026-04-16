import type { TouchSession, TouchPoint } from './TouchTracker';
import type { GestureConfig } from '../config/ConfigBridge';

export enum GestureType {
  UNKNOWN = 'UNKNOWN',
  V_SHAPE = 'V_SHAPE',
  L_SHAPE = 'L_SHAPE',
  CIRCLE = 'CIRCLE',
  C_SHAPE = 'C_SHAPE',
  DIAGONAL_SWIPE_UP = 'DIAGONAL_SWIPE_UP',
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

  constructor(config: GestureConfig) {
    this.config = config;
    this.screenWidth = window.innerWidth;
    this.edgeZone = Math.max(40, Math.min(80, this.screenWidth * config.edgeZonePercent));

    window.addEventListener('resize', () => {
      this.screenWidth = window.innerWidth;
      this.edgeZone = Math.max(40, Math.min(80, this.screenWidth * config.edgeZonePercent));
    });
  }

  detect(session: TouchSession): GestureType {
    const { points } = session;
    if (points.length < 5) return GestureType.UNKNOWN;

    const start = points[0];

    // Safari 네이티브 제스처 영역 회피
    if (start.x < this.edgeZone || start.x > this.screenWidth - this.edgeZone) {
      return GestureType.UNKNOWN;
    }

    // 1. 원형/C형 먼저 감지 (포인트 수가 많아야 함)
    if (points.length >= 10) {
      const curveResult = this.detectCurve(points, session);
      if (curveResult !== GestureType.UNKNOWN) return curveResult;
    }

    // 2. 세그먼트 기반 감지 (V, L, 대각선 스와이프)
    const segments = this.extractSegments(points);

    if (segments.length === 1) {
      return this.classifyDiagonalSwipe(segments[0], session);
    }

    if (segments.length === 2) {
      return this.classifyShape(segments, session);
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

  // ── 대각선 위 스와이프 ──────────────────────────────────────
  private classifyDiagonalSwipe(segment: Segment, session: TouchSession): GestureType {
    if (segment.distance < this.config.swipeMinDistance) return GestureType.UNKNOWN;
    if (session.duration > 800) return GestureType.UNKNOWN;

    // 대각선 위: dy < 0 (위로), 각도 -20° ~ -70° 범위
    const angle = segment.angle; // atan2 기반: 위 = 음수
    if (segment.dy < -40 && angle >= -70 && angle <= -20) {
      return GestureType.DIAGONAL_SWIPE_UP;
    }

    return GestureType.UNKNOWN;
  }

  // ── V/L 형태 감지 (기존 유지) ──────────────────────────────
  private classifyShape(segments: Segment[], session: TouchSession): GestureType {
    const [seg1, seg2] = segments;
    const angleDiff = Math.abs(seg2.angle - seg1.angle);
    const normalizedAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;

    // V Shape
    if (
      seg1.distance >= this.config.vShapeMinSegment &&
      seg2.distance >= this.config.vShapeMinSegment &&
      normalizedAngle >= this.config.vShapeAngleMin &&
      normalizedAngle <= this.config.vShapeAngleMax &&
      session.duration >= 200 &&
      session.duration <= 800
    ) {
      return GestureType.V_SHAPE;
    }

    // L Shape
    if (
      seg1.distance >= 80 &&
      seg2.distance >= 60 &&
      normalizedAngle >= this.config.lShapeAngleMin &&
      normalizedAngle <= this.config.lShapeAngleMax &&
      session.duration >= 300 &&
      session.duration <= 1000
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
