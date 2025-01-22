/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let gPeers = [];
// const REFRESH_INTERVAL = 30000; // 30 seconds
const REFRESH_INTERVAL = 3000; // 3 seconds

// Handle messages from the sidebar panel
browser.runtime.onMessage.addListener((message, sender) => {
  switch (message.type) {
    case "get-peers":
      return Promise.resolve(gPeers);
    default:
      console.warn("Unknown message type:", message.type);
      return Promise.reject(new Error("Unknown message type"));
  }
});

async function fetchPeers() {
  try {
    const response = await fetch("http://localhost:8000/users", {});

    gPeers = await response.json();
    console.log("gPeers ", { gPeers });

    // Notify all sidebar instances of the update
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      try {
        console.log('sending "peers-updated"');
        browser.runtime.sendMessage({
          type: "peers-updated",
          peers: gPeers,
        });
      } catch (e) {
        // Ignore errors from tabs that can't receive the message
        console.debug("Could not send peers-updated to tab", tab.id, e);
      }
    }
  } catch (error) {
    // Suppress CORS errors in console
    if (!error.message.includes("CORS")) {
      console.error("Error fetching peers:", error);
    }
    // Keep the old peer list on error
  }
}

// Initialize polling when the background script starts
fetchPeers(); // Initial fetch
setInterval(fetchPeers, REFRESH_INTERVAL);
