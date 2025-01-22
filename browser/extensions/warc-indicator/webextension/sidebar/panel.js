import { WarcChecker } from "/background/warcChecker.js";

console.log("warc playback sidebar: panel.js loaded");

const warcChecker = new WarcChecker();
const statusIcon = document.getElementById("status-icon");
const statusText = document.getElementById("status-text");
const viewWarcButton = document.getElementById("view-warc");

let currentUrl = null;
let currentTabId = null;

async function updateStatus(url) {
  console.log("sidebar: updateStatus called for", url);

  if (!url || url === "about:blank") {
    statusIcon.className = "";
    statusText.textContent = "No page loaded";
    viewWarcButton.disabled = true;
    return;
  }

  currentUrl = url;
  statusText.textContent = "Checking WARC availability...";
  viewWarcButton.disabled = true;

  try {
    const hasWarc = await warcChecker.checkAvailability(url);
    console.log("sidebar: WARC availability:", hasWarc);

    statusIcon.className = hasWarc ? "available" : "unavailable";

    if (url.startsWith(warcChecker.pywbEndpoint)) {
      statusText.textContent = "Viewing archived version";
      viewWarcButton.textContent = "View Live Version";
      viewWarcButton.disabled = false;
    } else {
      statusText.textContent = hasWarc
        ? "WARC archive available!"
        : "No WARC archive available";
      viewWarcButton.textContent = "View Archived Version";
      viewWarcButton.disabled = !hasWarc;
    }
  } catch (err) {
    console.error("sidebar: Error checking WARC status:", err);
    statusIcon.className = "unavailable";
    statusText.textContent = "Error checking WARC status";
    viewWarcButton.disabled = true;
  }
}

// Listen for tab changes
browser.tabs.onActivated.addListener(async activeInfo => {
  console.log("sidebar: tab activated");
  currentTabId = activeInfo.tabId;
  const tab = await browser.tabs.get(activeInfo.tabId);
  updateStatus(tab.url);
});

browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tabId === currentTabId) {
    console.log("sidebar: tab updated");
    updateStatus(changeInfo.url);
  }
});

// Handle button click to toggle WARC mode
viewWarcButton.addEventListener("click", async () => {
  if (!currentUrl || !currentTabId) return;

  const tab = await browser.tabs.get(currentTabId);
  if (tab.url.startsWith(warcChecker.pywbEndpoint)) {
    // Switch to live version
    console.log("sidebar: switching to live version from", tab.url);
    // Extract original URL from pywb replay URL
    const match = tab.url.match(
      /^http:\/\/localhost:8080\/local\/(?:\d+|mp_)\/(.+)$/
    );
    const originalUrl = match ? match[1] : null;
    console.log("sidebar: extracted original URL:", originalUrl);
    console.log("sidebar: original URL is", originalUrl);
    await browser.tabs.update(currentTabId, { url: originalUrl });
  } else {
    // Switch to archived version
    const proxyUrl = warcChecker.getProxyUrl(currentUrl);
    await browser.tabs.update(currentTabId, { url: proxyUrl });
  }
});

// Initial status check
browser.tabs.query({ active: true, currentWindow: true }).then(tabs => {
  console.log("sidebar: initial status check");
  if (tabs[0]) {
    currentTabId = tabs[0].id;
    updateStatus(tabs[0].url);
  }
});

// Listen for status updates from background script
browser.runtime.onMessage.addListener(message => {
  console.log("sidebar: received message", message);
  if (message.type === "warc-status-update") {
    updateStatus(message.url);
  }
});
