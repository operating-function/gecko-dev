"use strict";

/**
 * @typedef {import("./types").CustomSidebar.TabState} TabState
 * @typedef {import("./types").CustomSidebar.PeerData} PeerData
 * @typedef {import("./types").CustomSidebar.ArchiveResult} ArchiveResult
 */

const Services = globalThis.Services || ChromeUtils.import("resource://gre/modules/Services.jsm").Services;

const EXPORTED_SYMBOLS = ["CustomSidebar"];

// const { PeerService } = ChromeUtils.import("resource:///customsidebar/PeerService.jsm")

var CustomSidebar = {
  /** @type {Map<number, TabState>} */
  _tabStates: new Map(),

  /**
   * @param {Window} window - The browser window
   * @returns {void}
   * @throws {Error} If window is invalid
   */

  // init(window) {
  //   console.log("CustomSidebar init");
  //   this._window = window;

  //   if (window.document.readyState === "complete") {
  //       this._initComplete();
  //   } else {
  //       window.addEventListener('load', () => {
  //           this._initComplete();
  //       }, { once: true });
  //   }
  // },

init(window) {
    console.log("CustomSidebar init", {
        hasWindow: !!window,
        readyState: window.document.readyState
    });
    
    this._window = window;
    // Get the main browser window through the sidebar window
    this._browserWindow = window.docShell.rootTreeItem.domWindow;

    this._window = window;
    this._browserWindow = window.docShell.rootTreeItem.domWindow;

  // Wait for both windows to be ready
  const waitForBrowser = new Promise(resolve => {
    if (this._browserWindow?.gBrowser) {
      resolve();
    } else {
      this._browserWindow.addEventListener('load', resolve, { once: true });
    }
  });

  const waitForSidebar = new Promise(resolve => {
    if (window.document.readyState === "complete") {
      resolve();
    } else {
      window.addEventListener('load', resolve, { once: true });
    }
  });

  Promise.all([waitForBrowser, waitForSidebar]).then(() => {
    console.log("all windows ready")
    this._initComplete();
  });

},


  _initGlobalFrameScript() {
    // This loads your frame script into all current and future browser tabs:
    console.log('loading frame script...')
    Services.mm.loadFrameScript("chrome://browser/content/customsidebar/customSidebarContent.js", true);
    console.log('loaded')
  },


  _initComplete() {
    console.log("CustomSidebar _initComplete");
    /// listeners for messages
    console.log('Do we have Services?', { Services })
    Services.mm.addMessageListener("CustomSidebar:Pong", this._onPong.bind(this));
    this._setupUI();
    this._initWorker();
    this._setupMessageHandlers();
    this._setupTabListeners();
    this._initGlobalFrameScript();
  },

  _onPong(message) {
    console.log("Received Pong from content script:", message.data);
  },

  _initWorker() {
    this._worker = new ChromeWorker("resource:///modules/CustomSidebarWorker.js");
    this._worker.onmessage = this._handleWorkerMessage.bind(this);
    this._worker.onerror = (error) => {
      console.error("worker error ", error)
    }
  },

  _handleWorkerMessage (msg) {
    console.log('handle worker message ', { msg })
  },

_setupMessageHandlers() {
    console.log("Setting up message handlers");


    if (this._browserWindow?.gBrowser?.selectedBrowser) {
        const mm = this._browserWindow.gBrowser.selectedBrowser.messageManager;

        console.log("Found browser, setting up message manager for url change ", this._browserWindow?.gBrowser?.selectedBrowser);
        const log = this._browserWindow?.gBrowser?.selectedBrowser
        console.log('as object ', { log })

        mm.addMessageListener("CustomSidebar:URLChanged", this._handleURLChange.bind(this));
        
        this._browserWindow.gBrowser.addTabsProgressListener({
            onLocationChange: (browser, progress, request, uri) => {
              console.log("location change ", { progress, request, uri });
                if (uri) {
                    // Create proper message object with browser as target
                    this._handleURLChange({
                        target: browser,
                        data: { url: uri.spec }
                    });
                }
            }
        });
    } else {
        console.log("Browser not ready for message handlers", {
            hasBrowser: !!this._browserWindow?.gBrowser,
            hasSelectedBrowser: !!this._browserWindow?.gBrowser?.selectedBrowser
        });
    }

    // Derprecated
    // Services.mm.addMessageListener("CustomSidebar:ArchiveRequest", (message) => {
    //   // TODO: this should be { url, timestamp }
    //   console.log("Got archive request in main", message);
    //   this._handleArchiveRequest(message);
    // });

    console.log("message handlers set up");
},

_setupTabListeners() {
    console.log("Setting up tab listeners");
  const tabbrowser = this._browserWindow.gBrowser;
  if (!tabbrowser) {
    console.error("No tabbrowser found!");
    return;
  }
  
  // Track new tabs
  tabbrowser.addTabsProgressListener({
    onLocationChange: (browser, progress, request, uri) => {
      if (!uri) return;
      
      const tab = tabbrowser.getTabForBrowser(browser);
      const tabId = tab.linkedPanel;
      
      this._tabStates.set(tabId, {
        url: uri.spec,
        hasArchive: false,
        peerDataLoading: false,
        ...this._tabStates.get(tabId)
      });
      
      this._updateUI(tabId);
    }
  });
  
  // Track tab switches
  tabbrowser.tabContainer.addEventListener('TabSelect', (event) => {
    console.log('tabselect listener')
    this._handleTabChange(event.target);
  });
  
  // Clean up closed tabs
  tabbrowser.tabContainer.addEventListener('TabClose', (event) => {
    console.log('tabclose listener')
    this._tabStates.delete(event.target.linkedPanel);
  });
},

_handleTabChange(tab) {
  // Use the unique linkedPanel ID that Firefox assigns
  const tabId = tab.linkedPanel;
  const browser = this._browserWindow.gBrowser.getBrowserForTab(tab);
  const url = browser.currentURI.spec;
  
  // Update state for this tab
  this._tabStates.set(tabId, {
    url,
    hasArchive: false, // Will be updated by _archiveChecker
    peerDataLoading: false
  });
  
  this._updateUI(tabId);
},

  async _handleURLChange(message) {
    console.log("url changed", { message })

    const browser = message.target;
    const tabbrowser = this._browserWindow.gBrowser;

        const tab = tabbrowser.getTabForBrowser(browser);
    if (!tab) {
        console.error("Could not find tab for URL change");
        return;
    }

    const tabId = tab.linkedPanel;
    const url = message.data.url;

    console.log("URL change details:", { tabId, url });

    try {
        // Check if we have an archive
        const archiveExists = await this._archiveChecker(url);
        
        this._tabStates.set(tabId, {
            url,
            hasArchive: archiveExists,
            peerDataLoading: true
        });

        this._updateUI(tabId);
        
        // Start peer data lookup in background
        this._startPeerLookup(tabId, url);
    } catch (error) {
        console.error("Error handling URL change:", error);
    }
  },

  async _startPeerLookup(tabId, url) {
    console.log('would start peer lookup ', {tabId, url})
    return Promise.resolve()
  },

  async _handleArchiveRequest(message) {
    // The .data property has what was sent in broadcastAsyncMessage
    console.log("arch req mesg", { message });
    const { url, timestamp, tabId } = message;
    console.log("Archive request fn in parent:", { url, timestamp, tabId });

    // Perform your archive logic here
    // e.g., store the URL, call a service, spawn a worker, etc.
    // For now, just log or do something minimal:
    try {
      await this._doArchive(url);
      console.log("Archive completed successfully for", url);
    } catch (error) {
      console.error("Archive failed", error);
    }
  },

  async _doArchive(url) {
    // Placeholder for the actual archive logic.
    // For now, just a dummy promise wait or console.log
    console.log("Pretending to archive:", url);
    return Promise.resolve();
  },

  async _archiveChecker(url) {
    console.log('checking for archive ', { url });
    return true
  },

  _setupUI() {
    console.log("Setting up UI");
    let doc = this._window.document;
    let urlBox = doc.querySelector("#url-textbox");
    let fetchButton = doc.querySelector("#fetch-button");
    
    // Set default value for NWS API
    if (urlBox) {
      urlBox.value = "https://api.weather.gov/gridpoints/OKX/40,34/forecast";
    }
    
    if (fetchButton) {
      fetchButton.addEventListener("command", () => this.doFetch());
    }

    const archiveButton = this._window.document.getElementById('archive-button');
    if (archiveButton) {
        console.log('setting up archive button');

        const currentBrowser = this._browserWindow.gBrowser.selectedBrowser;
        const url = currentBrowser.currentURI.spec;

        archiveButton.addEventListener('command', () => {
            // TODO: this 'url' is always just 'about:home', it doesn't
            // use the currently-selected tab's URL
          const currentTab = this._browserWindow.gBrowser.selectedTab;
          const currentBrowser = this._browserWindow.gBrowser.selectedBrowser;
          const url = currentBrowser.currentURI.spec;
          const tabId = currentTab.linkedPanel;

            console.log('get tab state for ', tabId)
            let tabState = this._tabStates.get(tabId) || {
                url,
                hasArchive: false,
                peerDataLoading: false
            };
            console.log('tabState', {tabState})

            // Update state to show archive in progress
            this._tabStates.set(tabId, {
                ...tabState,
                archiveInProgress: true
            });

            console.log('updating UI / tab state for ', tabId)
            this._updateUI(tabId);

            const requestMessage = {
              url,
              timestamp: Date.now(),
              tabId,
            }
          console.log('About to send archive request for: ', {requestMessage});
            this._handleArchiveRequest(requestMessage);
          // Services.mm.broadcastAsyncMessage("CustomSidebar:ArchiveRequest", {
          //   url,
          //   timestamp: Date.now()
          // });
        });
    }

  },

  _updateUI(tabId) {
    const state = this._tabStates.get(tabId);
    if (!state) return;

    const doc = this._window.document;
    const container = doc.getElementById('sidebar-content');

    // Clear existing content
    // while (container.firstChild) {
    //   container.firstChild.remove();
    // }

    if (state.hasArchive) {
      this._addArchiveView(container, state);
    } else {
      this._addArchiveOption(container, state);
    }

    if (state.peerDataLoading) {
      // this._addLoadingIndicator(container);
    } else if (state.peerData) {
      this._addPeerData(container, state.peerData);
    }
  },

  _addArchiveView(container, state) {
    console.log('would add archive view ', { container, state })
    return
  },
  _addArchiveOption(container, state) {
    console.log('would add archive option ', { container, state })
    return
  },
  _addPeerData(container, peerData) {
    console.log('would add peerData ', { container, peerData })
    return
  },

  async doFetch() {
    let doc = this._window.document;
    let urlBox = doc.querySelector("#url-textbox");
    let forecastContainer = doc.querySelector("#forecast-container");
    
    if (!urlBox || !forecastContainer) return;
    
    try {
      this._clearForecast(forecastContainer);
      this._addLoadingIndicator(forecastContainer);
      
      let response = await fetch(urlBox.value, {
        headers: {
          'User-Agent': '(Mozilla Firefox Weather Sidebar, contact@example.com)'
        }
      });
      
      let data = await response.json();
      this._displayForecast(data, forecastContainer);
      
    } catch (error) {
      this._showError(forecastContainer, error.message);
      console.error("Fetch error:", error);
    }
  },

  _displayForecast(data, container) {
    if (!data.properties || !data.properties.periods) {
      this._showError(container, "Invalid forecast data received");
      return;
    }
  
    let content = `
      <html>
        <head>
        <style>
          body { 
            margin: 0; 
            padding: 10px;
            background: transparent;
            color: var(--lwt-sidebar-text-color, -moz-dialogtext);
            font-family: -moz-dialog;
          }
          .period {
            border: 1px solid var(--lwt-sidebar-border-color, ThreeDShadow);
            border-radius: 4px;
            margin-bottom: 10px;
            background: var(--lwt-sidebar-background-color, -moz-dialog);
          }
          .period-header {
            background: var(--lwt-sidebar-highlight-background-color, ThreeDHighlight);
            padding: 5px 10px;
            font-weight: bold;
            border-bottom: 1px solid var(--lwt-sidebar-border-color, ThreeDShadow);
          }
          .period-content {
            padding: 10px;
          }
          .temp {
            font-size: larger;
            font-weight: bold;
          }
          .details {
            margin-top: 5px;
          }
        </style>
      </head>
      <body>
    `;
  
    data.properties.periods.forEach(period => {
      content += `
        <div class="period">
          <div class="period-header">${period.name}</div>
          <div class="period-content">
            <div class="temp">🌡️ ${period.temperature}°${period.temperatureUnit}</div>
            <div>${period.shortForecast}</div>
            <div>💨 ${period.windSpeed} ${period.windDirection}</div>
            <div class="details">${period.detailedForecast}</div>
          </div>
        </div>
      `;
    });
  
    content += `
        </body>
      </html>
    `;
  
    container.contentWindow.document.documentElement.innerHTML = content;
  },
  
  _clearForecast(container) {
    container.contentWindow.document.documentElement.innerHTML = '';
  },
  
  _addLoadingIndicator(container) {
    container.contentWindow.document.documentElement.innerHTML = `
      <html>
        <body style="margin: 0; padding: 10px;">
          Loading forecast...
        </body>
      </html>
    `;
  },
  
  _showError(container, message) {
    container.contentWindow.document.documentElement.innerHTML = `
      <html>
        <body style="margin: 0; padding: 10px; color: red;">
          Error: ${message}
        </body>
      </html>
    `;
  },

};
