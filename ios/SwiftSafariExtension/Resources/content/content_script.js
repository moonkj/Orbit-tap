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
        getSession() {
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
        GestureType["X_SHAPE"] = "X_SHAPE";
        GestureType["L_SHAPE"] = "L_SHAPE";
        GestureType["CIRCLE"] = "CIRCLE";
        GestureType["C_SHAPE"] = "C_SHAPE";
    })(GestureType || (GestureType = {}));
    class ShapeDetector {
        constructor(config) {
            this.resizeHandler = null;
            this.config = config;
            this.screenWidth = window.innerWidth;
            this.edgeZone = Math.max(40, Math.min(80, this.screenWidth * config.edgeZonePercent));
            this.resizeHandler = () => {
                this.screenWidth = window.innerWidth;
                this.edgeZone = Math.max(40, Math.min(80, this.screenWidth * config.edgeZonePercent));
            };
            window.addEventListener('resize', this.resizeHandler);
        }
        destroy() {
            if (this.resizeHandler) {
                window.removeEventListener('resize', this.resizeHandler);
                this.resizeHandler = null;
            }
        }
        detect(session) {
            const { points } = session;
            if (points.length < 3)
                return GestureType.UNKNOWN;
            const start = points[0];
            // Safari 네이티브 제스처 영역 회피
            if (start.x < this.edgeZone || start.x > this.screenWidth - this.edgeZone) {
                return GestureType.UNKNOWN;
            }
            // 1. 세그먼트 기반 감지 먼저 (V, L, 대각선 — 직선 제스처 우선)
            const segments = this.extractSegments(points);
            if (segments.length === 2) {
                const shape = this.classifyShape(segments, session);
                if (shape !== GestureType.UNKNOWN)
                    return shape;
            }
            // X 감지: 3~4세그먼트, 방향 전환이 2회 이상, 경로가 교차
            if (segments.length >= 2 && segments.length <= 4) {
                const xResult = this.classifyXShape(points, segments, session);
                if (xResult !== GestureType.UNKNOWN)
                    return xResult;
            }
            // 2. 곡선 감지 (원, C — 세그먼트로 안 잡히는 경우만)
            if (points.length >= 5) {
                const curveResult = this.detectCurve(points, session);
                if (curveResult !== GestureType.UNKNOWN)
                    return curveResult;
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
        // ── X 형태 감지 ─────────────────────────────────────────────
        // 한 손가락 X: ↘ → ↗ (또는 반대) — 2~3세그먼트, 방향 급전환
        classifyXShape(_points, segments, session) {
            if (session.duration < 150 || session.duration > 1200)
                return GestureType.UNKNOWN;
            // X: 급격한 방향 전환이 있는 지그재그
            let bigTurnCount = 0;
            let totalDist = 0;
            for (let i = 0; i < segments.length; i++) {
                totalDist += segments[i].distance;
                if (i > 0) {
                    let diff = Math.abs(segments[i].angle - segments[i - 1].angle);
                    if (diff > 180)
                        diff = 360 - diff;
                    if (diff >= 60)
                        bigTurnCount++;
                }
            }
            // 1회 이상 급전환 + 충분한 거리 (L에서 안 잡힌 것만 여기 옴)
            if (bigTurnCount >= 1 && totalDist >= 40) {
                return GestureType.X_SHAPE;
            }
            return GestureType.UNKNOWN;
        }
        // ── L 형태 감지 ─────────────────────────────────────────────
        classifyShape(segments, session) {
            const [seg1, seg2] = segments;
            const angleDiff = Math.abs(seg2.angle - seg1.angle);
            const normalizedAngle = angleDiff > 180 ? 360 - angleDiff : angleDiff;
            // L Shape: 직각 꺾임 (60-120°)
            if (seg1.distance >= 40 &&
                seg2.distance >= 30 &&
                normalizedAngle >= 60 &&
                normalizedAngle <= 120 &&
                session.duration >= 150 &&
                session.duration <= 1500) {
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
                [GestureType.X_SHAPE]: 'rgba(255, 69, 58, ALPHA)', // 레드
                [GestureType.L_SHAPE]: 'rgba(48, 209, 88, ALPHA)', // 그린
                [GestureType.CIRCLE]: 'rgba(10, 132, 255, ALPHA)', // 블루
                [GestureType.C_SHAPE]: 'rgba(255, 159, 10, ALPHA)', // 오렌지
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
            let debounceTimer = null;
            this.input.addEventListener('input', () => {
                if (debounceTimer)
                    clearTimeout(debounceTimer);
                debounceTimer = window.setTimeout(() => this.search(this.input.value), 200);
            });
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
            const marks = document.querySelectorAll('mark[data-swift-hl]');
            if (marks.length === 0)
                return;
            marks.forEach(m => m.classList.remove('current'));
            this.currentIdx = (this.currentIdx + dir + marks.length) % marks.length;
            const current = marks[this.currentIdx];
            if (current) {
                current.classList.add('current');
                current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
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
        [GestureType.X_SHAPE]: 'xShape',
        [GestureType.L_SHAPE]: 'lShape',
        [GestureType.CIRCLE]: 'circle',
        [GestureType.C_SHAPE]: 'cShape',
    };
    const GESTURE_MODE_DURATION = 5000;
    function i18n(ko, en) {
        return (navigator.language || 'en').toLowerCase().startsWith('ko') ? ko : en;
    }
    class GestureEngine {
        constructor(config, intentDetector, usageTracker) {
            this.state = 'IDLE';
            this.cooldownTimer = null;
            // X 제스처: 두 획 연속 감지
            this.firstStroke = null;
            this.xStrokeTimer = null;
            this.X_STROKE_TIMEOUT = 1000; // 두 번째 획 대기 시간
            this.gestureMode = false;
            this.gestureModeTimer = null;
            this.overlay = null;
            this.overlayStyle = null;
            this.overlayAbort = null;
            this.liveCanvas = null;
            this.liveCtx = null;
            this.lastX = 0;
            this.lastY = 0;
            this.toast = null;
            this.config = config;
            this.intentDetector = intentDetector;
            this.usageTracker = usageTracker;
            this.touchTracker = new TouchTracker();
            this.shapeDetector = new ShapeDetector(config);
            this.feedback = new FeedbackOverlay();
            this.searchOverlay = new SearchOverlay();
        }
        start() { }
        stop() {
            this.deactivate();
            this.shapeDetector.destroy();
            if (this.cooldownTimer) {
                clearTimeout(this.cooldownTimer);
                this.cooldownTimer = null;
            }
        }
        /** 플로팅 버튼 3탭으로 호출 */
        async activateGestureMode() {
            if (this.gestureMode)
                return;
            // 최신 구독 상태 갱신 후 체크
            await this.usageTracker.refresh();
            if (!this.usageTracker.canUse()) {
                this.showSubscriptionPrompt();
                return;
            }
            this.gestureMode = true;
            // 토스트
            this.showToast(i18n('제스처 모드', 'Gesture Mode'), 'bottom');
            // 오버레이 스타일
            this.overlayStyle = document.createElement('style');
            this.overlayStyle.textContent = `
      .swift-gm-overlay {
        position:fixed; top:0; left:0; right:0; bottom:0;
        z-index:2147483644; touch-action:none;
        background:transparent;
        transition: background 0.2s;
      }
      .swift-gm-overlay.active { background:rgba(0,0,0,0.05); }
      .swift-gm-border {
        position:fixed; top:0; left:0; right:0; bottom:0;
        z-index:2147483643; pointer-events:none;
        border: 2px solid;
        border-image: linear-gradient(135deg, #a855f7, #ec4899, #06b6d4) 1;
        box-sizing:border-box;
        opacity:0; transition: opacity 0.3s;
        animation: swift-border-glow 2s ease-in-out infinite;
      }
      .swift-gm-border.active { opacity:1; }
      @keyframes swift-border-glow {
        0%, 100% { filter: brightness(1); }
        50% { filter: brightness(1.4); }
      }
    `;
            document.head.appendChild(this.overlayStyle);
            // 테두리 표시
            const border = document.createElement('div');
            border.className = 'swift-gm-border';
            document.documentElement.appendChild(border);
            requestAnimationFrame(() => border.classList.add('active'));
            // 투명 오버레이 (touch-action:none)
            this.overlay = document.createElement('div');
            this.overlay.className = 'swift-gm-overlay';
            this.liveCanvas = document.createElement('canvas');
            this.liveCanvas.width = window.innerWidth;
            this.liveCanvas.height = window.innerHeight;
            this.liveCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;';
            this.overlay.appendChild(this.liveCanvas);
            this.liveCtx = this.liveCanvas.getContext('2d');
            document.documentElement.appendChild(this.overlay);
            requestAnimationFrame(() => this.overlay?.classList.add('active'));
            this.overlayAbort = new AbortController();
            const sig = this.overlayAbort.signal;
            this.overlay.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false, signal: sig });
            this.overlay.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false, signal: sig });
            this.overlay.addEventListener('touchend', this.onTouchEnd.bind(this), { signal: sig });
            // 5초 후 자동 비활성화
            this.gestureModeTimer = window.setTimeout(() => this.deactivate(), GESTURE_MODE_DURATION);
        }
        deactivate() {
            if (!this.gestureMode)
                return;
            this.gestureMode = false;
            this.overlayAbort?.abort();
            this.overlayAbort = null;
            if (this.gestureModeTimer) {
                clearTimeout(this.gestureModeTimer);
                this.gestureModeTimer = null;
            }
            if (this.xStrokeTimer) {
                clearTimeout(this.xStrokeTimer);
                this.xStrokeTimer = null;
            }
            this.firstStroke = null;
            // 테두리 페이드아웃
            const border = document.querySelector('.swift-gm-border');
            if (border) {
                border.classList.remove('active');
                setTimeout(() => border.remove(), 300);
            }
            // 오버레이 제거
            if (this.overlay) {
                this.overlay.classList.remove('active');
                setTimeout(() => { this.overlay?.remove(); this.overlay = null; }, 200);
            }
            this.overlayStyle?.remove();
            this.overlayStyle = null;
            this.liveCanvas = null;
            this.liveCtx = null;
            this.state = 'IDLE';
        }
        showToast(text, pos = 'center') {
            this.toast?.remove();
            this.toast = document.createElement('div');
            const posStyle = pos === 'bottom'
                ? 'bottom:120px; left:50%; transform:translateX(-50%);'
                : 'top:50%; left:50%; transform:translate(-50%,-50%);';
            this.toast.style.cssText = `
      position:fixed; ${posStyle}
      background:rgba(0,0,0,0.8); color:#fff;
      padding:14px 32px; border-radius:14px;
      font:600 17px -apple-system,BlinkMacSystemFont,sans-serif;
      z-index:2147483647; pointer-events:none;
      opacity:0; transition:opacity 0.15s;
      text-align:center;
    `;
            this.toast.textContent = text;
            document.documentElement.appendChild(this.toast);
            requestAnimationFrame(() => { if (this.toast)
                this.toast.style.opacity = '1'; });
            setTimeout(() => {
                if (this.toast) {
                    this.toast.style.opacity = '0';
                    setTimeout(() => { this.toast?.remove(); this.toast = null; }, 200);
                }
            }, 2000);
        }
        // ── Touch (오버레이 위) ───────────────────────────────────
        onTouchStart(e) {
            e.preventDefault();
            if (this.state === 'COOLDOWN')
                return;
            this.touchTracker.onTouchStart(e);
            this.state = 'DETECTING';
            this.lastX = e.touches[0].clientX;
            this.lastY = e.touches[0].clientY;
            // 타이머 리셋
            if (this.gestureModeTimer)
                clearTimeout(this.gestureModeTimer);
            this.gestureModeTimer = window.setTimeout(() => this.deactivate(), GESTURE_MODE_DURATION);
            // 첫 획 대기 중이 아니면 캔버스 클리어
            if (!this.firstStroke && this.liveCtx && this.liveCanvas) {
                this.liveCtx.clearRect(0, 0, this.liveCanvas.width, this.liveCanvas.height);
            }
        }
        onTouchMove(e) {
            e.preventDefault();
            if (this.state !== 'DETECTING')
                return;
            this.touchTracker.onTouchMove(e);
            // 실시간 궤적 그리기 — 네온 그라데이션
            if (this.liveCtx && this.liveCanvas) {
                const x = e.touches[0].clientX;
                const y = e.touches[0].clientY;
                // 그라데이션 스트로크 (보라 → 핑크 → 시안)
                const grad = this.liveCtx.createLinearGradient(this.lastX, this.lastY, x, y);
                const hue = (performance.now() * 0.15) % 360;
                grad.addColorStop(0, `hsla(${hue}, 100%, 70%, 0.9)`);
                grad.addColorStop(1, `hsla(${(hue + 60) % 360}, 100%, 70%, 0.9)`);
                // 글로우 효과
                this.liveCtx.shadowColor = `hsla(${hue}, 100%, 60%, 0.6)`;
                this.liveCtx.shadowBlur = 12;
                this.liveCtx.beginPath();
                this.liveCtx.moveTo(this.lastX, this.lastY);
                this.liveCtx.lineTo(x, y);
                this.liveCtx.strokeStyle = grad;
                this.liveCtx.lineWidth = 4;
                this.liveCtx.lineCap = 'round';
                this.liveCtx.stroke();
                this.liveCtx.shadowBlur = 0;
                this.lastX = x;
                this.lastY = y;
            }
        }
        onTouchEnd(e) {
            if (this.state !== 'DETECTING')
                return;
            const session = this.touchTracker.onTouchEnd(e);
            this.state = 'IDLE';
            const pts = session?.points?.length ?? 0;
            if (session && pts >= 3) {
                const gesture = this.shapeDetector.detect(session);
                // 다른 제스처 인식 성공 → 실행
                if (gesture !== GestureType.UNKNOWN && gesture !== GestureType.X_SHAPE) {
                    this.firstStroke = null;
                    if (this.xStrokeTimer) {
                        clearTimeout(this.xStrokeTimer);
                        this.xStrokeTimer = null;
                    }
                    this.deactivate();
                    this.executeGesture(gesture, session.points);
                    return;
                }
                // X 두 획 감지: 직선 한 획이면 저장하고 두 번째 대기
                const p = session.points;
                const strokeAngle = Math.atan2(p[p.length - 1].y - p[0].y, p[p.length - 1].x - p[0].x) * (180 / Math.PI);
                const strokeDist = Math.sqrt((p[p.length - 1].x - p[0].x) ** 2 + (p[p.length - 1].y - p[0].y) ** 2);
                if (strokeDist >= 30) {
                    if (this.firstStroke) {
                        // 두 번째 획: 첫 번째와 각도 차이 확인
                        let angleDiff = Math.abs(strokeAngle - this.firstStroke.angle);
                        if (angleDiff > 180)
                            angleDiff = 360 - angleDiff;
                        if (angleDiff >= 30) {
                            // X 인식 성공!
                            const allPoints = [...this.firstStroke.points, ...p];
                            this.firstStroke = null;
                            if (this.xStrokeTimer) {
                                clearTimeout(this.xStrokeTimer);
                                this.xStrokeTimer = null;
                            }
                            this.deactivate();
                            this.executeGesture(GestureType.X_SHAPE, allPoints);
                            return;
                        }
                    }
                    // 첫 번째 획 저장
                    this.firstStroke = { points: p, angle: strokeAngle };
                    if (this.xStrokeTimer)
                        clearTimeout(this.xStrokeTimer);
                    this.xStrokeTimer = window.setTimeout(() => {
                        this.firstStroke = null;
                        this.xStrokeTimer = null;
                    }, this.X_STROKE_TIMEOUT);
                    this.showToast(i18n('한 획 더 그리세요', 'Draw one more'), 'bottom');
                    return;
                }
            }
            // 인식 실패
            this.showToast(`${pts}pts`, 'bottom');
            if (this.liveCtx && this.liveCanvas) {
                this.liveCtx.clearRect(0, 0, this.liveCanvas.width, this.liveCanvas.height);
            }
        }
        executeGesture(gesture, points) {
            const configKey = GESTURE_CONFIG_KEY[gesture];
            if (configKey && this.config.gesturesEnabled[configKey] !== true)
                return;
            // 사용량 기록
            this.usageTracker.recordUse();
            this.feedback.show(gesture, points);
            const names = {
                [GestureType.X_SHAPE]: ['X — 탭 닫기', 'X — Close Tab'],
                [GestureType.L_SHAPE]: ['L — 새 탭 열기', 'L — New Tab'],
                [GestureType.CIRCLE]: ['○ — 페이지 내 검색', '○ — Find on Page'],
                [GestureType.C_SHAPE]: ['C — 새로고침', 'C — Hard Refresh'],
            };
            const label = names[gesture];
            if (label)
                this.showToast(i18n(label[0], label[1]));
            switch (gesture) {
                case GestureType.X_SHAPE:
                    browser.runtime.sendMessage({ action: 'closeTab' });
                    break;
                case GestureType.L_SHAPE:
                    browser.runtime.sendMessage({ action: 'newTab' });
                    break;
                case GestureType.CIRCLE:
                    this.searchOverlay.show();
                    break;
                case GestureType.C_SHAPE:
                    browser.runtime.sendMessage({ action: 'clearSiteData' });
                    break;
            }
            this.state = 'COOLDOWN';
            this.cooldownTimer = window.setTimeout(() => { this.state = 'IDLE'; this.cooldownTimer = null; }, 500);
        }
        showSubscriptionPrompt() {
            const el = document.createElement('div');
            el.style.cssText = `
      position:fixed; top:0; left:0; right:0; bottom:0;
      z-index:2147483647; display:flex; align-items:center; justify-content:center;
      background:rgba(0,0,0,0.6);
      font-family:-apple-system,BlinkMacSystemFont,sans-serif;
    `;
            el.innerHTML = `
      <div style="background:#1c1c1e;border-radius:16px;padding:28px 24px;max-width:300px;text-align:center;color:#fff;">
        <div style="font-size:32px;margin-bottom:12px;">⚡</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:8px;">
          ${i18n('오늘 무료 사용 완료', 'Free Limit Reached')}
        </div>
        <div style="font-size:13px;color:#98989d;margin-bottom:20px;line-height:1.5;">
          ${i18n('무료 사용자는 하루 10회까지 사용할 수 있습니다.\nSWIFT Pro를 구독하면 무제한으로 사용하세요!', 'Free users can use up to 10 times per day.\nSubscribe to SWIFT Pro for unlimited access!')}
        </div>
        <div style="font-size:22px;font-weight:700;color:#0a84ff;margin-bottom:16px;">$0.99/month</div>
        <button id="swift-sub-btn" style="
          width:100%;padding:14px;border:none;border-radius:12px;
          background:#0a84ff;color:#fff;font-size:16px;font-weight:600;cursor:pointer;
          font-family:-apple-system,BlinkMacSystemFont,sans-serif;
        ">${i18n('구독하기', 'Subscribe')}</button>
        <button id="swift-sub-close" style="
          width:100%;padding:10px;border:none;background:none;
          color:#98989d;font-size:13px;cursor:pointer;margin-top:8px;
          font-family:-apple-system,BlinkMacSystemFont,sans-serif;
        ">${i18n('나중에', 'Later')}</button>
      </div>
    `;
            document.documentElement.appendChild(el);
            el.querySelector('#swift-sub-close')?.addEventListener('click', () => el.remove());
            el.querySelector('#swift-sub-btn')?.addEventListener('click', () => {
                // ShieldMail 패턴: URL scheme으로 앱 구독 화면 열기
                window.location.href = 'swiftgesture://subscribe';
                el.remove();
            });
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
            this.TAP_TIMEOUT = 700;
            this.DRAG_HOLD_DURATION = 600;
            this.GUIDE_HOLD_DURATION = 3000;
            this.guideTimer = null;
            this.abortController = null;
            this.onGestureActivate = null;
            this.usageTracker = null;
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
        transform: scale(0.82);
        background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.08), transparent 60%),
                    linear-gradient(145deg, rgba(80,80,90,0.8), rgba(40,40,45,0.85));
        box-shadow: 0 0 2px rgba(0,0,0,0.3),
                    inset 0 2px 6px rgba(0,0,0,0.3);
      }
      .swift-fb.pressed svg circle {
        transform: scale(0.75);
        transform-origin: center;
        stroke: rgba(10, 132, 255, 0.9) !important;
        transition: transform 0.1s ease, stroke 0.1s ease;
      }
      .swift-fb.dragging {
        transition: none !important;
        opacity: 0.6;
      }
      .swift-fb svg {
        width: 80%;
        height: 80%;
        pointer-events: none;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
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
            this.button.innerHTML = `<svg viewBox="0 0 24 24" fill="none"><defs><linearGradient id="sr" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="rgba(255,255,255,1)"/><stop offset="100%" stop-color="rgba(255,255,255,0.5)"/></linearGradient><radialGradient id="sf" cx="38%" cy="36%" r="45%"><stop offset="0%" stop-color="rgba(255,255,255,0.15)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/></radialGradient></defs><circle cx="12" cy="12" r="8.5" stroke="url(#sr)" stroke-width="2.2"/><circle cx="12" cy="12" r="7.5" fill="url(#sf)"/></svg>`;
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
            if (this.tapTimer) {
                clearTimeout(this.tapTimer);
                this.tapTimer = null;
            }
            if (this.longPressTimer) {
                clearTimeout(this.longPressTimer);
                this.longPressTimer = null;
            }
            if (this.guideTimer) {
                clearTimeout(this.guideTimer);
                this.guideTimer = null;
            }
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
                this.button.style.borderRadius = `${Math.round(newSize * 0.22)}px`;
                // SVG는 CSS width:80%로 자동 비례 — 별도 JS 크기 조정 불필요
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
            // 400ms 후 드래그 가능
            this.longPressTimer = window.setTimeout(() => {
                if (this.totalDragDistance < 25) {
                    this.dragReady = true;
                    this.button?.classList.add('drag-ready');
                    if (navigator.vibrate)
                        navigator.vibrate(30);
                }
            }, this.DRAG_HOLD_DURATION);
            // 5초 후 가이드 표시 (드래그 중이 아닐 때)
            this.guideTimer = window.setTimeout(() => {
                if (!this.isDragging) {
                    this.button?.classList.remove('drag-ready');
                    this.dragReady = false;
                    this.executeTapAction('gestureGuide');
                }
            }, this.GUIDE_HOLD_DURATION);
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
            // 꾹 누른 후 의도적 이동(20px+)에서만 드래그 시작
            if (this.dragReady && this.totalDragDistance > 20) {
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
            // guideTimer는 여기서 제거 — 5초 전에 손을 떼면 가이드 취소
            if (this.guideTimer) {
                clearTimeout(this.guideTimer);
                this.guideTimer = null;
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
            // 꾹 눌러서 drag-ready 됐지만 안 움직인 경우 → 무시 (가이드는 5초 타이머에서)
            if (this.dragReady) {
                this.dragReady = false;
                return;
            }
            // 탭 감지 (400ms 미만 + 움직임 10px 미만)
            const duration = performance.now() - this.dragStartTime;
            if (duration < this.DRAG_HOLD_DURATION && this.totalDragDistance < 10) {
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
                            this.executeTapAction('gesture');
                            break;
                    }
                    this.tapCount = 0;
                }, this.TAP_TIMEOUT);
            }
        }
        setGestureActivator(fn) {
            this.onGestureActivate = fn;
        }
        setUsageTracker(tracker) {
            this.usageTracker = tracker;
        }
        executeTapAction(action) {
            // 사용량 기록 (가이드 제외, 비동기 — 블로킹 없음)
            if (action !== 'gestureGuide' && this.usageTracker) {
                this.usageTracker.recordUse();
            }
            switch (action) {
                case 'gesture':
                    this.onGestureActivate?.();
                    break;
                case 'back':
                    browser.runtime.sendMessage({ action: 'navigate', direction: 'back' });
                    break;
                case 'forward':
                    browser.runtime.sendMessage({ action: 'navigate', direction: 'forward' });
                    break;
                case 'gestureGuide':
                    this.showGestureGuide();
                    break;
            }
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
            const k = (navigator.language || '').startsWith('ko');
            this.guideOverlay = document.createElement('div');
            this.guideOverlay.className = 'swift-guide';
            this.guideOverlay.innerHTML = `
      <h2>SWIFT ${k ? '제스처 가이드' : 'Gesture Guide'}</h2>
      <div class="swift-guide-item" style="background:rgba(10,132,255,0.15);border:1px solid rgba(10,132,255,0.3);">
        <div class="swift-guide-icon">👆×3</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">${k ? '버튼 3번 탭 → 제스처 모드' : '3 taps → Gesture mode'}</div>
          <div class="swift-guide-desc">${k ? '파란 테두리가 나타나면 제스처를 그리세요' : 'Draw gestures when blue border appears'}</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon" style="color:#FF453A">✕</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">${k ? 'X 모양' : 'X Shape'}</div>
          <div class="swift-guide-desc">${k ? '현재 탭 닫기' : 'Close current tab'}</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon" style="color:#30D158">L</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">${k ? 'L 모양' : 'L Shape'}</div>
          <div class="swift-guide-desc">${k ? '새 탭 열기' : 'Open new tab'}</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon" style="color:#0A84FF">○</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">${k ? '원 그리기' : 'Circle'}</div>
          <div class="swift-guide-desc">${k ? '페이지 내 텍스트 검색' : 'Find text on page'}</div>
        </div>
      </div>
      <div class="swift-guide-item">
        <div class="swift-guide-icon" style="color:#FF9F0A">C</div>
        <div class="swift-guide-text">
          <div class="swift-guide-label">${k ? 'C 모양' : 'C Shape'}</div>
          <div class="swift-guide-desc">${k ? '새로고침 (캐시 무시)' : 'Hard refresh'}</div>
        </div>
      </div>
      <div style="margin-top:8px;color:rgba(255,255,255,0.85);font-size:11px;text-align:center;">${k ? '1탭: 뒤로 · 2탭: 앞으로 · 3탭: 제스처 모드 · 꾹: 가이드' : '1 tap: back · 2 taps: forward · 3 taps: gesture · hold: guide'}</div>
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
        isInputFocused() {
            return this._isInputFocused;
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
        constructor(userExclusions) {
            this.builtinExcludedDomains = [];
            this.userExcludedDomains = [];
            if (userExclusions)
                this.userExcludedDomains = userExclusions;
        }
        shouldExclude() {
            return this.isDomainExcluded() || this.isInsideIframe();
        }
        isInsideIframe() {
            try {
                return window !== window.top;
            }
            catch {
                return true;
            }
        }
        isDomainExcluded() {
            const hostname = window.location.hostname;
            const allExcluded = [...this.builtinExcludedDomains, ...this.userExcludedDomains];
            return allExcluded.some(domain => hostname.includes(domain));
        }
    }

    const DEFAULT_CONFIG = {
        masterEnabled: true,
        edgeZonePercent: 0.12,
        floatingButtonEnabled: true,
        gesturesEnabled: {
            xShape: true,
            lShape: true,
            circle: true,
            cShape: true,
        },
        sensitivity: 50,
        buttonSize: 'medium',
        buttonOpacity: 90,
    };
    class ConfigBridge {
        constructor() {
            this.config = null;
            this.configChangeCallbacks = [];
        }
        async loadConfig() {
            try {
                const stored = await browser.storage.local.get('gestureConfig');
                if (stored?.gestureConfig) {
                    this.config = { ...DEFAULT_CONFIG, ...stored.gestureConfig };
                    return this.config;
                }
            }
            catch { }
            try {
                const result = await browser.runtime.sendMessage({ action: 'getConfig' });
                if (result && Object.keys(result).length > 0) {
                    this.config = { ...DEFAULT_CONFIG, ...result };
                    return this.config;
                }
            }
            catch { }
            this.config = { ...DEFAULT_CONFIG };
            return this.config;
        }
        getConfig() {
            return this.config ?? { ...DEFAULT_CONFIG };
        }
        onConfigChange(callback) {
            this.configChangeCallbacks.push(callback);
        }
        startListening() {
            browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
                if (message.action === 'getState') {
                    try {
                        browser.storage.local.get('swiftSettings').then((data) => {
                            sendResponse({ action: 'currentState', settings: data?.swiftSettings ?? null });
                        }).catch(() => {
                            sendResponse({ action: 'currentState', settings: null });
                        });
                    }
                    catch {
                        sendResponse({ action: 'currentState', settings: null });
                    }
                    return true;
                }
                if (message.action === 'configUpdated' && message.config) {
                    this.config = { ...DEFAULT_CONFIG, ...message.config };
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
            try {
                browser.storage.onChanged.addListener((changes, areaName) => {
                    if (areaName === 'local' && changes.gestureConfig?.newValue) {
                        this.config = { ...DEFAULT_CONFIG, ...changes.gestureConfig.newValue };
                        this.configChangeCallbacks.forEach(cb => cb(this.config));
                    }
                });
            }
            catch { }
        }
    }

    const USAGE_KEY = 'swiftUsage';
    const DAILY_FREE_LIMIT = 10;
    const SIGN_SALT = 'sw1ft_2026';
    /** 간단 서명: storage 변조 방지 (콘솔에서 isSubscribed 직접 수정 차단) */
    function computeSignature(data) {
        const raw = `${SIGN_SALT}:${data.isSubscribed}:${data.date}:${data.count}`;
        let h = 0;
        for (let i = 0; i < raw.length; i++) {
            h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
        }
        return h.toString(36);
    }
    function today() {
        return new Date().toISOString().slice(0, 10);
    }
    function weekStart() {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay());
        return d.toISOString().slice(0, 10);
    }
    function monthKey() {
        return new Date().toISOString().slice(0, 7);
    }
    function defaultData() {
        return {
            date: today(), count: 0, isSubscribed: false,
            totalFreeCount: 0, weekStart: weekStart(), weekFreeCount: 0,
            monthKey: monthKey(), monthSubDays: 0,
        };
    }
    class UsageTracker {
        constructor() {
            this.data = defaultData();
        }
        /** storage 변경 실시간 감지 */
        startListening() {
            try {
                browser.storage.onChanged.addListener((changes, area) => {
                    if (area === 'local' && changes[USAGE_KEY]?.newValue) {
                        const updated = changes[USAGE_KEY].newValue;
                        this.data = { ...defaultData(), ...updated };
                    }
                });
            }
            catch { }
        }
        async load() {
            try {
                const stored = await browser.storage.local.get(USAGE_KEY);
                if (stored?.[USAGE_KEY]) {
                    const loaded = { ...defaultData(), ...stored[USAGE_KEY] };
                    // 서명 검증: 변조된 경우 구독 상태 무효화
                    if (loaded.isSubscribed && loaded._sig !== computeSignature(loaded)) {
                        loaded.isSubscribed = false;
                    }
                    this.data = loaded;
                }
            }
            catch { }
            // 날짜 변경 시 일일 카운트 리셋
            const t = today();
            if (this.data.date !== t) {
                this.data.date = t;
                this.data.count = 0;
            }
            const ws = weekStart();
            if (this.data.weekStart !== ws) {
                this.data.weekStart = ws;
                this.data.weekFreeCount = 0;
            }
            const mk = monthKey();
            if (this.data.monthKey !== mk) {
                this.data.monthKey = mk;
                this.data.monthSubDays = 0;
            }
            // Native app에서 구독 상태 확인 (ShieldMail 패턴)
            try {
                const result = await browser.runtime.sendNativeMessage('com.swift.app', { action: 'getSubscriptionStatus' });
                if (result?.isActive === true) {
                    this.data.isSubscribed = true;
                }
            }
            catch {
                // Native messaging 실패 시 storage 값 유지
            }
            await this.save();
        }
        /** 사용 전 storage에서 최신 상태 갱신 */
        async refresh() {
            try {
                const stored = await browser.storage.local.get(USAGE_KEY);
                if (stored?.[USAGE_KEY]) {
                    this.data = { ...defaultData(), ...stored[USAGE_KEY] };
                }
            }
            catch { }
        }
        canUse() {
            if (this.data.isSubscribed)
                return true;
            return this.data.count < DAILY_FREE_LIMIT;
        }
        remaining() {
            if (this.data.isSubscribed)
                return Infinity;
            return Math.max(0, DAILY_FREE_LIMIT - this.data.count);
        }
        async recordUse() {
            this.data.count++;
            if (!this.data.isSubscribed) {
                this.data.totalFreeCount++;
                this.data.weekFreeCount++;
            }
            await this.save();
        }
        isSubscribed() {
            return this.data.isSubscribed;
        }
        async setSubscription(active) {
            this.data.isSubscribed = active;
            if (active)
                this.data.monthSubDays++;
            await this.save();
        }
        getStats() {
            return {
                weekFree: this.data.weekFreeCount,
                totalFree: this.data.totalFreeCount,
                monthSub: this.data.monthSubDays,
                todayCount: this.data.count,
            };
        }
        async resetStats() {
            this.data = defaultData();
            await this.save();
        }
        async save() {
            try {
                const toSave = { ...this.data, _sig: computeSignature(this.data) };
                await browser.storage.local.set({ [USAGE_KEY]: toSave });
            }
            catch { }
        }
    }

    class SwiftExtension {
        constructor() {
            this.gestureEngine = null;
            this.floatingButton = null;
            this.intentDetector = null;
            this.exclusionManager = null;
            this.configBridge = new ConfigBridge();
            this.usageTracker = new UsageTracker();
        }
        async init() {
            try {
                // Load config via background (falls back to storage cache)
                const config = await this.configBridge.loadConfig();
                await this.usageTracker.load();
                this.usageTracker.startListening();
                this.exclusionManager = new ExclusionManager();
                if (this.exclusionManager.shouldExclude())
                    return;
                this.intentDetector = new IntentDetector();
                // Start gesture engine if master is on
                if (config.masterEnabled) {
                    this.gestureEngine = new GestureEngine(config, this.intentDetector, this.usageTracker);
                    this.gestureEngine.start();
                }
                // Floating button — mount only when both master and floating are on
                if (config.masterEnabled && config.floatingButtonEnabled) {
                    this.floatingButton = new FloatingButton(config);
                    this.floatingButton.mount();
                    this.floatingButton.setUsageTracker(this.usageTracker);
                    if (this.gestureEngine) {
                        this.floatingButton.setGestureActivator(() => this.gestureEngine?.activateGestureMode());
                    }
                }
                // Listen for config changes broadcast by background
                this.configBridge.onConfigChange((updatedConfig) => {
                    try {
                        // Tear down existing gesture engine
                        this.gestureEngine?.stop();
                        this.gestureEngine = null;
                        // Restart engine only if master switch is on
                        if (updatedConfig.masterEnabled === true) {
                            this.gestureEngine = new GestureEngine(updatedConfig, this.intentDetector, this.usageTracker);
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
                            this.floatingButton.setUsageTracker(this.usageTracker);
                            if (this.gestureEngine) {
                                this.floatingButton.setGestureActivator(() => this.gestureEngine?.activateGestureMode());
                            }
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
                    // 제스처 모드는 오버레이 기반이므로 visibility 관리 불필요
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
