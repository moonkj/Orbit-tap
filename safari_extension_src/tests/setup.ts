// Browser API mock for vitest
const storageMock: Record<string, any> = {};

const browserMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        if (typeof keys === 'string') return { [keys]: storageMock[keys] };
        const result: Record<string, any> = {};
        (Array.isArray(keys) ? keys : [keys]).forEach(k => { if (storageMock[k] !== undefined) result[k] = storageMock[k]; });
        return result;
      }),
      set: vi.fn(async (data: Record<string, any>) => { Object.assign(storageMock, data); }),
    },
    onChanged: { addListener: vi.fn() },
  },
  runtime: {
    sendMessage: vi.fn(async () => ({})),
    sendNativeMessage: vi.fn(async () => ({})),
    onMessage: { addListener: vi.fn() },
  },
  tabs: {
    query: vi.fn(async () => [{ id: 1, url: 'https://example.com' }]),
    sendMessage: vi.fn(async () => ({})),
    create: vi.fn(async () => ({})),
    remove: vi.fn(async () => {}),
    reload: vi.fn(async () => {}),
    goBack: vi.fn(async () => {}),
    goForward: vi.fn(async () => {}),
  },
};

(globalThis as any).browser = browserMock;
(globalThis as any).__storageMock = storageMock;

// DOM mocks
(globalThis as any).document = globalThis.document ?? {};
(globalThis as any).window = globalThis.window ?? { innerWidth: 375, innerHeight: 812 };
(globalThis as any).performance = globalThis.performance ?? { now: () => Date.now() };
(globalThis as any).requestAnimationFrame = (cb: Function) => setTimeout(cb, 0);
(globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);

// jsdom missing APIs
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

export { browserMock, storageMock };
