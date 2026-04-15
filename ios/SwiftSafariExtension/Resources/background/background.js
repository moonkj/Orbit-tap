(function () {
    'use strict';

    const MAX_CLOSED_TABS = 20;
    let closedTabs = [];
    let subscriptionCache = null;
    const SUBSCRIPTION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    // Initialize from storage
    async function init() {
        const stored = await browser.storage.local.get(['closedTabs', 'gestureStats']);
        if (stored.closedTabs) {
            closedTabs = stored.closedTabs;
        }
    }
    init();
    browser.runtime.onMessage.addListener((message, sender) => {
        switch (message.action) {
            case 'navigate':
                return handleNavigation(message.direction, sender);
            case 'closeTab':
                return handleCloseTab(sender);
            case 'restoreTab':
                return handleRestoreTab();
            case 'getSubscriptionStatus':
                return handleGetSubscription();
            case 'logGesture':
                return handleLogGesture(message.gestureType);
            case 'getConfig':
                return handleGetConfig();
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
                const tabs = await browser.tabs.query({});
                tab = tabs.find(t => t.id === tabId);
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
    async function handleRestoreTab() {
        const tab = closedTabs.shift();
        if (!tab)
            return { success: false };
        try {
            await browser.storage.local.set({ closedTabs });
            await browser.tabs.create({ url: tab.url, active: true });
            return { success: true, url: tab.url };
        }
        catch {
            closedTabs.unshift(tab); // Restore on failure
            return { success: false };
        }
    }
    async function handleGetSubscription() {
        if (subscriptionCache && (Date.now() - subscriptionCache.checkedAt < SUBSCRIPTION_CACHE_TTL)) {
            return { isActive: subscriptionCache.isActive };
        }
        try {
            const result = await browser.runtime.sendNativeMessage('com.swift.app', { action: 'getSubscriptionStatus' });
            const isActive = result?.isActive === true;
            subscriptionCache = { isActive, checkedAt: Date.now() };
            return { isActive };
        }
        catch {
            return { isActive: subscriptionCache?.isActive ?? false };
        }
    }
    async function handleLogGesture(gestureType) {
        try {
            const stored = await browser.storage.local.get('gestureStats');
            const stats = stored.gestureStats ?? {
                totalGestures: 0,
                gestureCount: {},
                lastUpdated: Date.now(),
            };
            stats.totalGestures++;
            stats.gestureCount[gestureType] = (stats.gestureCount[gestureType] ?? 0) + 1;
            stats.lastUpdated = Date.now();
            await browser.storage.local.set({ gestureStats: stats });
            return { success: true };
        }
        catch {
            return { success: false };
        }
    }
    async function handleGetConfig() {
        try {
            const result = await browser.runtime.sendNativeMessage('com.swift.app', { action: 'getConfig' });
            // Cache in storage for offline access
            await browser.storage.local.set({ cachedConfig: result });
            return result;
        }
        catch {
            const stored = await browser.storage.local.get('cachedConfig');
            return stored.cachedConfig ?? {};
        }
    }

})();
