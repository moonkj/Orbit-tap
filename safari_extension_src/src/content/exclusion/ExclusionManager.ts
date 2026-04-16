export class ExclusionManager {
  private builtinExcludedDomains: string[] = [];
  private userExcludedDomains: string[] = [];

  constructor(userExclusions?: string[]) {
    if (userExclusions) this.userExcludedDomains = userExclusions;
  }

  shouldExclude(): boolean {
    return this.isDomainExcluded() || this.isInsideIframe();
  }

  isInsideIframe(): boolean {
    try {
      return window !== window.top;
    } catch {
      return true;
    }
  }

  private isDomainExcluded(): boolean {
    const hostname = window.location.hostname;
    const allExcluded = [...this.builtinExcludedDomains, ...this.userExcludedDomains];
    return allExcluded.some(domain => hostname.includes(domain));
  }
}
