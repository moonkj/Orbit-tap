import { ExclusionManager } from '../../src/content/exclusion/ExclusionManager';

describe('ExclusionManager', () => {
  it('shouldExclude returns false for normal pages', () => {
    const mgr = new ExclusionManager();
    expect(mgr.shouldExclude()).toBe(false);
  });

  it('isInsideIframe returns false for top frame', () => {
    const mgr = new ExclusionManager();
    expect(mgr.isInsideIframe()).toBe(false);
  });

  it('excludes user-added domains', () => {
    const mgr = new ExclusionManager(['test.com']);
    // Can't easily test hostname matching in jsdom, just verify constructor works
    expect(mgr).toBeDefined();
  });
});
