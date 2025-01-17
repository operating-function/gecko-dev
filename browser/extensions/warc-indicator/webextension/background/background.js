console.log("background.js loaded");
import { WarcChecker } from "./warcChecker.js";

const warcChecker = new WarcChecker();

// Track which tabs are in WARC mode
const warcModeTabs = new Set();

async function updateIcon(tabId, url) {
  if (!url || url.startsWith(warcChecker.pywbEndpoint)) {
    return;
  }

  const hasWarc = await warcChecker.checkAvailability(url);

  browser.browserAction.setIcon({
    path: {
      19: `icons/${hasWarc ? "available" : "inactive"}-19.png`,
      38: `icons/${hasWarc ? "available" : "inactive"}-38.png`,
    },
    tabId: tabId,
  });

  browser.browserAction.setTitle({
    title: hasWarc ? "Click to view archived version" : "No WARC available",
    tabId: tabId,
  });
}

// Listen for tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    updateIcon(tabId, tab.url);
  }
});

// Handle toolbar button clicks
browser.browserAction.onClicked.addListener(async tab => {
  if (tab.url.startsWith(warcChecker.pywbEndpoint)) {
    // We're in WARC mode, get original URL
    const originalUrl = tab.url.split("/mp_/")[1];
    await browser.tabs.update(tab.id, { url: originalUrl });
    warcModeTabs.delete(tab.id);
  } else {
    // We're in live mode, check WARC availability
    const hasWarc = await warcChecker.checkAvailability(tab.url);
    if (hasWarc) {
      console.log("WARC available, switching to proxy URL");
      const proxyUrl = warcChecker.getProxyUrl(tab.url);
      console.log("Proxy URL:", proxyUrl);
      await browser.tabs.update(tab.id, { url: proxyUrl });
      warcModeTabs.add(tab.id);
    } else {
      console.log("No WARC available");
    }
  }
});

// Handle keyboard shortcut
browser.commands.onCommand.addListener(async command => {
  if (command === "toggle-warc") {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs[0]) {
      browser.browserAction.onClicked.trigger(tabs[0]);
    }
  }
});

// Clear cache periodically
setInterval(
  () => {
    warcChecker.clearCache();
  },
  30 * 60 * 1000
); // Every 30 minutes
