/**
 * 페이지 내 텍스트 검색 오버레이 (Circle 제스처로 호출)
 */
export class SearchOverlay {
  private overlay: HTMLElement | null = null;
  private input: HTMLInputElement | null = null;
  private countEl: HTMLElement | null = null;
  private styleEl: HTMLStyleElement | null = null;
  private matches: Range[] = [];
  private currentIdx = -1;

  show(): void {
    if (this.overlay) { this.focus(); return; }

    this.styleEl = document.createElement('style');
    this.styleEl.setAttribute('data-swift-search', '1');
    this.styleEl.textContent = `
      .swift-search-bar {
        position: fixed; top: 0; left: 0; right: 0;
        z-index: 2147483645;
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px;
        background: rgba(28,28,30,0.92);
        -webkit-backdrop-filter: saturate(180%) blur(20px);
        backdrop-filter: saturate(180%) blur(20px);
        border-bottom: 0.5px solid rgba(255,255,255,0.1);
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        transform: translateY(-100%);
        transition: transform 0.25s cubic-bezier(0.2, 0.9, 0.3, 1);
      }
      .swift-search-bar.visible { transform: translateY(0); }
      .swift-search-bar input {
        flex: 1; border: none; outline: none;
        background: rgba(255,255,255,0.1);
        color: #fff; font-size: 15px;
        padding: 8px 12px; border-radius: 8px;
        -webkit-appearance: none;
      }
      .swift-search-bar input::placeholder { color: rgba(255,255,255,0.4); }
      .swift-search-count { color: rgba(255,255,255,0.5); font-size: 12px; min-width: 40px; text-align: center; }
      .swift-search-btn {
        background: none; border: none; color: rgba(255,255,255,0.7);
        font-size: 18px; padding: 4px 8px; cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      }
      mark[data-swift-hl] { background: rgba(255, 214, 10, 0.4); color: inherit; border-radius: 2px; }
      mark[data-swift-hl].current { background: rgba(255, 149, 0, 0.6); }
    `;
    document.head.appendChild(this.styleEl);

    this.overlay = document.createElement('div');
    this.overlay.className = 'swift-search-bar';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Search on page...';
    this.input.autocomplete = 'off';
    this.input.autocapitalize = 'off';

    this.countEl = document.createElement('span');
    this.countEl.className = 'swift-search-count';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'swift-search-btn';
    prevBtn.textContent = '▲';
    prevBtn.addEventListener('click', () => this.navigate(-1));

    const nextBtn = document.createElement('button');
    nextBtn.className = 'swift-search-btn';
    nextBtn.textContent = '▼';
    nextBtn.addEventListener('click', () => this.navigate(1));

    const closeBtn = document.createElement('button');
    closeBtn.className = 'swift-search-btn';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.hide());

    this.overlay.append(this.input, this.countEl, prevBtn, nextBtn, closeBtn);
    document.documentElement.appendChild(this.overlay);

    this.input.addEventListener('input', () => this.search(this.input!.value));

    requestAnimationFrame(() => {
      this.overlay?.classList.add('visible');
      this.input?.focus();
    });
  }

  hide(): void {
    this.clearHighlights();
    this.overlay?.classList.remove('visible');
    setTimeout(() => {
      this.overlay?.remove();
      this.styleEl?.remove();
      this.overlay = null;
      this.styleEl = null;
      this.input = null;
      this.countEl = null;
    }, 250);
    this.matches = [];
    this.currentIdx = -1;
  }

  private focus(): void {
    this.input?.focus();
    this.input?.select();
  }

  private search(query: string): void {
    this.clearHighlights();
    this.matches = [];
    this.currentIdx = -1;

    if (!query || query.length < 1) {
      this.updateCount();
      return;
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if ((node as Text).textContent?.toLowerCase().includes(query.toLowerCase())) {
        textNodes.push(node as Text);
      }
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent ?? '';
      const lowerText = text.toLowerCase();
      const lowerQuery = query.toLowerCase();
      let idx = 0;
      while ((idx = lowerText.indexOf(lowerQuery, idx)) !== -1) {
        const range = document.createRange();
        range.setStart(textNode, idx);
        range.setEnd(textNode, idx + query.length);
        this.matches.push(range);
        idx += query.length;
        break; // 같은 텍스트 노드에서 하나만 (분할 방지)
      }
    }

    // 하이라이트 적용
    for (const range of this.matches) {
      try {
        const mark = document.createElement('mark');
        mark.setAttribute('data-swift-hl', '');
        range.surroundContents(mark);
      } catch {}
    }

    if (this.matches.length > 0) {
      this.currentIdx = 0;
      this.scrollToCurrent();
    }
    this.updateCount();
  }

  private navigate(dir: number): void {
    if (this.matches.length === 0) return;
    const marks = document.querySelectorAll('mark[data-swift-hl]');
    marks.forEach(m => m.classList.remove('current'));

    this.currentIdx = (this.currentIdx + dir + this.matches.length) % this.matches.length;
    this.scrollToCurrent();
    this.updateCount();
  }

  private scrollToCurrent(): void {
    const marks = document.querySelectorAll('mark[data-swift-hl]');
    if (marks[this.currentIdx]) {
      marks[this.currentIdx].classList.add('current');
      marks[this.currentIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  private updateCount(): void {
    if (!this.countEl) return;
    if (this.matches.length === 0) {
      this.countEl.textContent = '';
    } else {
      this.countEl.textContent = `${this.currentIdx + 1}/${this.matches.length}`;
    }
  }

  private clearHighlights(): void {
    document.querySelectorAll('mark[data-swift-hl]').forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
        parent.normalize();
      }
    });
  }
}
