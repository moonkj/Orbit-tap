import { IntentDetector } from '../../src/content/intent/IntentDetector';

describe('IntentDetector', () => {
  let detector: IntentDetector;
  beforeEach(() => { detector = new IntentDetector(); });
  afterEach(() => { detector.dispose(); });

  it('should detect input focus via focusin', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new Event('focusin', { bubbles: true }));
    expect(detector.isInputFocused()).toBe(true);
    document.body.removeChild(input);
  });

  it('should reset on focusout', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new Event('focusin', { bubbles: true }));
    input.dispatchEvent(new Event('focusout', { bubbles: true }));
    expect(detector.isInputFocused()).toBe(false);
    document.body.removeChild(input);
  });

  it('isInputFocused returns false by default', () => {
    expect(detector.isInputFocused()).toBe(false);
  });

  it('dispose stops listening', () => {
    detector.dispose();
    expect(detector.isInputFocused()).toBe(false);
  });
});
