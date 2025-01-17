console.log("background.js loaded");
import { WarcChecker } from "./warcChecker.js";

const warcChecker = new WarcChecker();

// Track which tabs are in WARC mode
const warcModeTabs = new Set();

async function updateStatus(tabId, url) {
  console.log("background: updateStatus called for", url);

  if (!url || url.startsWith(warcChecker.pywbEndpoint)) {
    return;
  }

  const hasWarc = await warcChecker.checkAvailability(url);
  console.log("background: WARC availability:", hasWarc);

  // Send status to sidebar if it's open
  browser.runtime
    .sendMessage({
      type: "warc-status-update",
      hasWarc,
      url,
      isWarcMode: warcModeTabs.has(tabId),
    })
    .catch(err => {
      // This error is expected if sidebar isn't open
      console.log(
        "background: couldn't send message (sidebar probably not open)"
      );
    });
}

// Listen for tab updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    console.log("background: tab updated, checking", tab.url);
    updateStatus(tabId, tab.url);
  }
});

// Handle toggle between live and WARC mode
async function toggleWarcMode(tab) {
  if (tab.url.startsWith(warcChecker.pywbEndpoint)) {
    // We're in WARC mode, get original URL
    const originalUrl = tab.url.split("/mp_/")[1];
    await browser.tabs.update(tab.id, { url: originalUrl });
    warcModeTabs.delete(tab.id);
  } else {
    // We're in live mode, check WARC availability
    const hasWarc = await warcChecker.checkAvailability(tab.url);
    if (hasWarc) {
      console.log("background: WARC available, switching to proxy URL");
      const proxyUrl = warcChecker.getProxyUrl(tab.url);
      console.log("background: Proxy URL:", proxyUrl);
      await browser.tabs.update(tab.id, { url: proxyUrl });
      warcModeTabs.add(tab.id);
    } else {
      console.log("background: No WARC available");
    }
  }
}

// Handle keyboard shortcut
browser.commands.onCommand.addListener(async command => {
  if (command === "toggle-warc") {
    const tabs = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tabs[0]) {
      await toggleWarcMode(tabs[0]);
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
