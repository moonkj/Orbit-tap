(function () {
    'use strict';

    class TouchTracker {
        constructor() {
            this.maxPoints = 128;
            this.head = 0;
            this.length = 0;
            this.head2 = 0;
            this.length2 = 0;
            this.fingerCount = 0;
            this.startTime = 0;
            this.lastSampleTime = 0;
            // Adaptive sampling
            this.baseInterval = 33; // 30Hz
            this.preciseInterval = 16; // 60Hz
            this.directionChanges = 0;
            this.lastDx = 0;
            this.lastDy = 0;
            this.xBuffer = new Float32Array(this.maxPoints);
            this.yBuffer = new Float32Array(this.maxPoints);
            this.tBuffer = new Float64Array(this.maxPoints);
            this.x2Buffer = new Float32Array(this.maxPoints);
            this.y2Buffer = new Float32Array(this.maxPoints);
            this.currentInterval = this.baseInterval;
        }
        onTouchStart(e) {
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
        onTouchMove(e) {
            const now = performance.now();
            if (now - this.lastSampleTime < this.currentInterval)
                return;
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
        onTouchEnd(_e) {
            if (this.length < 2)
                return null;
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
        reset() {
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
        pushPoint(x, y, t) {
            this.xBuffer[this.head] = x;
            this.yBuffer[this.head] = y;
            this.tBuffer[this.head] = t;
            this.head = (this.head + 1) % this.maxPoints;
            if (this.length < this.maxPoints)
                this.length++;
        }
        pushSecondFinger(x, y) {
            this.x2Buffer[this.head2] = x;
            this.y2Buffer[this.head2] = y;
            this.head2 = (this.head2 + 1) % this.maxPoints;
            if (this.length2 < this.maxPoints)
                this.length2++;
        }
        /** Ring Buffer를 시간순 배열로 읽기 */
        getPoints() {
            const result = [];
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
        getSecondFingerPoints() {
            const result = [];
            for (let i = 0; i < this.length2; i++) {
                const idx = (this.head2 - this.length2 + i + this.maxPoints) % this.maxPoints;
                result.push({ x: this.x2Buffer[idx], y: this.y2Buffer[idx], timestamp: 0 });
            }
            return result;
        }
    }

    // Two Finger Flick 임계값 상수
    const TWO_FINGER_MIN_SPEED = 400; // px/s
    const TWO_FINGER_ANGLE_THRESHOLD = 30; // 두 손가락 방향 차이 최대 허용 각도 (deg)
    const TWO_FINGER_FLICK_RATIO = 0.15; // 거리 비율 ≤ 이 값이면 Flick
    const TWO_FINGER_PINCH_RATIO = 0.3; // 거리 비율 ≥ 이 값이면 Pinch (무시)
    var GestureType;
    (function (GestureType) {
        GestureType["UNKNOWN"] = "UNKNOWN";
        GestureType["SWIPE_BACK"] = "SWIPE_BACK";
        GestureType["SWIPE_FORWARD"] = "SWIPE_FORWARD";
        GestureType["V_SHAPE"] = "V_SHAPE";
        GestureType["L_SHAPE"] = "L_SHAPE";
        GestureType["DOUBLE_TAP"] = "DOUBLE_TAP";
        GestureType["LONG_PRESS"] = "LONG_PRESS";
        GestureType["TWO_FINGER_FLICK_UP"] = "TWO_FINGER_FLICK_UP";
        GestureType["TWO_FINGER_FLICK_DOWN"] = "TWO_FINGER_FLICK_DOWN";
    })(GestureType || (GestureType = {}));
    class ShapeDetector {
        constructor(config) {
            this.config = config;
            this.screenWidth = window.innerWidth;
            this.edgeZone = Math.max(40, Math.min(80, this.screenWidth * config.edgeZonePercent));
            window.addEventListener('resize', () => {
                this.screenWidth = window.innerWidth;
                this.edgeZone = Math.max(40, Math.min(80, this.screenWidth * config.edgeZonePercent));
            });
        }
        detect(session) {
            const { points } = session;
            if (points.length < 3)
                return GestureType.UNKNOWN;
            // Two Finger Flick: 단일 손가락 경로 분석보다 먼저 시도
            if (session.fingerCount >= 2 && session.secondFingerPoints.length >= 2) {
                const twoFingerResult = this.detectTwoFingerFlick(session);
                if (twoFingerResult !== GestureType.UNKNOWN)
                    return twoFingerResult;
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
        detectTwoFingerFlick(session) {
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
            if (dist1 < 20 || dist2 < 20)
                return GestureType.UNKNOWN;
            // 평균 속도 검사 (px/s)
            const avgDist = (dist1 + dist2) / 2;
            const durationSec = duration / 1000;
            if (durationSec <= 0 || avgDist / durationSec < TWO_FINGER_MIN_SPEED) {
                return GestureType.UNKNOWN;
            }
            // 두 손가락 간 거리 변화율 → Pinch 여부 판별
            const initialSpan = Math.sqrt((f2Start.x - f1Start.x) ** 2 + (f2Start.y - f1Start.y) ** 2);
            const finalSpan = Math.sqrt((f2End.x - f1End.x) ** 2 + (f2End.y - f1End.y) ** 2);
            const spanDelta = Math.abs(finalSpan - initialSpan);
            const distanceRatio = avgDist > 0 ? spanDelta / avgDist : 1;
            if (distanceRatio > TWO_FINGER_PINCH_RATIO)
                return GestureType.UNKNOWN; // Pinch 무시
            if (distanceRatio > TWO_FINGER_FLICK_RATIO)
                return GestureType.UNKNOWN; // 애매한 중간 영역 무시
            // 두 이동 벡터 사이의 각도 차이
            const angle1 = Math.atan2(dy1, dx1) * (180 / Math.PI);
            const angle2 = Math.atan2(dy2, dx2) * (180 / Math.PI);
            let angleDiff = Math.abs(angle1 - angle2);
            if (angleDiff > 180)
                angleDiff = 360 - angleDiff;
            if (angleDiff >= TWO_FINGER_ANGLE_THRESHOLD)
                return GestureType.UNKNOWN;
            // 평균 Y 방향으로 위/아래 판별
            const avgDy = (dy1 + dy2) / 2;
            return avgDy < 0 ? GestureType.TWO_FINGER_FLICK_UP : GestureType.TWO_FINGER_FLICK_DOWN;
        }
        extractSegments(points) {
            const simplified = this.douglasPeucker(points, 15);
            const segments = [];
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
        classifySwipe(segment, session) {
            if (segment.distance < this.config.swipeMinDistance)
                return GestureType.UNKNOWN;
            const verticalDeviation = Math.abs(segment.dy);
            if (verticalDeviation > 50)
                return GestureType.UNKNOWN;
            if (segment.dx > 0 && session.duration < 1000)
                return GestureType.SWIPE_BACK;
            if (segment.dx < 0 && session.duration < 1000)
                return GestureType.SWIPE_FORWARD;
            return GestureType.UNKNOWN;
        }
        classifyShape(segments, session) {
            const [seg1, seg2] = segments;
            const angleDiff = Math.abs(seg2.angle - seg1.angle);
            const normalizedAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;
            // V Shape: two segments going down then up (or vice versa)
            if (seg1.distance >= this.config.vShapeMinSegment &&
                seg2.distance >= this.config.vShapeMinSegment &&
                normalizedAngle >= this.config.vShapeAngleMin &&
                normalizedAngle <= this.config.vShapeAngleMax &&
                session.duration >= 200 &&
                session.duration <= 800) {
                return GestureType.V_SHAPE;
            }
            // L Shape: vertical then horizontal
            if (seg1.distance >= 80 &&
                seg2.distance >= 60 &&
                normalizedAngle >= this.config.lShapeAngleMin &&
                normalizedAngle <= this.config.lShapeAngleMax &&
                session.duration >= 300 &&
                session.duration <= 1000) {
                return GestureType.L_SHAPE;
            }
            return GestureType.UNKNOWN;
        }
        douglasPeucker(points, epsilon) {
            if (points.length <= 2)
                return points;
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
        perpendicularDistance(point, lineStart, lineEnd) {
            const dx = lineEnd.x - lineStart.x;
            const dy = lineEnd.y - lineStart.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0)
                return Math.sqrt((point.x - lineStart.x) ** 2 + (point.y - lineStart.y) ** 2);
            return Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / len;
        }
    }

    class TapDetector {
        constructor(config) {
            this.tapCount = 0;
            this.lastTapTime = 0;
            this.lastTapX = 0;
            this.lastTapY = 0;
            this.touchStartTime = 0;
            this.touchStartX = 0;
            this.touchStartY = 0;
            this.tapTimer = null;
            this.pendingResolve = null;
            this.config = config;
        }
        onTouchStart(e) {
            this.touchStartTime = performance.now();
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
        }
        onTouchEnd(e) {
            const endTime = performance.now();
            const duration = endTime - this.touchStartTime;
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            const moveDistance = Math.sqrt((endX - this.touchStartX) ** 2 + (endY - this.touchStartY) ** 2);
            // Long Press
            if (duration >= this.config.longPressMinDuration && moveDistance < 10) {
                this.resetTaps();
                return GestureType.LONG_PRESS;
            }
            // Not a tap if moved too much or held too long
            if (moveDistance > 20 || duration > 300) {
                this.resetTaps();
                return null;
            }
            // Check proximity to last tap
            const tapDistance = Math.sqrt((endX - this.lastTapX) ** 2 + (endY - this.lastTapY) ** 2);
            const timeSinceLastTap = endTime - this.lastTapTime;
            if (timeSinceLastTap < this.config.doubleTapMaxInterval && tapDistance < 30) {
                this.tapCount++;
            }
            else {
                this.tapCount = 1;
            }
            this.lastTapTime = endTime;
            this.lastTapX = endX;
            this.lastTapY = endY;
            // Clear pending timer
            if (this.tapTimer) {
                clearTimeout(this.tapTimer);
                this.tapTimer = null;
            }
            // Wait to see if more taps come
            // For now, return double tap immediately when 2 taps detected
            if (this.tapCount >= 2) {
                const result = GestureType.DOUBLE_TAP;
                this.resetTaps();
                return result;
            }
            return null;
        }
        resetTaps() {
            this.tapCount = 0;
            if (this.tapTimer) {
                clearTimeout(this.tapTimer);
                this.tapTimer = null;
            }
        }
    }

    class FeedbackOverlay {
        constructor() {
            this.overlay = null;
        }
        show(gesture) {
            this.hide();
            const label = this.getLabel(gesture);
            const icon = this.getIcon(gesture);
            this.overlay = document.createElement('div');
            this.overlay.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      z-index: 2147483646;
      display: flex;
      align-items: center;
      gap: 8px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.15s ease;
    `;
            this.overlay.textContent = `${icon} ${label}`;
            document.body.appendChild(this.overlay);
            requestAnimationFrame(() => {
                if (this.overlay)
                    this.overlay.style.opacity = '1';
            });
            setTimeout(() => this.hide(), 300);
        }
        hide() {
            this.overlay?.remove();
            this.overlay = null;
        }
        getLabel(gesture) {
            const labels = {
                [GestureType.SWIPE_BACK]: 'Back',
                [GestureType.SWIPE_FORWARD]: 'Forward',
                [GestureType.V_SHAPE]: 'Close Tab',
                [GestureType.L_SHAPE]: 'Restore Tab',
                [GestureType.DOUBLE_TAP]: 'Search',
                [GestureType.LONG_PRESS]: 'Scroll',
                [GestureType.TWO_FINGER_FLICK_UP]: 'Refresh',
                [GestureType.TWO_FINGER_FLICK_DOWN]: 'Fullscreen',
            };
            return labels[gesture] ?? '';
        }
        getIcon(gesture) {
            const icons = {
                [GestureType.SWIPE_BACK]: '\u2190',
                [GestureType.SWIPE_FORWARD]: '\u2192',
                [GestureType.V_SHAPE]: '\u2715',
                [GestureType.L_SHAPE]: '\u21B6',
                [GestureType.DOUBLE_TAP]: '\uD83D\uDD0D',
                [GestureType.LONG_PRESS]: '\u2195',
                [GestureType.TWO_FINGER_FLICK_UP]: '\u21BB',
                [GestureType.TWO_FINGER_FLICK_DOWN]: '\u2922',
            };
            return icons[gesture] ?? '';
        }
    }

    /** GestureType → gesturesEnabled キー のマッピング */
    const GESTURE_CONFIG_KEY = {
        [GestureType.SWIPE_BACK]: 'swipeBack',
        [GestureType.SWIPE_FORWARD]: 'swipeForward',
        [GestureType.V_SHAPE]: 'vShape',
        [GestureType.L_SHAPE]: 'lShape',
        [GestureType.DOUBLE_TAP]: 'doubleTap',
        [GestureType.LONG_PRESS]: 'longPress',
        [GestureType.TWO_FINGER_FLICK_UP]: 'twoFingerFlick',
        [GestureType.TWO_FINGER_FLICK_DOWN]: 'twoFingerFlick',
    };
    /** 배터리 최적화: idle 판정까지의 무터치 대기 시간 (ms) */
    const IDLE_TIMEOUT_MS = 30000;
    /** SUPPRESSED → IDLE 복귀를 위해 scrollend 후 대기하는 시간 (ms) */
    const SUPPRESSED_RECOVERY_DELAY_MS = 150;
    class GestureEngine {
        constructor(config, intentDetector) {
            this.state = 'IDLE';
            // 타이머 핸들
            this.cooldownTimer = null;
            this.idleTimer = null;
            this.suppressedRecoveryTimer = null;
            // AbortController: 활성/idle 모드 각각 관리
            this.activeAbort = null;
            this.visibilityAbort = null;
            /** idle 모드에서 등록되는 touchstart 단일 리스너 — 활성 모드 복귀용 */
            this.onIdleTouchStart = () => {
                this.enterActiveMode();
            };
            this.config = config;
            this.intentDetector = intentDetector;
            this.touchTracker = new TouchTracker();
            this.shapeDetector = new ShapeDetector(config);
            this.tapDetector = new TapDetector(config);
            this.feedback = new FeedbackOverlay();
        }
        // ── 공개 수명주기 ────────────────────────────────────────────────────────
        start() {
            this.registerVisibilityListener();
            this.enterActiveMode();
        }
        stop() {
            this.activeAbort?.abort();
            this.activeAbort = null;
            this.visibilityAbort?.abort();
            this.visibilityAbort = null;
            this.clearAllTimers();
            document.removeEventListener('touchstart', this.onIdleTouchStart);
        }
        pause() {
            this.state = 'SUPPRESSED';
        }
        resume() {
            if (this.state === 'SUPPRESSED') {
                this.state = 'IDLE';
            }
        }
        // ── visibilitychange 리스너 ───────────────────────────────────────────────
        registerVisibilityListener() {
            this.visibilityAbort = new AbortController();
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    // 탭이 백그라운드로 전환 → 모든 입력 리스너 해제로 배터리 절약
                    this.activeAbort?.abort();
                    this.activeAbort = null;
                    this.clearIdleTimer();
                    document.removeEventListener('touchstart', this.onIdleTouchStart);
                }
                else {
                    // 탭이 다시 보이면 활성 모드로 복귀
                    this.enterActiveMode();
                }
            }, { signal: this.visibilityAbort.signal });
        }
        // ── 활성/idle 모드 전환 ──────────────────────────────────────────────────
        /**
         * 완전 활성 모드: 4개 touch 이벤트 리스너를 모두 등록하고 idle 타이머를 시작.
         */
        enterActiveMode() {
            if (this.activeAbort)
                return; // 이미 활성 상태
            document.removeEventListener('touchstart', this.onIdleTouchStart);
            this.activeAbort = new AbortController();
            const signal = this.activeAbort.signal;
            document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true, signal });
            document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true, signal });
            document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true, signal });
            document.addEventListener('touchcancel', this.onTouchCancel.bind(this), { passive: true, signal });
            this.state = 'IDLE';
            this.resetIdleTimer();
        }
        /**
         * idle 모드: 3개 이동성 리스너를 해제하고 touchstart 단일 리스너만 유지.
         * GC 및 배터리 절약을 위해 touch 이벤트 처리를 최소화한다.
         */
        enterIdleMode() {
            if (!this.activeAbort)
                return; // 이미 idle 또는 stopped
            this.activeAbort.abort();
            this.activeAbort = null;
            this.clearIdleTimer();
            // 다음 터치가 오면 즉시 활성 모드로 복귀
            document.addEventListener('touchstart', this.onIdleTouchStart, { passive: true });
        }
        // ── Idle 타이머 ──────────────────────────────────────────────────────────
        resetIdleTimer() {
            this.clearIdleTimer();
            this.idleTimer = window.setTimeout(() => {
                this.idleTimer = null;
                this.enterIdleMode();
            }, IDLE_TIMEOUT_MS);
        }
        clearIdleTimer() {
            if (this.idleTimer !== null) {
                clearTimeout(this.idleTimer);
                this.idleTimer = null;
            }
        }
        // ── Touch 이벤트 핸들러 ──────────────────────────────────────────────────
        onTouchStart(e) {
            // 활성 모드이므로 idle 타이머 재시작
            this.resetIdleTimer();
            if (this.state === 'COOLDOWN' || this.state === 'SUPPRESSED')
                return;
            if (this.intentDetector.isScrolling() || this.intentDetector.isInputFocused()) {
                this.state = 'SUPPRESSED';
                this.scheduleSuppressedRecovery();
                return;
            }
            this.touchTracker.onTouchStart(e);
            this.tapDetector.onTouchStart(e);
            this.state = 'DETECTING';
        }
        onTouchMove(e) {
            if (this.state !== 'DETECTING')
                return;
            this.touchTracker.onTouchMove(e);
        }
        onTouchEnd(e) {
            // 터치가 끝날 때마다 idle 타이머 재시작
            this.resetIdleTimer();
            if (this.state === 'COOLDOWN' || this.state === 'SUPPRESSED') {
                // SUPPRESSED 상태에서 스크롤이 끝났으면 즉시 복귀 시도
                if (this.state === 'SUPPRESSED' &&
                    !this.intentDetector.isScrolling() &&
                    !this.intentDetector.isInputFocused()) {
                    this.state = 'IDLE';
                    this.clearSuppressedRecoveryTimer();
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
        onTouchCancel(_e) {
            this.touchTracker.reset();
            this.state = 'IDLE';
            this.resetIdleTimer();
        }
        // ── SUPPRESSED 자동 복귀 (scrollend 후 150ms) ────────────────────────────
        scheduleSuppressedRecovery() {
            this.clearSuppressedRecoveryTimer();
            const tryRecover = () => {
                if (this.state !== 'SUPPRESSED')
                    return;
                if (this.intentDetector.isScrolling() || this.intentDetector.isInputFocused()) {
                    // 아직 스크롤 중 — scrollend 이벤트를 한 번 더 기다림
                    document.addEventListener('scrollend', tryRecover, { once: true, passive: true });
                    return;
                }
                this.suppressedRecoveryTimer = window.setTimeout(() => {
                    this.suppressedRecoveryTimer = null;
                    if (this.state === 'SUPPRESSED') {
                        this.state = 'IDLE';
                    }
                }, SUPPRESSED_RECOVERY_DELAY_MS);
            };
            // scrollend 이벤트가 발생하면 복귀 시도
            document.addEventListener('scrollend', tryRecover, { once: true, passive: true });
        }
        clearSuppressedRecoveryTimer() {
            if (this.suppressedRecoveryTimer !== null) {
                clearTimeout(this.suppressedRecoveryTimer);
                this.suppressedRecoveryTimer = null;
            }
        }
        // ── 제스처 실행 ──────────────────────────────────────────────────────────
        executeGesture(gesture) {
            // gesturesEnabled 체크: config에서 해당 제스처가 비활성이면 무시
            const configKey = GESTURE_CONFIG_KEY[gesture];
            if (configKey && this.config.gesturesEnabled[configKey] === false) {
                this.state = 'IDLE';
                return;
            }
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
        getCooldown(gesture) {
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
        enterCooldown(ms) {
            this.state = 'COOLDOWN';
            this.cooldownTimer = window.setTimeout(() => {
                this.state = 'IDLE';
                this.cooldownTimer = null;
            }, ms);
        }
        clearAllTimers() {
            if (this.cooldownTimer !== null) {
                clearTimeout(this.cooldownTimer);
                this.cooldownTimer = null;
            }
            this.clearIdleTimer();
            this.clearSuppressedRecoveryTimer();
        }
        // ── 유틸리티 ─────────────────────────────────────────────────────────────
        showSearchBar() {
            // TODO: Implement in-page search bar
        }
        scrollToEdge() {
            const scrollY = window.scrollY;
            const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            if (scrollY < maxScroll / 2) {
                window.scrollTo({ top: maxScroll, behavior: 'smooth' });
            }
            else {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }

    class FloatingButton {
        constructor(config) {
            this.host = null;
            this.shadow = null;
            this.button = null;
            this.guideOverlay = null;
            this.isDragging = false;
            this.isHidden = false;
            this.dragStartX = 0;
            this.dragStartY = 0;
            this.dragStartTime = 0;
            this.totalDragDistance = 0;
            this.rafId = null;
            this.tapCount = 0;
            this.tapTimer = null;
            this.longPressTimer = null;
            this.TAP_TIMEOUT = 350;
            this.LONG_PRESS_DURATION = 500;
            this.EDGE_THRESHOLD = 30;
            this.BUTTON_SIZE = 48;
            this.abortController = null;
            this.config = config;
            this.currentX = window.innerWidth - 60;
            this.currentY = window.innerHeight * 0.7;
        }
        mount() {
            // Guard: already mounted
            if (this.host)
                return;
            this.host = document.createElement('div');
            this.host.id = 'swift-gesture-host';
            this.shadow = this.host.attachShadow({ mode: 'closed' });
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(`
      :host { all: initial; }
      .swift-fb {
        position: fixed;
        width: ${this.BUTTON_SIZE}px;
        height: ${this.BUTTON_SIZE}px;
        border-radius: ${this.BUTTON_SIZE / 2}px;
        background: rgba(10, 132, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2147483647;
        will-change: transform, opacity;
        transform: translate3d(0, 0, 0);
        touch-action: none;
        contain: layout style paint;
        -webkit-backface-visibility: hidden;
        box-shadow: 0 2px 10px rgba(0,0,0,0.25);
        transition: opacity 0.2s ease, transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
        user-select: none;
        -webkit-user-select: none;
      }
      .swift-fb.dragging {
        transition: none !important;
        opacity: 0.7;
        transform: scale(1.1);
      }
      .swift-fb.hidden-edge {
        opacity: 0.15;
        pointer-events: auto;
      }
      .swift-fb.hidden-full {
        opacity: 0;
        pointer-events: none;
      }
      .swift-fb svg {
        width: 22px;
        height: 22px;
        fill: white;
        pointer-events: none;
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
    `);
            this.shadow.adoptedStyleSheets = [sheet];
            this.button = document.createElement('div');
            this.button.className = 'swift-fb';
            this.button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>`;
            this.shadow.appendChild(this.button);
            document.documentElement.appendChild(this.host);
            this.abortController = new AbortController();
            const signal = this.abortController.signal;
            this.button.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false, signal });
            this.button.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false, signal });
            this.button.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true, signal });
            this.updatePosition(false);
        }
        unmount() {
            this.abortController?.abort();
            this.host?.remove();
            this.host = null;
            this.shadow = null;
            this.button = null;
            if (this.tapTimer)
                clearTimeout(this.tapTimer);
            if (this.longPressTimer)
                clearTimeout(this.longPressTimer);
            if (this.rafId)
                cancelAnimationFrame(this.rafId);
        }
        onTouchStart(e) {
            e.preventDefault();
            e.stopPropagation();
            if (this.isHidden) {
                this.showFromEdge();
                return;
            }
            this.isDragging = false;
            this.totalDragDistance = 0;
            this.dragStartX = e.touches[0].clientX;
            this.dragStartY = e.touches[0].clientY;
            this.dragStartTime = performance.now();
            this.longPressTimer = window.setTimeout(() => {
                if (!this.isDragging && this.totalDragDistance < 10) {
                    this.executeTapAction('gestureGuide');
                }
            }, this.LONG_PRESS_DURATION);
        }
        onTouchMove(e) {
            if (!this.button)
                return;
            const dx = e.touches[0].clientX - this.dragStartX;
            const dy = e.touches[0].clientY - this.dragStartY;
            this.totalDragDistance = Math.sqrt(dx * dx + dy * dy);
            if (this.totalDragDistance > 8) {
                this.isDragging = true;
                if (this.longPressTimer) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
                e.preventDefault();
                this.currentX = e.touches[0].clientX - this.BUTTON_SIZE / 2;
                this.currentY = e.touches[0].clientY - this.BUTTON_SIZE / 2;
                if (!this.button.classList.contains('dragging')) {
                    this.button.classList.add('dragging');
                }
                if (!this.rafId) {
                    this.rafId = requestAnimationFrame(() => {
                        this.updatePosition(false);
                        this.rafId = null;
                    });
                }
            }
        }
        onTouchEnd(_e) {
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            if (this.isDragging) {
                this.isDragging = false;
                this.button?.classList.remove('dragging');
                this.snapToEdge();
                return;
            }
            // Tap detection
            const duration = performance.now() - this.dragStartTime;
            if (duration < this.LONG_PRESS_DURATION && this.totalDragDistance < 10) {
                this.tapCount++;
                if (this.tapTimer)
                    clearTimeout(this.tapTimer);
                this.tapTimer = window.setTimeout(() => {
                    switch (this.tapCount) {
                        case 1:
                            this.executeTapAction('back');
                            break;
                        case 2:
                            this.executeTapAction('forward');
                            break;
                        default:
                            this.executeTapAction('tabOverview');
                            break;
                    }
                    this.tapCount = 0;
                }, this.TAP_TIMEOUT);
            }
        }
        executeTapAction(action) {
            switch (action) {
                case 'back':
                    browser.runtime.sendMessage({ action: 'navigate', direction: 'back' });
                    break;
                case 'forward':
                    browser.runtime.sendMessage({ action: 'navigate', direction: 'forward' });
                    break;
                case 'tabOverview':
                    // Show tab list in popup since native tab overview can't be triggered
                    browser.runtime.sendMessage({ action: 'navigate', direction: 'back' }); // fallback
                    break;
                case 'gestureGuide':
                    this.showGestureGuide();
                    break;
            }
            browser.runtime.sendMessage({ action: 'logGesture', gestureType: `button_${action}` });
        }
        updatePosition(animate) {
            if (!this.button)
                return;
            const x = Math.max(0, Math.min(this.currentX, window.innerWidth - this.BUTTON_SIZE));
            const y = Math.max(0, Math.min(this.currentY, window.innerHeight - this.BUTTON_SIZE));
            if (!animate) {
                this.button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
            else {
                this.button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
            }
        }
        snapToEdge() {
            const midX = window.innerWidth / 2;
            const margin = 8;
            if (this.currentX + this.BUTTON_SIZE / 2 < midX) {
                this.currentX = margin;
            }
            else {
                this.currentX = window.innerWidth - this.BUTTON_SIZE - margin;
            }
            // Check if dragged to extreme edge → hide
            if (this.currentX <= this.EDGE_THRESHOLD || this.currentX >= window.innerWidth - this.EDGE_THRESHOLD - this.BUTTON_SIZE) {
                this.hideToEdge();
                return;
            }
            // Clamp Y
            this.currentY = Math.max(60, Math.min(this.currentY, window.innerHeight - this.BUTTON_SIZE - 60));
            this.updatePosition(true);
        }
        hideToEdge() {
            this.isHidden = true;
            this.button?.classList.add('hidden-edge');
            // Snap to the nearest edge
            const margin = -this.BUTTON_SIZE / 2;
            if (this.currentX < window.innerWidth / 2) {
                this.currentX = margin;
            }
            else {
                this.currentX = window.innerWidth - this.BUTTON_SIZE / 2;
            }
            this.updatePosition(true);
        }
        showFromEdge() {
            this.isHidden = false;
            this.button?.classList.remove('hidden-edge');
            const margin = 8;
            if (this.currentX < window.innerWidth / 2) {
                this.currentX = margin;
            }
            else {
                this.currentX = window.innerWidth - this.BUTTON_SIZE - margin;
            }
            this.updatePosition(true);
        }
        showGestureGuide() {
            if (!this.shadow)
                return;
            const existing = this.shadow.querySelector('.swift-guide');
            if (existing) {
                existing.remove();
                return;
            }
            this.guideOverlay = document.createElement('div');
            this.guideOverlay.className = 'swift-guide';
            this.guideOverlay.innerHTML = `
      <h2>Swift Gesture Guide</h2>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">\u2190\u2192</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">Swipe Left/Right</div>
          <div class="swift-guide-desc">Navigate back / forward</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">V</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">V Shape</div>
          <div class="swift-guide-desc">Close current tab</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">L</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">L Shape</div>
          <div class="swift-guide-desc">Restore closed tab</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">\u00D7\u00D72</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">Double Tap</div>
          <div class="swift-guide-desc">Page search</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">\u23F3</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">Long Press</div>
          <div class="swift-guide-desc">Scroll to top / bottom</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon">\u2191\u2191</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">Two Finger Flick</div>
          <div class="swift-guide-desc">Up: Refresh / Down: Fullscreen</div>
        </div>
      </div>
    `;
            this.guideOverlay.addEventListener('click', () => {
                this.guideOverlay?.remove();
                this.guideOverlay = null;
            }, { once: true });
            this.shadow.appendChild(this.guideOverlay);
            requestAnimationFrame(() => this.guideOverlay?.classList.add('visible'));
        }
    }

    class IntentDetector {
        constructor() {
            this._isScrolling = false;
            this._isInputFocused = false;
            this.scrollTimer = null;
            this.abortController = new AbortController();
            const signal = this.abortController.signal;
            document.addEventListener('scroll', () => {
                this._isScrolling = true;
                if (this.scrollTimer)
                    clearTimeout(this.scrollTimer);
                this.scrollTimer = window.setTimeout(() => {
                    this._isScrolling = false;
                }, 150);
            }, { passive: true, signal });
            document.addEventListener('focusin', (e) => {
                const target = e.target;
                this._isInputFocused = this.isEditableElement(target);
            }, { signal });
            document.addEventListener('focusout', () => {
                this._isInputFocused = false;
            }, { signal });
        }
        isScrolling() {
            return this._isScrolling;
        }
        isInputFocused() {
            return this._isInputFocused;
        }
        isIdle() {
            return !this._isScrolling && !this._isInputFocused;
        }
        dispose() {
            this.abortController.abort();
            if (this.scrollTimer)
                clearTimeout(this.scrollTimer);
        }
        isEditableElement(el) {
            const tag = el.tagName.toLowerCase();
            return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
        }
    }

    class ExclusionManager {
        constructor(userExclusions, siteRules) {
            this.builtinExcludedDomains = [
                'maps.google.com',
                'docs.google.com',
                'sheets.google.com',
                'slides.google.com',
                'figma.com',
                'canva.com',
                'codepen.io',
            ];
            this.userExcludedDomains = [];
            this.siteDisabledGestures = {};
            if (userExclusions)
                this.userExcludedDomains = userExclusions;
            if (siteRules)
                this.siteDisabledGestures = siteRules;
        }
        shouldExclude() {
            return this.isDomainExcluded() || this.isInsideIframe();
        }
        isGestureDisabledForSite(gestureType) {
            const hostname = window.location.hostname;
            for (const [domain, gestures] of Object.entries(this.siteDisabledGestures)) {
                if (hostname.includes(domain) && gestures.includes(gestureType)) {
                    return true;
                }
            }
            return false;
        }
        shouldExcludeAtPoint(x, y) {
            const element = document.elementFromPoint(x, y);
            if (!element)
                return false;
            // Check overflow-x scrollable containers
            if (this.isHorizontallyScrollable(element))
                return true;
            // Check CSS touch-action
            const touchAction = window.getComputedStyle(element).touchAction;
            if (touchAction === 'pan-x' || touchAction === 'manipulation')
                return true;
            // Check if inside canvas or video (interactive media)
            if (this.isInteractiveMedia(element))
                return true;
            return false;
        }
        isInsideIframe() {
            try {
                return window !== window.top;
            }
            catch {
                return true; // Cross-origin iframe
            }
        }
        updateUserExclusions(domains) {
            this.userExcludedDomains = domains;
        }
        updateSiteRules(rules) {
            this.siteDisabledGestures = rules;
        }
        isDomainExcluded() {
            const hostname = window.location.hostname;
            const allExcluded = [...this.builtinExcludedDomains, ...this.userExcludedDomains];
            return allExcluded.some(domain => hostname.includes(domain));
        }
        isHorizontallyScrollable(element) {
            let el = element;
            while (el && el !== document.documentElement) {
                const style = window.getComputedStyle(el);
                if ((style.overflowX === 'scroll' || style.overflowX === 'auto') &&
                    el.scrollWidth > el.clientWidth) {
                    return true;
                }
                el = el.parentElement;
            }
            return false;
        }
        isInteractiveMedia(element) {
            const tag = element.tagName.toLowerCase();
            return tag === 'canvas' || tag === 'video' || tag === 'svg';
        }
    }

    const DEFAULT_CONFIG = {
        masterEnabled: true,
        swipeMinDistance: 80,
        edgeZonePercent: 0.12,
        vShapeMinSegment: 60,
        vShapeAngleMin: 30,
        vShapeAngleMax: 90,
        lShapeAngleMin: 75,
        lShapeAngleMax: 105,
        doubleTapMaxInterval: 300,
        longPressMinDuration: 700,
        cooldownSwipe: 300,
        cooldownShape: 500,
        cooldownTap: 400,
        cooldownTwoFinger: 600,
        floatingButtonEnabled: true,
        gesturesEnabled: {
            swipeBack: true,
            swipeForward: true,
            vShape: true,
            lShape: true,
            doubleTap: true,
            longPress: true,
            twoFingerFlick: true,
        },
    };
    class ConfigBridge {
        constructor() {
            this.config = null;
            this.subscriptionActive = false;
            this.configChangeCallbacks = [];
        }
        async loadConfig() {
            try {
                const result = await browser.runtime.sendMessage({ action: 'getConfig' });
                this.config = { ...DEFAULT_CONFIG, ...result };
            }
            catch {
                const stored = await browser.storage.local.get('gestureConfig');
                this.config = stored.gestureConfig
                    ? { ...DEFAULT_CONFIG, ...stored.gestureConfig }
                    : { ...DEFAULT_CONFIG };
            }
            return this.config;
        }
        async loadSubscriptionStatus() {
            try {
                const result = await browser.runtime.sendMessage({ action: 'getSubscriptionStatus' });
                this.subscriptionActive = result?.isActive === true;
            }
            catch {
                this.subscriptionActive = false;
            }
            return this.subscriptionActive;
        }
        isSubscriptionActive() {
            return this.subscriptionActive;
        }
        getConfig() {
            return this.config ?? { ...DEFAULT_CONFIG };
        }
        onConfigChange(callback) {
            this.configChangeCallbacks.push(callback);
        }
        startListening() {
            browser.runtime.onMessage.addListener((message) => {
                if (message.action === 'configUpdated' && message.config) {
                    this.config = { ...DEFAULT_CONFIG, ...message.config };
                    this.configChangeCallbacks.forEach(cb => cb(this.config));
                }
            });
        }
        async saveConfig(config) {
            await browser.storage.local.set({ gestureConfig: config });
        }
    }

    class SwiftExtension {
        constructor() {
            this.gestureEngine = null;
            this.floatingButton = null;
            this.intentDetector = null;
            this.exclusionManager = null;
            this.configBridge = new ConfigBridge();
        }
        async init() {
            try {
                // Load config via background (falls back to storage cache)
                const config = await this.configBridge.loadConfig();
                this.exclusionManager = new ExclusionManager();
                if (this.exclusionManager.shouldExclude())
                    return;
                this.intentDetector = new IntentDetector();
                // Start gesture engine only if master switch is on
                if (config.masterEnabled !== false) {
                    this.gestureEngine = new GestureEngine(config, this.intentDetector);
                    this.gestureEngine.start();
                }
                // Floating button — mount only when master and floatingButtonEnabled are both on
                this.floatingButton = new FloatingButton(config);
                if (config.masterEnabled !== false && config.floatingButtonEnabled) {
                    this.floatingButton.mount();
                }
                // Listen for config changes broadcast by background
                this.configBridge.onConfigChange((updatedConfig) => {
                    try {
                        // Tear down existing gesture engine
                        this.gestureEngine?.stop();
                        this.gestureEngine = null;
                        // Restart engine only if master switch is on
                        if (updatedConfig.masterEnabled !== false) {
                            this.gestureEngine = new GestureEngine(updatedConfig, this.intentDetector);
                            this.gestureEngine.start();
                        }
                        // Floating button: show only when master + floatingButtonEnabled
                        if (updatedConfig.masterEnabled !== false && updatedConfig.floatingButtonEnabled) {
                            if (!this.floatingButton) {
                                this.floatingButton = new FloatingButton(updatedConfig);
                            }
                            this.floatingButton.mount();
                        }
                        else {
                            this.floatingButton?.unmount();
                        }
                    }
                    catch (err) {
                        console.error('[SwiftExtension] Failed to apply config update:', err);
                    }
                });
                this.configBridge.startListening();
                document.addEventListener('visibilitychange', () => {
                    if (document.hidden) {
                        this.gestureEngine?.pause();
                    }
                    else {
                        this.gestureEngine?.resume();
                    }
                });
            }
            catch (err) {
                // Error boundary: log and degrade gracefully — never crash the page
                console.error('[SwiftExtension] Initialization failed:', err);
            }
        }
        destroy() {
            this.gestureEngine?.stop();
            this.floatingButton?.unmount();
            this.intentDetector?.dispose();
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const ext = new SwiftExtension();
            ext.init();
        });
    }
    else {
        const ext = new SwiftExtension();
        ext.init();
    }

})();
