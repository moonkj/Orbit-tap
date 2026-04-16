interface ClosedTab {
  url: string;
  title: string;
  closedAt: number;
}

interface GestureStats {
  totalGestures: number;
  gestureCount: Record<string, number>;
  lastUpdated: number;
}

const MAX_CLOSED_TABS = 20;
let closedTabs: ClosedTab[] = [];
let subscriptionCache: { isActive: boolean; checkedAt: number } | null = null;
const SUBSCRIPTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Initialize from storage
async function init(): Promise<void> {
  const stored = await browser.storage.local.get(['closedTabs', 'gestureStats']);
  if (stored.closedTabs) {
    closedTabs = stored.closedTabs;
  }
}

init();

browser.runtime.onMessage.addListener((message: any, sender: any) => {
  // 보안: extension 내부 메시지만 허용 (외부 웹페이지 차단)
  const isInternal = !sender.tab || sender.url?.startsWith('safari-web-extension://');
  const isContentScript = sender.tab && sender.tab.id;

  if (!isInternal && !isContentScript) {
    return Promise.resolve({ success: false, error: 'Unauthorized' });
  }

  switch (message.action) {
    case 'navigate':
      return handleNavigation(message.direction, sender);
    case 'closeTab':
      return handleCloseTab(sender);
    case 'getSubscriptionStatus':
      return handleGetSubscription();
    case 'getConfig':
      return handleGetConfig();
    case 'saveConfig':
      return handleSaveConfig(message.swiftSettings, message.gestureConfig);
    case 'newTab':
      return handleNewTab();
    case 'clearSiteData':
      return handleClearSiteData(sender);
    default:
      return Promise.resolve({ success: false, error: 'Unknown action' });
  }
});

async function handleNavigation(direction: 'back' | 'forward', sender: any): Promise<{ success: boolean }> {
  try {
    const tabId = sender?.tab?.id;
    if (!tabId) {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) return { success: false };
      const id = tabs[0].id!;
      direction === 'back' ? await browser.tabs.goBack(id) : await browser.tabs.goForward(id);
    } else {
      direction === 'back' ? await browser.tabs.goBack(tabId) : await browser.tabs.goForward(tabId);
    }
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function handleCloseTab(sender: any): Promise<{ success: boolean }> {
  try {
    const tabId = sender?.tab?.id;
    let tab: any;
    if (tabId) {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      tab = tabs.find((t: any) => t.id === tabId) ?? tabs[0];
    } else {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      tab = tabs[0];
    }
    if (!tab?.id) return { success: false };

    closedTabs.unshift({
      url: tab.url ?? '',
      title: tab.title ?? '',
      closedAt: Date.now(),
    });
    if (closedTabs.length > MAX_CLOSED_TABS) closedTabs.pop();

    // Persist to storage
    await browser.storage.local.set({ closedTabs });
    await browser.tabs.remove(tab.id);
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function handleRestoreTab(): Promise<{ success: boolean; url?: string }> {
  const tab = closedTabs.shift();
  if (!tab) return { success: false };

  try {
    await browser.storage.local.set({ closedTabs });
    await browser.tabs.create({ url: tab.url, active: true });
    return { success: true, url: tab.url };
  } catch {
    closedTabs.unshift(tab); // Restore on failure
    return { success: false };
  }
}

async function handleGetSubscription(): Promise<{ isActive: boolean }> {
  if (subscriptionCache && (Date.now() - subscriptionCache.checkedAt < SUBSCRIPTION_CACHE_TTL)) {
    return { isActive: subscriptionCache.isActive };
  }

  try {
    const result = await browser.runtime.sendNativeMessage('com.swift.app', { action: 'getSubscriptionStatus' });
    const isActive = result?.isActive === true;
    subscriptionCache = { isActive, checkedAt: Date.now() };
    return { isActive };
  } catch {
    return { isActive: subscriptionCache?.isActive ?? false };
  }
}

async function handleLogGesture(gestureType: string): Promise<{ success: boolean }> {
  try {
    const stored = await browser.storage.local.get('gestureStats');
    const stats: GestureStats = stored.gestureStats ?? {
      totalGestures: 0,
      gestureCount: {},
      lastUpdated: Date.now(),
    };

    stats.totalGestures++;
    stats.gestureCount[gestureType] = (stats.gestureCount[gestureType] ?? 0) + 1;
    stats.lastUpdated = Date.now();

    await browser.storage.local.set({ gestureStats: stats });
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function handleSaveConfig(swiftSettings: any, gestureConfig: any): Promise<{ success: boolean }> {
  try {
    await browser.storage.local.set({ swiftSettings, gestureConfig });
    // Broadcast to active tab content script
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs?.[0]?.id) {
        browser.tabs.sendMessage(tabs[0].id, {
          action: 'configUpdated',
          config: gestureConfig
        }).catch(() => {});
      }
    } catch {}
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function handleGetPopupSettings(): Promise<any> {
  try {
    const stored = await browser.storage.local.get('swiftSettings');
    return { swiftSettings: stored.swiftSettings ?? null };
  } catch {
    return { swiftSettings: null };
  }
}

async function handleNewTab(): Promise<{ success: boolean }> {
  try {
    await browser.tabs.create({ active: true });
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function handleClearSiteData(sender: any): Promise<{ success: boolean }> {
  try {
    const tabId = sender?.tab?.id;
    const targetId = tabId ?? (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;
    if (targetId) {
      await browser.tabs.reload(targetId, { bypassCache: true });
    }
    return { success: true };
  } catch {
    return { success: false };
  }
}

async function handleGetConfig(): Promise<any> {
  try {
    const stored = await browser.storage.local.get('gestureConfig');
    return stored.gestureConfig ?? {};
  } catch {
    return {};
  }
}
