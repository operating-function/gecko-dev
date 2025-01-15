"use strict";

/**
 * @typedef {import("./types").CustomSidebar.PeerData} PeerData
 */

const EXPORTED_SYMBOLS = ["PeerService"];

var PeerService = {
  /**
   * @param {string} url
   * @returns {Promise<PeerData[]>}
   */
  async lookupContent(url) {
    console.log("lookup content in peerservice ", { url });
    return true
  }
};
