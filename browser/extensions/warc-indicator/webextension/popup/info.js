document.addEventListener("DOMContentLoaded", async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  const statusDiv = document.getElementById("status");
  const capturesDiv = document.getElementById("captures");

  if (currentTab.url.startsWith("http://localhost:8080")) {
    statusDiv.textContent = "Currently viewing archived version";
    const originalUrl = currentTab.url.split("/mp_/")[1];
    capturesDiv.textContent = `Original URL: ${originalUrl}`;
  } else {
    try {
      const cdxEndpoint = `http://localhost:8080/local/cdx?url=${encodeURIComponent(currentTab.url)}`;
      const response = await fetch(cdxEndpoint);
      const cdxData = await response.text();

      if (cdxData.trim().length > 0) {
        statusDiv.textContent = "WARC archive available";
        capturesDiv.textContent =
          "Click the toolbar icon to view archived version";
      } else {
        statusDiv.textContent = "No WARC archive available";
        capturesDiv.textContent = "This page has not been archived";
      }
    } catch (error) {
      statusDiv.textContent = "Error checking WARC availability";
      capturesDiv.textContent = "Unable to connect to archive server";
    }
  }
});
