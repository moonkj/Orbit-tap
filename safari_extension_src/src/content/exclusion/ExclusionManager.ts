export class ExclusionManager {
  private builtinExcludedDomains: string[] = [
    'maps.google.com',
    'docs.google.com',
    'sheets.google.com',
    'slides.google.com',
    'figma.com',
    'canva.com',
    'codepen.io',
  ];
  private userExcludedDomains: string[] = [];
  private siteDisabledGestures: Record<string, string[]> = {};

  constructor(userExclusions?: string[], siteRules?: Record<string, string[]>) {
    if (userExclusions) this.userExcludedDomains = userExclusions;
    if (siteRules) this.siteDisabledGestures = siteRules;
  }

  shouldExclude(): boolean {
    return this.isDomainExcluded() || this.isInsideIframe();
  }

  isGestureDisabledForSite(gestureType: string): boolean {
    const hostname = window.location.hostname;
    for (const [domain, gestures] of Object.entries(this.siteDisabledGestures)) {
      if (hostname.includes(domain) && gestures.includes(gestureType)) {
        return true;
      }
    }
    return false;
  }

  shouldExcludeAtPoint(x: number, y: number): boolean {
    const element = document.elementFromPoint(x, y);
    if (!element) return false;

    // Check overflow-x scrollable containers
    if (this.isHorizontallyScrollable(element as HTMLElement)) return true;

    // Check CSS touch-action
    const touchAction = window.getComputedStyle(element).touchAction;
    if (touchAction === 'pan-x' || touchAction === 'manipulation') return true;

    // Check if inside canvas or video (interactive media)
    if (this.isInteractiveMedia(element)) return true;

    return false;
  }

  isInsideIframe(): boolean {
    try {
      return window !== window.top;
    } catch {
      return true; // Cross-origin iframe
    }
  }

  updateUserExclusions(domains: string[]): void {
    this.userExcludedDomains = domains;
  }

  updateSiteRules(rules: Record<string, string[]>): void {
    this.siteDisabledGestures = rules;
  }

  private isDomainExcluded(): boolean {
    const hostname = window.location.hostname;
    const allExcluded = [...this.builtinExcludedDomains, ...this.userExcludedDomains];
    return allExcluded.some(domain => hostname.includes(domain));
  }

  private isHorizontallyScrollable(element: HTMLElement): boolean {
    let el: HTMLElement | null = element;
    while (el && el !== document.documentElement) {
      const style = window.getComputedStyle(el);
      if (
        (style.overflowX === 'scroll' || style.overflowX === 'auto') &&
        el.scrollWidth > el.clientWidth
      ) {
        return true;
      }
      el = el.parentElement;
    }
    return false;
  }

  private isInteractiveMedia(element: Element): boolean {
    const tag = element.tagName.toLowerCase();
    return tag === 'canvas' || tag === 'video' || tag === 'svg';
  }
}
