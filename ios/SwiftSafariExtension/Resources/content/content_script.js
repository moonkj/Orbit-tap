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

    var GestureType;
    (function (GestureType) {
        GestureType["UNKNOWN"] = "UNKNOWN";
        GestureType["V_SHAPE"] = "V_SHAPE";
        GestureType["L_SHAPE"] = "L_SHAPE";
        GestureType["CIRCLE"] = "CIRCLE";
        GestureType["C_SHAPE"] = "C_SHAPE";
        GestureType["DIAGONAL_SWIPE_UP"] = "DIAGONAL_SWIPE_UP";
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
            if (points.length < 5)
                return GestureType.UNKNOWN;
            const start = points[0];
            // Safari 네이티브 제스처 영역 회피
            if (start.x < this.edgeZone || start.x > this.screenWidth - this.edgeZone) {
                return GestureType.UNKNOWN;
            }
            // 1. 원형/C형 먼저 감지 (포인트 수가 많아야 함)
            if (points.length >= 10) {
                const curveResult = this.detectCurve(points, session);
                if (curveResult !== GestureType.UNKNOWN)
                    return curveResult;
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
        detectCurve(points, session) {
            if (session.duration < 200 || session.duration > 2000)
                return GestureType.UNKNOWN;
            // 중심점 계산
            let cx = 0, cy = 0;
            for (const p of points) {
                cx += p.x;
                cy += p.y;
            }
            cx /= points.length;
            cy /= points.length;
            // 각 포인트의 중심 대비 각도 계산
            const angles = [];
            let totalRadius = 0;
            for (const p of points) {
                const dx = p.x - cx;
                const dy = p.y - cy;
                angles.push(Math.atan2(dy, dx));
                totalRadius += Math.sqrt(dx * dx + dy * dy);
            }
            const avgRadius = totalRadius / points.length;
            // 반지름이 너무 작으면 무시
            if (avgRadius < 30)
                return GestureType.UNKNOWN;
            // 반지름 편차 체크 (원형인지)
            let radiusVariance = 0;
            for (const p of points) {
                const r = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2);
                radiusVariance += ((r - avgRadius) / avgRadius) ** 2;
            }
            radiusVariance /= points.length;
            if (radiusVariance > 0.15)
                return GestureType.UNKNOWN; // 원에서 너무 벗어남
            // 각도 커버리지 계산 (총 회전각)
            let totalAngle = 0;
            for (let i = 1; i < angles.length; i++) {
                let diff = angles[i] - angles[i - 1];
                // -π ~ π 범위로 정규화
                if (diff > Math.PI)
                    diff -= 2 * Math.PI;
                if (diff < -Math.PI)
                    diff += 2 * Math.PI;
                totalAngle += diff;
            }
            const coverage = Math.abs(totalAngle);
            const coverageDeg = coverage * (180 / Math.PI);
            // 시작점과 끝점 거리
            const startEnd = Math.sqrt((points[0].x - points[points.length - 1].x) ** 2 +
                (points[0].y - points[points.length - 1].y) ** 2);
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
        classifyDiagonalSwipe(segment, session) {
            if (segment.distance < this.config.swipeMinDistance)
                return GestureType.UNKNOWN;
            if (session.duration > 800)
                return GestureType.UNKNOWN;
            // 대각선 위: dy < 0 (위로), 각도 -20° ~ -70° 범위
            const angle = segment.angle; // atan2 기반: 위 = 음수
            if (segment.dy < -40 && angle >= -70 && angle <= -20) {
                return GestureType.DIAGONAL_SWIPE_UP;
            }
            return GestureType.UNKNOWN;
        }
        // ── V/L 형태 감지 (기존 유지) ──────────────────────────────
        classifyShape(segments, session) {
            const [seg1, seg2] = segments;
            const angleDiff = Math.abs(seg2.angle - seg1.angle);
            const normalizedAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;
            // V Shape
            if (seg1.distance >= this.config.vShapeMinSegment &&
                seg2.distance >= this.config.vShapeMinSegment &&
                normalizedAngle >= this.config.vShapeAngleMin &&
                normalizedAngle <= this.config.vShapeAngleMax &&
                session.duration >= 200 &&
                session.duration <= 800) {
                return GestureType.V_SHAPE;
            }
            // L Shape
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
        // ── 유틸리티 ────────────────────────────────────────────────
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

    /**
     * 제스처 인식 시 손가락 궤적을 따라 그려지는 트레일 애니메이션
     * Apple 스타일: 70% 투명도, 0.3~0.5초 표시 후 페이드아웃
     */
    class FeedbackOverlay {
        constructor() {
            this.canvas = null;
            this.styleEl = null;
            this.animId = null;
        }
        show(gesture, points) {
            this.hide();
            if (!points || points.length < 3)
                return;
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
                if (this.canvas)
                    this.canvas.style.opacity = '1';
            });
            const ctx = this.canvas.getContext('2d');
            if (!ctx)
                return;
            const color = this.getColor(gesture);
            // 궤적 애니메이션 (포인트를 순차적으로 그림)
            const totalDuration = 350; // ms
            const startTime = performance.now();
            const totalPoints = points.length;
            const animate = (now) => {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / totalDuration, 1);
                const drawCount = Math.floor(progress * totalPoints);
                ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
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
                }
                else {
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
        hide() {
            if (this.animId) {
                cancelAnimationFrame(this.animId);
                this.animId = null;
            }
            this.canvas?.remove();
            this.canvas = null;
        }
        getColor(gesture) {
            const colors = {
                [GestureType.V_SHAPE]: 'rgba(255, 69, 58, ALPHA)', // 레드
                [GestureType.L_SHAPE]: 'rgba(48, 209, 88, ALPHA)', // 그린
                [GestureType.CIRCLE]: 'rgba(10, 132, 255, ALPHA)', // 블루
                [GestureType.C_SHAPE]: 'rgba(255, 159, 10, ALPHA)', // 오렌지
                [GestureType.DIAGONAL_SWIPE_UP]: 'rgba(175, 82, 222, ALPHA)', // 퍼플
            };
            return colors[gesture] ?? 'rgba(255, 255, 255, ALPHA)';
        }
    }

    /**
     * 페이지 내 텍스트 검색 오버레이 (Circle 제스처로 호출)
     */
    class SearchOverlay {
        constructor() {
            this.overlay = null;
            this.input = null;
            this.countEl = null;
            this.styleEl = null;
            this.matches = [];
            this.currentIdx = -1;
        }
        show() {
            if (this.overlay) {
                this.focus();
                return;
            }
            this.styleEl = document.createElement('style');
            this.styleEl.setAttribute('data-swift-search', '1');
            this.styleEl.textContent = `
      .swift-search-bar {
        position: fixed; top: 0; left: 0; right: 0;
        z-index: 2147483645;
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px;
        background: rgba(28,28,30,0.92);
        -webkit-backdrop-filter: saturate(180%) blur(20px);
        backdrop-filter: saturate(180%) blur(20px);
        border-bottom: 0.5px solid rgba(255,255,255,0.1);
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        transform: translateY(-100%);
        transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
      }
      .swift-search-bar.visible { transform: translateY(0); }
      .swift-search-bar input {
        flex: 1; border: none; outline: none;
        background: rgba(255,255,255,0.1);
        color: #fff; font-size: 15px;
        padding: 8px 12px; border-radius: 8px;
        -webkit-appearance: none;
      }
      .swift-search-bar input::placeholder { color: rgba(255,255,255,0.4); }
      .swift-search-count { color: rgba(255,255,255,0.5); font-size: 12px; min-width: 40px; text-align: center; }
      .swift-search-btn {
        background: none; border: none; color: rgba(255,255,255,0.7);
        font-size: 18px; padding: 4px 8px; cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      mark[data-swift-hl] { background: rgba(255, 214, 10, 0.4); color: inherit; border-radius: 2px; }
      mark[data-swift-hl].current { background: rgba(255, 149, 0, 0.6); }
    `;
            document.head.appendChild(this.styleEl);
            this.overlay = document.createElement('div');
            this.overlay.className = 'swift-search-bar';
            this.input = document.createElement('input');
            this.input.type = 'text';
            this.input.placeholder = 'Search on page...';
            this.input.autocomplete = 'off';
            this.input.autocapitalize = 'off';
            this.countEl = document.createElement('span');
            this.countEl.className = 'swift-search-count';
            const prevBtn = document.createElement('button');
            prevBtn.className = 'swift-search-btn';
            prevBtn.textContent = '▲';
            prevBtn.addEventListener('click', () => this.navigate(-1));
            const nextBtn = document.createElement('button');
            nextBtn.className = 'swift-search-btn';
            nextBtn.textContent = '▼';
            nextBtn.addEventListener('click', () => this.navigate(1));
            const closeBtn = document.createElement('button');
            closeBtn.className = 'swift-search-btn';
            closeBtn.textContent = '✕';
            closeBtn.addEventListener('click', () => this.hide());
            this.overlay.append(this.input, this.countEl, prevBtn, nextBtn, closeBtn);
            document.documentElement.appendChild(this.overlay);
            this.input.addEventListener('input', () => this.search(this.input.value));
            requestAnimationFrame(() => {
                this.overlay?.classList.add('visible');
                this.input?.focus();
            });
        }
        hide() {
            this.clearHighlights();
            this.overlay?.classList.remove('visible');
            setTimeout(() => {
                this.overlay?.remove();
                this.styleEl?.remove();
                this.overlay = null;
                this.styleEl = null;
                this.input = null;
                this.countEl = null;
            }, 250);
            this.matches = [];
            this.currentIdx = -1;
        }
        focus() {
            this.input?.focus();
            this.input?.select();
        }
        search(query) {
            this.clearHighlights();
            this.matches = [];
            this.currentIdx = -1;
            if (!query || query.length < 1) {
                this.updateCount();
                return;
            }
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            const textNodes = [];
            let node;
            while ((node = walker.nextNode())) {
                if (node.textContent?.toLowerCase().includes(query.toLowerCase())) {
                    textNodes.push(node);
                }
            }
            for (const textNode of textNodes) {
                const text = textNode.textContent ?? '';
                const lowerText = text.toLowerCase();
                const lowerQuery = query.toLowerCase();
                let idx = 0;
                while ((idx = lowerText.indexOf(lowerQuery, idx)) !== -1) {
                    const range = document.createRange();
                    range.setStart(textNode, idx);
                    range.setEnd(textNode, idx + query.length);
                    this.matches.push(range);
                    idx += query.length;
                    break; // 같은 텍스트 노드에서 하나만 (분할 방지)
                }
            }
            // 하이라이트 적용
            for (const range of this.matches) {
                try {
                    const mark = document.createElement('mark');
                    mark.setAttribute('data-swift-hl', '');
                    range.surroundContents(mark);
                }
                catch { }
            }
            if (this.matches.length > 0) {
                this.currentIdx = 0;
                this.scrollToCurrent();
            }
            this.updateCount();
        }
        navigate(dir) {
            if (this.matches.length === 0)
                return;
            const marks = document.querySelectorAll('mark[data-swift-hl]');
            marks.forEach(m => m.classList.remove('current'));
            this.currentIdx = (this.currentIdx + dir + this.matches.length) % this.matches.length;
            this.scrollToCurrent();
            this.updateCount();
        }
        scrollToCurrent() {
            const marks = document.querySelectorAll('mark[data-swift-hl]');
            if (marks[this.currentIdx]) {
                marks[this.currentIdx].classList.add('current');
                marks[this.currentIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        updateCount() {
            if (!this.countEl)
                return;
            if (this.matches.length === 0) {
                this.countEl.textContent = '';
            }
            else {
                this.countEl.textContent = `${this.currentIdx + 1}/${this.matches.length}`;
            }
        }
        clearHighlights() {
            document.querySelectorAll('mark[data-swift-hl]').forEach(mark => {
                const parent = mark.parentNode;
                if (parent) {
                    parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
                    parent.normalize();
                }
            });
        }
    }

    const GESTURE_CONFIG_KEY = {
        [GestureType.V_SHAPE]: 'vShape',
        [GestureType.L_SHAPE]: 'lShape',
        [GestureType.CIRCLE]: 'circle',
        [GestureType.C_SHAPE]: 'cShape',
        [GestureType.DIAGONAL_SWIPE_UP]: 'diagonalSwipeUp',
    };
    const IDLE_TIMEOUT_MS = 30000;
    class GestureEngine {
        constructor(config, intentDetector) {
            this.state = 'IDLE';
            this.cooldownTimer = null;
            this.idleTimer = null;
            this.activeAbort = null;
            this.visibilityAbort = null;
            // 스크롤 vs 제스처 판별용
            this.moveCount = 0;
            this.startX = 0;
            this.startY = 0;
            this.isGestureLocked = false; // true면 스크롤 차단, 제스처 캡처 중
            this.onIdleTouchStart = () => { this.enterActiveMode(); };
            this.config = config;
            this.intentDetector = intentDetector;
            this.touchTracker = new TouchTracker();
            this.shapeDetector = new ShapeDetector(config);
            this.feedback = new FeedbackOverlay();
            this.searchOverlay = new SearchOverlay();
        }
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
        pause() { this.state = 'IDLE'; }
        resume() { this.state = 'IDLE'; }
        registerVisibilityListener() {
            this.visibilityAbort = new AbortController();
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.activeAbort?.abort();
                    this.activeAbort = null;
                    this.clearIdleTimer();
                    document.removeEventListener('touchstart', this.onIdleTouchStart);
                }
                else {
                    this.enterActiveMode();
                }
            }, { signal: this.visibilityAbort.signal });
        }
        enterActiveMode() {
            if (this.activeAbort)
                return;
            document.removeEventListener('touchstart', this.onIdleTouchStart);
            this.activeAbort = new AbortController();
            const signal = this.activeAbort.signal;
            // touchstart: passive로 시작 (스크롤 차단 안 함)
            document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true, signal });
            // touchmove: passive: FALSE → 제스처 감지 시 preventDefault 가능
            document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false, signal });
            document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true, signal });
            // touchcancel도 제스처 분석 시도
            document.addEventListener('touchcancel', this.onTouchCancel.bind(this), { passive: true, signal });
            this.state = 'IDLE';
            this.resetIdleTimer();
        }
        enterIdleMode() {
            if (!this.activeAbort)
                return;
            this.activeAbort.abort();
            this.activeAbort = null;
            this.clearIdleTimer();
            document.addEventListener('touchstart', this.onIdleTouchStart, { passive: true });
        }
        resetIdleTimer() {
            this.clearIdleTimer();
            this.idleTimer = window.setTimeout(() => { this.idleTimer = null; this.enterIdleMode(); }, IDLE_TIMEOUT_MS);
        }
        clearIdleTimer() {
            if (this.idleTimer !== null) {
                clearTimeout(this.idleTimer);
                this.idleTimer = null;
            }
        }
        // ── Touch Handlers ──────────────────────────────────────────
        onTouchStart(e) {
            this.resetIdleTimer();
            if (this.state === 'COOLDOWN')
                return;
            if (this.intentDetector.isInputFocused())
                return;
            if (e.touches.length > 1)
                return; // 멀티터치 무시
            this.touchTracker.onTouchStart(e);
            this.state = 'DETECTING';
            this.moveCount = 0;
            this.isGestureLocked = false;
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
        }
        onTouchMove(e) {
            if (this.state !== 'DETECTING' && this.state !== 'GESTURE_LOCKED')
                return;
            this.touchTracker.onTouchMove(e);
            this.moveCount++;
            const dx = e.touches[0].clientX - this.startX;
            const dy = e.touches[0].clientY - this.startY;
            // 3번째 touchmove 이후 스크롤 vs 제스처 판별
            if (!this.isGestureLocked && this.moveCount >= 3) {
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);
                const totalDist = Math.sqrt(dx * dx + dy * dy);
                // 순수 세로 스크롤이면 제스처 포기 (세로 이동이 가로의 3배 이상)
                if (absDy > absDx * 3 && totalDist > 15) {
                    this.state = 'IDLE';
                    this.touchTracker.reset();
                    return;
                }
                // 비스크롤 패턴이면 제스처 잠금 (스크롤 차단)
                if (totalDist > 15) {
                    this.isGestureLocked = true;
                    this.state = 'GESTURE_LOCKED';
                }
            }
            // 제스처 잠금 상태면 스크롤 차단
            if (this.isGestureLocked) {
                e.preventDefault();
            }
        }
        onTouchEnd(e) {
            this.resetIdleTimer();
            if (this.state !== 'DETECTING' && this.state !== 'GESTURE_LOCKED')
                return;
            this.analyzeAndExecute(e);
        }
        onTouchCancel(e) {
            this.resetIdleTimer();
            // touchcancel도 포인트 분석 시도 (브라우저가 스크롤로 가져갔을 때)
            if (this.state === 'DETECTING' || this.state === 'GESTURE_LOCKED') {
                this.analyzeAndExecute(e);
            }
            else {
                this.touchTracker.reset();
                this.state = 'IDLE';
            }
        }
        analyzeAndExecute(e) {
            const session = this.touchTracker.onTouchEnd(e);
            this.state = 'IDLE';
            this.isGestureLocked = false;
            if (session && session.points.length >= 4) {
                const gesture = this.shapeDetector.detect(session);
                if (gesture !== GestureType.UNKNOWN) {
                    this.executeGesture(gesture, session.points);
                }
            }
        }
        // ── 제스처 실행 ─────────────────────────────────────────────
        executeGesture(gesture, points) {
            const configKey = GESTURE_CONFIG_KEY[gesture];
            if (configKey && this.config.gesturesEnabled[configKey] === false) {
                this.state = 'IDLE';
                return;
            }
            this.state = 'RECOGNIZED';
            this.feedback.show(gesture, points);
            switch (gesture) {
                case GestureType.V_SHAPE:
                    browser.runtime.sendMessage({ action: 'closeTab' });
                    break;
                case GestureType.L_SHAPE:
                    browser.runtime.sendMessage({ action: 'restoreTab' });
                    break;
                case GestureType.CIRCLE:
                    this.searchOverlay.show();
                    break;
                case GestureType.C_SHAPE:
                    browser.runtime.sendMessage({ action: 'clearSiteData' });
                    break;
                case GestureType.DIAGONAL_SWIPE_UP:
                    browser.runtime.sendMessage({ action: 'newTab' });
                    break;
            }
            this.enterCooldown(500);
        }
        enterCooldown(ms) {
            this.state = 'COOLDOWN';
            this.cooldownTimer = window.setTimeout(() => { this.state = 'IDLE'; this.cooldownTimer = null; }, ms);
        }
        clearAllTimers() {
            if (this.cooldownTimer !== null) {
                clearTimeout(this.cooldownTimer);
                this.cooldownTimer = null;
            }
            this.clearIdleTimer();
        }
    }

    const SIZE_MAP = {
        small: 42,
        medium: 52,
        large: 64,
    };
    class FloatingButton {
        constructor(config) {
            this.host = null;
            this.button = null;
            this.styleEl = null;
            this.guideOverlay = null;
            this.isDragging = false;
            this.dragReady = false; // long-press 완료 후 드래그 가능 상태
            this.dragStartX = 0;
            this.dragStartY = 0;
            this.dragStartTime = 0;
            this.totalDragDistance = 0;
            this.rafId = null;
            this.tapCount = 0;
            this.tapTimer = null;
            this.longPressTimer = null;
            this.TAP_TIMEOUT = 350;
            this.LONG_PRESS_DURATION = 5000;
            this.abortController = null;
            this.config = config;
            this.currentX = window.innerWidth - 60;
            this.currentY = window.innerHeight * 0.7;
        }
        getButtonSize() {
            return SIZE_MAP[this.config.buttonSize] ?? 48;
        }
        getOpacity() {
            return (this.config.buttonOpacity ?? 90) / 100;
        }
        async mount() {
            // Guard: already mounted
            if (this.host)
                return;
            // 기존 DOM 잔존물 제거 (이전 인스턴스 / 페이지 캐시 / 확장 리로드 대응)
            const existing = document.getElementById('swift-gesture-host');
            if (existing)
                existing.remove();
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
            }
            catch { }
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
        unmount() {
            this.abortController?.abort();
            this.host?.remove();
            this.styleEl?.remove();
            this.host = null;
            this.styleEl = null;
            this.button = null;
            if (this.tapTimer)
                clearTimeout(this.tapTimer);
            if (this.longPressTimer)
                clearTimeout(this.longPressTimer);
            if (this.rafId)
                cancelAnimationFrame(this.rafId);
        }
        /**
         * 외부에서 config 변경 시 호출 — 크기/투명도 실시간 반영
         */
        updateConfig(config) {
            const oldSize = this.getButtonSize();
            this.config = config;
            const newSize = this.getButtonSize();
            const newOpacity = this.getOpacity();
            if (!this.button || !this.styleEl)
                return;
            // 크기 변경 시 스타일 재생성
            if (oldSize !== newSize) {
                this.button.style.width = `${newSize}px`;
                this.button.style.height = `${newSize}px`;
                this.button.style.borderRadius = `${newSize / 2}px`;
                const svg = this.button.querySelector('svg');
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
        onTouchStart(e) {
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
                    if (navigator.vibrate)
                        navigator.vibrate(30);
                }
            }, this.LONG_PRESS_DURATION);
        }
        onTouchMove(e) {
            if (!this.button)
                return;
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
        onTouchEnd(_e) {
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
                    browser.runtime.sendMessage({ action: 'navigate', direction: 'back' });
                    break;
                case 'gestureGuide':
                    this.showGestureGuide();
                    break;
            }
            browser.runtime.sendMessage({ action: 'logGesture', gestureType: `button_${action}` });
        }
        updatePosition() {
            if (!this.button)
                return;
            const size = this.getButtonSize();
            const x = Math.max(0, Math.min(this.currentX, window.innerWidth - size));
            const y = Math.max(0, Math.min(this.currentY, window.innerHeight - size));
            this.button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
        savePosition() {
            try {
                browser.storage.local.set({
                    floatingBtnPos: { x: this.currentX, y: this.currentY }
                });
            }
            catch { }
        }
        showGestureGuide() {
            if (!this.host)
                return;
            const existing = this.host.querySelector('.swift-guide');
            if (existing) {
                existing.remove();
                return;
            }
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

    class IntentDetector {
        constructor() {
            this._isInputFocused = false;
            this.abortController = new AbortController();
            const signal = this.abortController.signal;
            document.addEventListener('focusin', (e) => {
                const target = e.target;
                this._isInputFocused = this.isEditableElement(target);
            }, { signal });
            document.addEventListener('focusout', () => {
                this._isInputFocused = false;
            }, { signal });
        }
        // 스크롤 중에도 제스처 허용 — 스크롤로 차단하면 일반 웹에서 제스처 불가
        isScrolling() {
            return false;
        }
        isInputFocused() {
            return this._isInputFocused;
        }
        isIdle() {
            return !this._isInputFocused;
        }
        dispose() {
            this.abortController.abort();
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
            vShape: true,
            lShape: true,
            circle: true,
            cShape: true,
            diagonalSwipeUp: true,
        },
        sensitivity: 50,
        buttonSize: 'medium',
        buttonOpacity: 90,
    };
    class ConfigBridge {
        constructor() {
            this.config = null;
            this.subscriptionActive = false;
            this.configChangeCallbacks = [];
        }
        /**
         * Storage에서 직접 읽기 (background sendNativeMessage 우회)
         * 가장 신뢰성 높은 경로: content script → browser.storage.local → 직접 읽기
         */
        async loadConfig() {
            try {
                // 1차: storage에서 gestureConfig 직접 읽기
                const stored = await browser.storage.local.get('gestureConfig');
                if (stored?.gestureConfig) {
                    this.config = this.applySensitivity({ ...DEFAULT_CONFIG, ...stored.gestureConfig });
                    return this.config;
                }
            }
            catch { }
            try {
                // 2차: background에 요청 (fallback)
                const result = await browser.runtime.sendMessage({ action: 'getConfig' });
                if (result && Object.keys(result).length > 0) {
                    this.config = this.applySensitivity({ ...DEFAULT_CONFIG, ...result });
                    return this.config;
                }
            }
            catch { }
            // 3차: defaults
            this.config = { ...DEFAULT_CONFIG };
            return this.config;
        }
        /**
         * sensitivity (20-100) → 실제 제스처 감지 임계값 매핑
         */
        applySensitivity(config) {
            const s = (config.sensitivity ?? 50) / 100;
            const factor = 1.6 - s * 1.2;
            config.swipeMinDistance = Math.round(DEFAULT_CONFIG.swipeMinDistance * factor);
            config.vShapeMinSegment = Math.round(DEFAULT_CONFIG.vShapeMinSegment * factor);
            config.doubleTapMaxInterval = Math.round(DEFAULT_CONFIG.doubleTapMaxInterval * (2 - factor));
            config.longPressMinDuration = Math.round(DEFAULT_CONFIG.longPressMinDuration * factor);
            return config;
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
        /**
         * 2가지 경로로 config 변경 감지:
         * 1. runtime.onMessage (popup → background → content script)
         * 2. storage.onChanged (popup이 직접 storage에 쓸 때)
         */
        startListening() {
            browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
                // getState: popup이 현재 상태 요청 (Scrolly pattern)
                if (message.action === 'getState') {
                    try {
                        browser.storage.local.get('swiftSettings').then((data) => {
                            const ss = data?.swiftSettings;
                            if (ss) {
                                sendResponse({ action: 'currentState', settings: ss });
                            }
                        }).catch(() => { });
                    }
                    catch { }
                    return true; // async sendResponse
                }
                // configUpdated: popup이 설정 변경 전달
                if (message.action === 'configUpdated' && message.config) {
                    this.config = this.applySensitivity({ ...DEFAULT_CONFIG, ...message.config });
                    // Scrolly autoSaveSettings: content script가 storage에 직접 저장
                    const toSave = { gestureConfig: message.config };
                    if (message.swiftSettings) {
                        toSave.swiftSettings = message.swiftSettings;
                    }
                    try {
                        browser.storage.local.set(toSave).catch(() => { });
                    }
                    catch { }
                    this.configChangeCallbacks.forEach(cb => cb(this.config));
                }
            });
            // 경로 2: storage.onChanged 기반
            try {
                browser.storage.onChanged.addListener((changes, areaName) => {
                    if (areaName === 'local' && changes.gestureConfig?.newValue) {
                        this.config = this.applySensitivity({ ...DEFAULT_CONFIG, ...changes.gestureConfig.newValue });
                        this.configChangeCallbacks.forEach(cb => cb(this.config));
                    }
                });
            }
            catch { }
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
                // Start gesture engine if master is on
                if (config.masterEnabled) {
                    this.gestureEngine = new GestureEngine(config, this.intentDetector);
                    this.gestureEngine.start();
                }
                // Floating button — mount only when both master and floating are on
                if (config.masterEnabled && config.floatingButtonEnabled) {
                    this.floatingButton = new FloatingButton(config);
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
                        // Floating button 관리
                        const shouldShow = updatedConfig.masterEnabled && updatedConfig.floatingButtonEnabled;
                        if (shouldShow) {
                            if (!this.floatingButton) {
                                this.floatingButton = new FloatingButton(updatedConfig);
                            }
                            this.floatingButton.mount();
                            this.floatingButton.updateConfig(updatedConfig);
                        }
                        else {
                            this.floatingButton?.unmount();
                            this.floatingButton = null;
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
    // iframe 내에서는 실행하지 않음 (중복 플로팅 버튼 방지)
    if (window.self === window.top) {
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
    }

})();
