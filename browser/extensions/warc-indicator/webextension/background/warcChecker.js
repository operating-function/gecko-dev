console.log("warcChecker.js loaded");
// TODO: collection name ("local") should be a var.
export class WarcChecker {
  constructor() {
    this.cache = new Map();
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    this.pywbEndpoint = "http://localhost:8080";
  }

  async checkAvailability(url) {
    console.log("checking ", url);
    const cached = this.getCached(url);
    if (cached !== null) {
      return cached;
    }

    try {
      const cdxEndpoint = `${this.pywbEndpoint}/local/cdx?url=${encodeURIComponent(url)}`;
      const response = await fetch(cdxEndpoint);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const cdxData = await response.text();
      const available = cdxData.trim().length > 0;

      this.setCached(url, available);
      return available;
    } catch (error) {
      console.error("Error checking WARC availability:", error);
      return false;
    }
  }

  getCached(url) {
    console.log("getCached ", url);
    const now = Date.now();
    const cached = this.cache.get(url);

    if (cached && now - cached.timestamp < this.CACHE_DURATION) {
      return cached.available;
    }

    return null;
  }

  setCached(url, available) {
    console.log("setCached ", url);
    this.cache.set(url, {
      available,
      timestamp: Date.now(),
    });
  }

  clearCache() {
    console.log("clearCache ");
    this.cache.clear();
  }

  getProxyUrl(originalUrl) {
    console.log("getProxyUrl ", originalUrl);
    return `${this.pywbEndpoint}/local/mp_/${originalUrl}`;
  }
}
