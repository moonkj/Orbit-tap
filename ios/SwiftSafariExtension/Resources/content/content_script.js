(function () {
    'use strict';

    class TouchTracker {
        constructor() {
            this.points = [];
            this.fingerCount = 0;
            this.startTime = 0;
            this.lastSampleTime = 0;
            this.sampleInterval = 33; // ~30Hz
        }
        onTouchStart(e) {
            this.points = [];
            this.fingerCount = e.touches.length;
            this.startTime = performance.now();
            this.lastSampleTime = 0;
            this.addPoint(e.touches[0]);
        }
        onTouchMove(e) {
            const now = performance.now();
            if (now - this.lastSampleTime < this.sampleInterval)
                return;
            this.lastSampleTime = now;
            this.fingerCount = Math.max(this.fingerCount, e.touches.length);
            this.addPoint(e.touches[0]);
            if (e.touches.length >= 2) {
                this.addPoint(e.touches[1], true);
            }
        }
        onTouchEnd(_e) {
            if (this.points.length < 2)
                return null;
            const endTime = performance.now();
            return {
                points: [...this.points],
                fingerCount: this.fingerCount,
                startTime: this.startTime,
                endTime,
                duration: endTime - this.startTime,
            };
        }
        reset() {
            this.points = [];
            this.fingerCount = 0;
            this.startTime = 0;
        }
        addPoint(touch, _isSecondFinger = false) {
            this.points.push({
                x: touch.clientX,
                y: touch.clientY,
                timestamp: performance.now(),
            });
        }
    }

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
            if (segment.dx < 0 && session.duration < 1000)
                return GestureType.SWIPE_BACK;
            if (segment.dx > 0 && session.duration < 1000)
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

    class GestureEngine {
        constructor(config, intentDetector) {
            this.state = 'IDLE';
            this.cooldownTimer = null;
            this.abortController = null;
            this.config = config;
            this.intentDetector = intentDetector;
            this.touchTracker = new TouchTracker();
            this.shapeDetector = new ShapeDetector(config);
            this.tapDetector = new TapDetector(config);
            this.feedback = new FeedbackOverlay();
        }
        start() {
            this.abortController = new AbortController();
            const signal = this.abortController.signal;
            document.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true, signal });
            document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: true, signal });
            document.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true, signal });
            document.addEventListener('touchcancel', this.onTouchCancel.bind(this), { passive: true, signal });
            this.state = 'IDLE';
        }
        stop() {
            this.abortController?.abort();
            this.abortController = null;
            if (this.cooldownTimer) {
                clearTimeout(this.cooldownTimer);
                this.cooldownTimer = null;
            }
        }
        pause() {
            this.state = 'SUPPRESSED';
        }
        resume() {
            this.state = 'IDLE';
        }
        onTouchStart(e) {
            if (this.state === 'COOLDOWN' || this.state === 'SUPPRESSED')
                return;
            if (this.intentDetector.isScrolling() || this.intentDetector.isInputFocused()) {
                this.state = 'SUPPRESSED';
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
            if (this.state === 'COOLDOWN' || this.state === 'SUPPRESSED') {
                if (this.state === 'SUPPRESSED' && !this.intentDetector.isScrolling() && !this.intentDetector.isInputFocused()) {
                    this.state = 'IDLE';
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
        }
        executeGesture(gesture) {
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
            this.isDragging = false;
            this.currentX = 0;
            this.currentY = 0;
            this.rafId = null;
            this.config = config;
            this.currentX = window.innerWidth - 60;
            this.currentY = window.innerHeight * 0.7;
        }
        mount() {
            this.host = document.createElement('div');
            this.host.id = 'swift-gesture-host';
            this.shadow = this.host.attachShadow({ mode: 'closed' });
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(`
      .swift-floating-btn {
        position: fixed;
        width: 48px;
        height: 48px;
        border-radius: 24px;
        background: rgba(10, 132, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        z-index: 2147483647;
        will-change: transform;
        touch-action: none;
        -webkit-backface-visibility: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        transition: opacity 0.2s ease;
      }
      .swift-floating-btn.dragging {
        transition: none !important;
        opacity: 0.8;
      }
      .swift-floating-btn.hidden {
        opacity: 0;
        pointer-events: none;
      }
      .swift-floating-btn svg {
        width: 24px;
        height: 24px;
        fill: white;
      }
    `);
            this.shadow.adoptedStyleSheets = [sheet];
            this.button = document.createElement('div');
            this.button.className = 'swift-floating-btn';
            this.button.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/></svg>`;
            this.updatePosition();
            this.button.addEventListener('touchstart', this.onBtnTouchStart.bind(this), { passive: false });
            document.addEventListener('touchmove', this.onBtnTouchMove.bind(this), { passive: false });
            document.addEventListener('touchend', this.onBtnTouchEnd.bind(this), { passive: true });
            this.shadow.appendChild(this.button);
            document.documentElement.appendChild(this.host);
        }
        unmount() {
            this.host?.remove();
            this.host = null;
            this.shadow = null;
            this.button = null;
        }
        onBtnTouchStart(e) {
            e.preventDefault();
            e.stopPropagation();
            this.isDragging = false;
            // Set up for potential drag
        }
        onBtnTouchMove(e) {
            if (!this.button?.contains(e.target) && !this.isDragging)
                return;
            this.isDragging = true;
            e.preventDefault();
            this.currentX = e.touches[0].clientX - 24;
            this.currentY = e.touches[0].clientY - 24;
            if (!this.rafId) {
                this.rafId = requestAnimationFrame(() => {
                    this.updatePosition();
                    this.rafId = null;
                });
            }
        }
        onBtnTouchEnd(_e) {
            if (!this.isDragging) {
                // It was a tap - execute action
                browser.runtime.sendMessage({ action: 'navigate', direction: 'back' });
            }
            else {
                this.snapToEdge();
            }
            this.isDragging = false;
        }
        updatePosition() {
            const x = Math.max(0, Math.min(this.currentX, window.innerWidth - 48));
            const y = Math.max(0, Math.min(this.currentY, window.innerHeight - 48));
            this.button.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        }
        snapToEdge() {
            const midX = window.innerWidth / 2;
            this.currentX = this.currentX < midX ? 8 : window.innerWidth - 56;
            this.button.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)';
            this.updatePosition();
            setTimeout(() => {
                if (this.button)
                    this.button.style.transition = '';
            }, 250);
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
        constructor() {
            this.excludedDomains = [
                'maps.google.com',
                'docs.google.com',
                'figma.com',
            ];
        }
        shouldExclude() {
            return this.isDomainExcluded() || this.isInsideIframe();
        }
        isOverflowX(element) {
            const style = window.getComputedStyle(element);
            return style.overflowX === 'scroll' || style.overflowX === 'auto';
        }
        isInsideIframe() {
            return window !== window.top;
        }
        isDomainExcluded() {
            const hostname = window.location.hostname;
            return this.excludedDomains.some(domain => hostname.includes(domain));
        }
    }

    const DEFAULT_CONFIG = {
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
        async loadConfig() {
            try {
                const result = await browser.runtime.sendNativeMessage('com.swift.app', { action: 'getConfig' });
                return { ...DEFAULT_CONFIG, ...result };
            }
            catch {
                // Fallback to storage
                const stored = await browser.storage.local.get('gestureConfig');
                if (stored.gestureConfig) {
                    return { ...DEFAULT_CONFIG, ...stored.gestureConfig };
                }
                return DEFAULT_CONFIG;
            }
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
            const config = await this.configBridge.loadConfig();
            this.exclusionManager = new ExclusionManager();
            if (this.exclusionManager.shouldExclude())
                return;
            this.intentDetector = new IntentDetector();
            this.gestureEngine = new GestureEngine(config, this.intentDetector);
            this.floatingButton = new FloatingButton(config);
            this.gestureEngine.start();
            this.floatingButton.mount();
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.gestureEngine?.pause();
                }
                else {
                    this.gestureEngine?.resume();
                }
            });
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
