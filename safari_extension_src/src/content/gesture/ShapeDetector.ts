import type { TouchSession, TouchPoint } from './TouchTracker';
import type { GestureConfig } from '../config/ConfigBridge';

// Two Finger Flick 임계값 상수
const TWO_FINGER_MIN_SPEED = 400;       // px/s
const TWO_FINGER_ANGLE_THRESHOLD = 30;  // 두 손가락 방향 차이 최대 허용 각도 (deg)
const TWO_FINGER_FLICK_RATIO = 0.15;    // 거리 비율 ≤ 이 값이면 Flick
const TWO_FINGER_PINCH_RATIO = 0.3;     // 거리 비율 ≥ 이 값이면 Pinch (무시)

export enum GestureType {
  UNKNOWN = 'UNKNOWN',
  SWIPE_BACK = 'SWIPE_BACK',
  SWIPE_FORWARD = 'SWIPE_FORWARD',
  V_SHAPE = 'V_SHAPE',
  L_SHAPE = 'L_SHAPE',
  DOUBLE_TAP = 'DOUBLE_TAP',
  LONG_PRESS = 'LONG_PRESS',
  TWO_FINGER_FLICK_UP = 'TWO_FINGER_FLICK_UP',
  TWO_FINGER_FLICK_DOWN = 'TWO_FINGER_FLICK_DOWN',
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
    if (points.length < 3) return GestureType.UNKNOWN;

    // Two Finger Flick: 단일 손가락 경로 분석보다 먼저 시도
    if (session.fingerCount >= 2 && session.secondFingerPoints.length >= 2) {
      const twoFingerResult = this.detectTwoFingerFlick(session);
      if (twoFingerResult !== GestureType.UNKNOWN) return twoFingerResult;
    }

    const start = points[0];

    // Reject gestures starting in edge zone (Safari native gesture area)
    if (start.x < this.edgeZone || start.x > this.screenWidth - this.edgeZone) {
      return GestureType.UNKNOWN;
    }

    // Stage 1: Quick classify by segment count
    const segments = this.extractSegments(points);

    if (segments.length === 1) {
      return this.classifySwipe(segments[0], session);
    }

    if (segments.length === 2) {
      return this.classifyShape(segments, session);
    }

    return GestureType.UNKNOWN;
  }

  /**
   * Two Finger Flick 감지
   *
   * 두 손가락의 전체 이동 벡터를 비교해 방향 차가 30° 미만이고
   * 평균 속도가 400px/s 이상이면 Flick 으로 판단한다.
   * 두 손가락 사이 거리 변화율이 0.3 이상이면 Pinch 로 간주하고 무시한다.
   */
  private detectTwoFingerFlick(session: TouchSession): GestureType {
    const { points, secondFingerPoints, duration } = session;

    // 각 손가락의 첫/끝 좌표
    const f1Start = points[0];
    const f1End = points[points.length - 1];
    const f2Start = secondFingerPoints[0];
    const f2End = secondFingerPoints[secondFingerPoints.length - 1];

    const dx1 = f1End.x - f1Start.x;
    const dy1 = f1End.y - f1Start.y;
    const dx2 = f2End.x - f2Start.x;
    const dy2 = f2End.y - f2Start.y;

    const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

    if (dist1 < 20 || dist2 < 20) return GestureType.UNKNOWN;

    // 평균 속도 검사 (px/s)
    const avgDist = (dist1 + dist2) / 2;
    const durationSec = duration / 1000;
    if (durationSec <= 0 || avgDist / durationSec < TWO_FINGER_MIN_SPEED) {
      return GestureType.UNKNOWN;
    }

    // 두 손가락 간 거리 변화율 → Pinch 여부 판별
    const initialSpan = Math.sqrt(
      (f2Start.x - f1Start.x) ** 2 + (f2Start.y - f1Start.y) ** 2
    );
    const finalSpan = Math.sqrt(
      (f2End.x - f1End.x) ** 2 + (f2End.y - f1End.y) ** 2
    );
    const spanDelta = Math.abs(finalSpan - initialSpan);
    const distanceRatio = avgDist > 0 ? spanDelta / avgDist : 1;

    if (distanceRatio > TWO_FINGER_PINCH_RATIO) return GestureType.UNKNOWN; // Pinch 무시
    if (distanceRatio > TWO_FINGER_FLICK_RATIO) return GestureType.UNKNOWN; // 애매한 중간 영역 무시

    // 두 이동 벡터 사이의 각도 차이
    const angle1 = Math.atan2(dy1, dx1) * (180 / Math.PI);
    const angle2 = Math.atan2(dy2, dx2) * (180 / Math.PI);
    let angleDiff = Math.abs(angle1 - angle2);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;

    if (angleDiff >= TWO_FINGER_ANGLE_THRESHOLD) return GestureType.UNKNOWN;

    // 평균 Y 방향으로 위/아래 판별
    const avgDy = (dy1 + dy2) / 2;
    return avgDy < 0 ? GestureType.TWO_FINGER_FLICK_UP : GestureType.TWO_FINGER_FLICK_DOWN;
  }

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

  private classifySwipe(segment: Segment, session: TouchSession): GestureType {
    if (segment.distance < this.config.swipeMinDistance) return GestureType.UNKNOWN;

    const verticalDeviation = Math.abs(segment.dy);
    if (verticalDeviation > 50) return GestureType.UNKNOWN;

    if (segment.dx < 0 && session.duration < 1000) return GestureType.SWIPE_BACK;
    if (segment.dx > 0 && session.duration < 1000) return GestureType.SWIPE_FORWARD;

    return GestureType.UNKNOWN;
  }

  private classifyShape(segments: Segment[], session: TouchSession): GestureType {
    const [seg1, seg2] = segments;
    const angleDiff = Math.abs(seg2.angle - seg1.angle);
    const normalizedAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;

    // V Shape: two segments going down then up (or vice versa)
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

    // L Shape: vertical then horizontal
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
