export class IntentDetector {
  private _isInputFocused = false;
  private abortController: AbortController;

  constructor() {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      this._isInputFocused = this.isEditableElement(target);
    }, { signal });

    document.addEventListener('focusout', () => {
      this._isInputFocused = false;
    }, { signal });
  }

  isInputFocused(): boolean {
    return this._isInputFocused;
  }

  dispose(): void {
    this.abortController.abort();
  }

  private isEditableElement(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }
}
