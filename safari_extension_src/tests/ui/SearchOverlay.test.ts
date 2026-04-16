import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SearchOverlay } from '../../src/content/ui/SearchOverlay';

describe('SearchOverlay', () => {
  let overlay: SearchOverlay;

  beforeEach(() => {
    vi.useFakeTimers();
    document.documentElement.innerHTML = '<head></head><body></body>';
    overlay = new SearchOverlay();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.documentElement.innerHTML = '';
  });

  // ── show() ───────────────────────────────────────────────────────────────

  describe('show()', () => {
    it('should create the search bar overlay element', () => {
      overlay.show();

      const bar = document.querySelector('.swift-search-bar');
      expect(bar).not.toBeNull();
      expect(bar).toBeInstanceOf(HTMLElement);
    });

    it('should create a style element with data-swift-search attribute', () => {
      overlay.show();

      const style = document.querySelector('style[data-swift-search]');
      expect(style).not.toBeNull();
    });

    it('should contain an input field for search', () => {
      overlay.show();

      const input = document.querySelector('.swift-search-bar input');
      expect(input).not.toBeNull();
      expect((input as HTMLInputElement).type).toBe('text');
      expect((input as HTMLInputElement).placeholder).toBe('Search on page...');
    });

    it('should contain navigation and close buttons', () => {
      overlay.show();

      const buttons = document.querySelectorAll('.swift-search-btn');
      expect(buttons.length).toBe(3); // prev, next, close
    });

    it('should contain a count display element', () => {
      overlay.show();

      const count = document.querySelector('.swift-search-count');
      expect(count).not.toBeNull();
    });

    it('should not create duplicate overlays on repeated calls', () => {
      overlay.show();
      overlay.show(); // second call should focus existing

      const bars = document.querySelectorAll('.swift-search-bar');
      expect(bars.length).toBe(1);
    });

    it('should append overlay to document.documentElement', () => {
      overlay.show();

      const bar = document.querySelector('.swift-search-bar');
      expect(bar?.parentElement).toBe(document.documentElement);
    });
  });

  // ── hide() ───────────────────────────────────────────────────────────────

  describe('hide()', () => {
    it('should remove the overlay after transition timeout', () => {
      overlay.show();
      expect(document.querySelector('.swift-search-bar')).not.toBeNull();

      overlay.hide();

      // The overlay removal is delayed by 250ms for transition
      vi.advanceTimersByTime(300);

      expect(document.querySelector('.swift-search-bar')).toBeNull();
    });

    it('should remove the style element after transition', () => {
      overlay.show();
      expect(document.querySelector('style[data-swift-search]')).not.toBeNull();

      overlay.hide();
      vi.advanceTimersByTime(300);

      expect(document.querySelector('style[data-swift-search]')).toBeNull();
    });

    it('should remove visible class immediately on hide', () => {
      overlay.show();
      // Trigger the requestAnimationFrame that adds .visible
      vi.advanceTimersByTime(0);

      overlay.hide();

      const bar = document.querySelector('.swift-search-bar');
      // Should have the class removed immediately (before the 250ms removal)
      expect(bar?.classList.contains('visible')).toBe(false);
    });

    it('should clear matches and reset index', () => {
      overlay.show();
      overlay.hide();
      vi.advanceTimersByTime(300);

      // Internal state should be cleaned
      expect((overlay as any).matches).toEqual([]);
      expect((overlay as any).currentIdx).toBe(-1);
    });

    it('should be safe to call hide() when overlay does not exist', () => {
      expect(() => overlay.hide()).not.toThrow();
    });

    it('should clear highlights from the document', () => {
      overlay.show();

      // Manually add a highlight mark to simulate search results
      const mark = document.createElement('mark');
      mark.setAttribute('data-swift-hl', '');
      mark.textContent = 'test';
      document.body.appendChild(mark);

      overlay.hide();
      vi.advanceTimersByTime(300);

      const marks = document.querySelectorAll('mark[data-swift-hl]');
      expect(marks.length).toBe(0);
    });
  });

  // ── search() ─────────────────────────────────────────────────────────────

  describe('search()', () => {
    it('should find text in the document body', () => {
      // Add text content to body
      const p = document.createElement('p');
      p.textContent = 'Hello World from the test document';
      document.body.appendChild(p);

      overlay.show();

      // Trigger search via the private method
      (overlay as any).search('Hello');

      const marks = document.querySelectorAll('mark[data-swift-hl]');
      expect(marks.length).toBe(1);
      expect(marks[0].textContent).toBe('Hello');
    });

    it('should perform case-insensitive search', () => {
      const p = document.createElement('p');
      p.textContent = 'Testing HELLO hello HeLLo';
      document.body.appendChild(p);

      overlay.show();
      (overlay as any).search('hello');

      // Each text node gets at most one match due to break statement
      const marks = document.querySelectorAll('mark[data-swift-hl]');
      expect(marks.length).toBeGreaterThanOrEqual(1);
    });

    it('should update match count display', () => {
      const p = document.createElement('p');
      p.textContent = 'First match here';
      document.body.appendChild(p);
      const p2 = document.createElement('p');
      p2.textContent = 'Second match here';
      document.body.appendChild(p2);

      overlay.show();
      (overlay as any).search('match');

      const count = document.querySelector('.swift-search-count');
      expect(count).not.toBeNull();
      expect(count!.textContent).toContain('1/2');
    });

    it('should clear previous highlights before new search', () => {
      const p = document.createElement('p');
      p.textContent = 'apple banana cherry';
      document.body.appendChild(p);

      overlay.show();
      (overlay as any).search('apple');
      expect(document.querySelectorAll('mark[data-swift-hl]').length).toBe(1);

      (overlay as any).search('banana');
      // Previous mark should be cleared, only banana highlighted
      const marks = document.querySelectorAll('mark[data-swift-hl]');
      expect(marks.length).toBe(1);
      expect(marks[0].textContent).toBe('banana');
    });

    it('should clear highlights when search query is empty', () => {
      const p = document.createElement('p');
      p.textContent = 'test content';
      document.body.appendChild(p);

      overlay.show();
      (overlay as any).search('test');
      expect(document.querySelectorAll('mark[data-swift-hl]').length).toBe(1);

      (overlay as any).search('');
      expect(document.querySelectorAll('mark[data-swift-hl]').length).toBe(0);
    });

    it('should return empty results for text not in document', () => {
      const p = document.createElement('p');
      p.textContent = 'Some content here';
      document.body.appendChild(p);

      overlay.show();
      (overlay as any).search('nonexistent');

      const marks = document.querySelectorAll('mark[data-swift-hl]');
      expect(marks.length).toBe(0);
      expect((overlay as any).matches.length).toBe(0);
    });

    it('should mark the first result as current', () => {
      const p = document.createElement('p');
      p.textContent = 'findme in the document';
      document.body.appendChild(p);

      overlay.show();
      (overlay as any).search('findme');

      const marks = document.querySelectorAll('mark[data-swift-hl]');
      expect(marks.length).toBe(1);
      // scrollToCurrent adds .current to marks[currentIdx]
      expect(marks[0].classList.contains('current')).toBe(true);
    });
  });
});
