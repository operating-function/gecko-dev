browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only run this code when the tab has finished loading
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      // Show icon for all valid URLs
      if (tab.url.startsWith('http')) {
        console.log('Showing icon for page:', tab.url);
        browser.pageAction.show(tabId);
      } else {
        console.log('Hiding icon for invalid URL:', tab.url);
        browser.pageAction.hide(tabId);
      }
    } catch (e) {
      console.error('Error processing URL:', e);
      browser.pageAction.hide(tabId);
    }
  }
});

browser.pageAction.onClicked.addListener((tab) => {
  console.log("URL icon clicked in tab:", tab.id);
  // Example action: open the current page in a new tab
  browser.tabs.create({
    url: tab.url
  });
});
