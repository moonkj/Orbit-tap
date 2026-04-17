(function () {
    'use strict';

    const MAX_CLOSED_TABS = 20;
    let closedTabs = [];
    // Initialize from storage
    async function init() {
        const stored = await browser.storage.local.get(['closedTabs', 'gestureStats']);
        if (stored.closedTabs) {
            closedTabs = stored.closedTabs;
        }
    }
    init();
    browser.runtime.onMessage.addListener((message, sender) => {
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
    async function handleNavigation(direction, sender) {
        try {
            const tabId = sender?.tab?.id;
            if (!tabId) {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                if (tabs.length === 0)
                    return { success: false };
                const id = tabs[0].id;
                direction === 'back' ? await browser.tabs.goBack(id) : await browser.tabs.goForward(id);
            }
            else {
                direction === 'back' ? await browser.tabs.goBack(tabId) : await browser.tabs.goForward(tabId);
            }
            return { success: true };
        }
        catch {
            return { success: false };
        }
    }
    async function handleCloseTab(sender) {
        try {
            const tabId = sender?.tab?.id;
            let tab;
            if (tabId) {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                tab = tabs.find((t) => t.id === tabId) ?? tabs[0];
            }
            else {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                tab = tabs[0];
            }
            if (!tab?.id)
                return { success: false };
            closedTabs.unshift({
                url: tab.url ?? '',
                title: tab.title ?? '',
                closedAt: Date.now(),
            });
            if (closedTabs.length > MAX_CLOSED_TABS)
                closedTabs.pop();
            // Persist to storage
            await browser.storage.local.set({ closedTabs });
            await browser.tabs.remove(tab.id);
            return { success: true };
        }
        catch {
            return { success: false };
        }
    }
    async function handleGetSubscription() {
        // chrome.runtime.sendNativeMessage 시도 (Manifest V3 background)
        const g = globalThis;
        // chrome API만 사용 (ShieldMail 패턴)
        const sendNative = g.chrome?.runtime?.sendNativeMessage;
        if (typeof sendNative === 'function') {
            try {
                const result = await Promise.race([
                    sendNative('com.shadowengine.app', { action: 'getSubscriptionStatus' }),
                    new Promise((_, reject) => setTimeout(() => reject('timeout'), 3000))
                ]);
                const isActive = result?.isActive === true || result?.tier === 'pro';
                const debugRaw = result ? JSON.stringify(result).slice(0, 200) : 'undefined';
                await browser.storage.local.set({ subscriptionActive: isActive, subscriptionDebug: { src: 'ok', active: isActive, type: typeof result, raw: debugRaw } });
                return { isActive };
            }
            catch (e) {
                await browser.storage.local.set({ subscriptionDebug: { src: 'err', err: String(e) } });
            }
        }
        else {
            await browser.storage.local.set({ subscriptionDebug: { src: 'no_api' } });
        }
        // fallback: storage
        try {
            const stored = await browser.storage.local.get('subscriptionActive');
            return { isActive: stored?.subscriptionActive === true };
        }
        catch {
            return { isActive: false };
        }
    }
    // 시작 시 구독 확인
    handleGetSubscription().catch(() => { });
    async function handleSaveConfig(swiftSettings, gestureConfig) {
        try {
            await browser.storage.local.set({ swiftSettings, gestureConfig });
            // Broadcast to active tab content script
            try {
                const tabs = await browser.tabs.query({ active: true, currentWindow: true });
                if (tabs?.[0]?.id) {
                    browser.tabs.sendMessage(tabs[0].id, {
                        action: 'configUpdated',
                        config: gestureConfig
                    }).catch(() => { });
                }
            }
            catch { }
            return { success: true };
        }
        catch {
            return { success: false };
        }
    }
    async function handleNewTab() {
        try {
            await browser.tabs.create({ active: true });
            return { success: true };
        }
        catch {
            return { success: false };
        }
    }
    async function handleClearSiteData(sender) {
        try {
            const tabId = sender?.tab?.id;
            const targetId = tabId ?? (await browser.tabs.query({ active: true, currentWindow: true }))[0]?.id;
            if (targetId) {
                await browser.tabs.reload(targetId, { bypassCache: true });
            }
            return { success: true };
        }
        catch {
            return { success: false };
        }
    }
    async function handleGetConfig() {
        try {
            const stored = await browser.storage.local.get('gestureConfig');
            return stored.gestureConfig ?? {};
        }
        catch {
            return {};
        }
    }

})();
