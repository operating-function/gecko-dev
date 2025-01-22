/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

async function init() {
  // Get initial state
  try {
    const peers = await browser.runtime.sendMessage({ type: "get-peers" });
    displayPeers(peers);
  } catch (error) {
    console.error("Error fetching initial peers:", error);
    showError(error);
  }

  // Listen for updates
  browser.runtime.onMessage.addListener(message => {
    if (message.type === "peers-updated") {
      console.log('got "peers-updated"');
      displayPeers(message.peers);
    }
  });
}

function displayPeers(peers) {
  const peerList = document.getElementById("peer-list");
  peerList.innerHTML = "";

  if (!peers || peers.length === 0) {
    peerList.innerHTML = '<div class="no-peers">No peers found</div>';
    return;
  }

  console.log("here them peers ", { peers });

  peers.forEach(peer => {
    const peerElement = document.createElement("div");
    peerElement.className = "peer-item";

    peerElement.innerHTML = `
      <div class="peer-name">${escapeHtml(peer.name)}</div>
      <div class="peer-ip">${escapeHtml(peer.ip_address)}</div>
      <div class="peer-key">${escapeHtml(peer.public_key)}</div>
    `;

    console.log("peerEl ", { peerElement });
    peerList.appendChild(peerElement);
  });
}

function showError(error) {
  document.getElementById("peer-list").innerHTML =
    `<div class="error">Error loading peer data: ${error.message}</div>`;
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize when the panel loads
init();
