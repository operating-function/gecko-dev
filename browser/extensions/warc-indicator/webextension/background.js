// Update the sidebar badge/icon
browser.sidebarAction.setTitle({
  title: hasWarc ? "WARC Archive Available" : "No WARC Available",
  tabId: tabId,
});

// Send status to sidebar if it's open
browser.runtime.sendMessage({
  type: "warc-status-update",
  hasWarc,
  url,
});
