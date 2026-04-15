(function () {
    'use strict';

    const closedTabs = [];
    const MAX_CLOSED_TABS = 20;
    browser.runtime.onMessage.addListener((message, _sender) => {
        switch (message.action) {
            case 'navigate':
                return handleNavigation(message.direction);
            case 'closeTab':
                return handleCloseTab();
            case 'restoreTab':
                return handleRestoreTab();
            default:
                return Promise.resolve({ success: false, error: 'Unknown action' });
        }
    });
    async function handleNavigation(direction) {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0)
            return { success: false };
        const tabId = tabs[0].id;
        if (direction === 'back') {
            await browser.tabs.goBack(tabId);
        }
        else {
            await browser.tabs.goForward(tabId);
        }
        return { success: true };
    }
    async function handleCloseTab() {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0)
            return { success: false };
        const tab = tabs[0];
        closedTabs.unshift({
            url: tab.url ?? '',
            title: tab.title ?? '',
            closedAt: Date.now(),
        });
        if (closedTabs.length > MAX_CLOSED_TABS) {
            closedTabs.pop();
        }
        await browser.tabs.remove(tab.id);
        return { success: true };
    }
    async function handleRestoreTab() {
        const tab = closedTabs.shift();
        if (!tab)
            return { success: false };
        await browser.tabs.create({ url: tab.url, active: true });
        return { success: true };
    }

})();
