export class ExclusionManager {
  private excludedDomains: string[] = [
    'maps.google.com',
    'docs.google.com',
    'figma.com',
  ];

  shouldExclude(): boolean {
    return this.isDomainExcluded() || this.isInsideIframe();
  }

  isOverflowX(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.overflowX === 'scroll' || style.overflowX === 'auto';
  }

  isInsideIframe(): boolean {
    return window !== window.top;
  }

  private isDomainExcluded(): boolean {
    const hostname = window.location.hostname;
    return this.excludedDomains.some(domain => hostname.includes(domain));
  }
}
