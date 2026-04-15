export class IntentDetector {
  private _isScrolling = false;
  private _isInputFocused = false;
  private scrollTimer: number | null = null;
  private abortController: AbortController;

  constructor() {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    document.addEventListener('scroll', () => {
      this._isScrolling = true;
      if (this.scrollTimer) clearTimeout(this.scrollTimer);
      this.scrollTimer = window.setTimeout(() => {
        this._isScrolling = false;
      }, 150);
    }, { passive: true, signal });

    document.addEventListener('focusin', (e) => {
      const target = e.target as HTMLElement;
      this._isInputFocused = this.isEditableElement(target);
    }, { signal });

    document.addEventListener('focusout', () => {
      this._isInputFocused = false;
    }, { signal });
  }

  isScrolling(): boolean {
    return this._isScrolling;
  }

  isInputFocused(): boolean {
    return this._isInputFocused;
  }

  isIdle(): boolean {
    return !this._isScrolling && !this._isInputFocused;
  }

  dispose(): void {
    this.abortController.abort();
    if (this.scrollTimer) clearTimeout(this.scrollTimer);
  }

  private isEditableElement(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }
}
