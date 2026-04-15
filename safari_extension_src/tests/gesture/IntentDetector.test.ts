import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IntentDetector } from '../../src/content/intent/IntentDetector';

// Mock window with setTimeout support
vi.stubGlobal('window', {
  setTimeout: (fn: Function, delay: number) => globalThis.setTimeout(fn as TimerHandler, delay),
  clearTimeout: (id: number) => globalThis.clearTimeout(id),
});

// Mock document event listeners
const listeners: Record<string, Function[]> = {};
vi.stubGlobal('document', {
  addEventListener: (type: string, fn: Function, opts?: any) => {
    if (!listeners[type]) listeners[type] = [];
    listeners[type].push(fn);
  },
  removeEventListener: vi.fn(),
});

function fireEvent(type: string, target?: any) {
  listeners[type]?.forEach(fn => fn({ target: target ?? document }));
}

describe('IntentDetector', () => {
  let detector: IntentDetector;

  beforeEach(() => {
    Object.keys(listeners).forEach(k => delete listeners[k]);
    detector = new IntentDetector();
    vi.useFakeTimers();
  });

  it('should start in idle state', () => {
    expect(detector.isScrolling()).toBe(false);
    expect(detector.isInputFocused()).toBe(false);
    expect(detector.isIdle()).toBe(true);
  });

  it('should detect scrolling', () => {
    fireEvent('scroll');
    expect(detector.isScrolling()).toBe(true);
    expect(detector.isIdle()).toBe(false);
  });

  it('should reset scroll after 150ms', () => {
    fireEvent('scroll');
    expect(detector.isScrolling()).toBe(true);
    vi.advanceTimersByTime(150);
    expect(detector.isScrolling()).toBe(false);
  });

  it('should detect input focus', () => {
    fireEvent('focusin', { tagName: 'INPUT', isContentEditable: false });
    expect(detector.isInputFocused()).toBe(true);
  });

  it('should detect textarea focus', () => {
    fireEvent('focusin', { tagName: 'TEXTAREA', isContentEditable: false });
    expect(detector.isInputFocused()).toBe(true);
  });

  it('should detect contenteditable focus', () => {
    fireEvent('focusin', { tagName: 'DIV', isContentEditable: true });
    expect(detector.isInputFocused()).toBe(true);
  });

  it('should not flag non-input elements', () => {
    fireEvent('focusin', { tagName: 'DIV', isContentEditable: false });
    expect(detector.isInputFocused()).toBe(false);
  });

  it('should clear focus on focusout', () => {
    fireEvent('focusin', { tagName: 'INPUT', isContentEditable: false });
    expect(detector.isInputFocused()).toBe(true);
    fireEvent('focusout');
    expect(detector.isInputFocused()).toBe(false);
  });
});
