import type { TouchSession, TouchPoint } from './TouchTracker';
import type { GestureConfig } from '../config/ConfigBridge';

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
