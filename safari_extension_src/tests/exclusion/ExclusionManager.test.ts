import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExclusionManager } from '../../src/content/exclusion/ExclusionManager';

vi.stubGlobal('window', {
  location: { hostname: 'example.com' },
  top: null as any,
  getComputedStyle: vi.fn().mockReturnValue({
    overflowX: 'visible',
    touchAction: 'auto',
  }),
});

// Make window.top === window for non-iframe
(window as any).top = window;

describe('ExclusionManager', () => {
  let manager: ExclusionManager;

  beforeEach(() => {
    (window.location as any).hostname = 'example.com';
    manager = new ExclusionManager();
  });

  it('should not exclude normal websites', () => {
    expect(manager.shouldExclude()).toBe(false);
  });

  it('should exclude builtin domains', () => {
    (window.location as any).hostname = 'maps.google.com';
    manager = new ExclusionManager();
    expect(manager.shouldExclude()).toBe(true);
  });

  it('should exclude figma.com', () => {
    (window.location as any).hostname = 'www.figma.com';
    manager = new ExclusionManager();
    expect(manager.shouldExclude()).toBe(true);
  });

  it('should exclude user-defined domains', () => {
    (window.location as any).hostname = 'myapp.example.com';
    manager = new ExclusionManager(['myapp.example.com']);
    expect(manager.shouldExclude()).toBe(true);
  });

  it('should detect iframe', () => {
    const originalTop = window.top;
    (window as any).top = {} as any; // Different from window
    manager = new ExclusionManager();
    expect(manager.isInsideIframe()).toBe(true);
    (window as any).top = originalTop;
  });

  it('should check site-specific gesture rules', () => {
    (window.location as any).hostname = 'youtube.com';
    manager = new ExclusionManager([], { 'youtube.com': ['SWIPE_BACK'] });
    expect(manager.isGestureDisabledForSite('SWIPE_BACK')).toBe(true);
    expect(manager.isGestureDisabledForSite('V_SHAPE')).toBe(false);
  });

  it('should update user exclusions', () => {
    manager.updateUserExclusions(['custom-site.com']);
    (window.location as any).hostname = 'custom-site.com';
    manager = new ExclusionManager(['custom-site.com']);
    expect(manager.shouldExclude()).toBe(true);
  });

  it('should update site rules', () => {
    manager.updateSiteRules({ 'example.com': ['LONG_PRESS'] });
    expect(manager.isGestureDisabledForSite('LONG_PRESS')).toBe(true);
  });
});
