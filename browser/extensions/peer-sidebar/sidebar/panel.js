async function fetchPeers() {
  try {
    const response = await fetch("http://localhost:8000/users");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const peers = await response.json();
    displayPeers(peers);
  } catch (error) {
    console.error("Error fetching peers:", error);
    document.getElementById("peer-list").innerHTML =
      `<div class="error">Error loading peer data: ${error.message}</div>`;
  }
}

function displayPeers(peers) {
  const peerList = document.getElementById("peer-list");
  peerList.innerHTML = "";

  peers.forEach(peer => {
    const peerElement = document.createElement("div");
    peerElement.className = "peer-item";

    peerElement.innerHTML = `
      <div class="peer-name">${escapeHtml(peer.name)}</div>
      <div class="peer-ip">${escapeHtml(peer.ip_address)}</div>
      <div class="peer-key">${escapeHtml(peer.public_key)}</div>
    `;

    peerList.appendChild(peerElement);
  });
}

function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Fetch peers immediately and refresh every 30 seconds
fetchPeers();
setInterval(fetchPeers, 30000);
