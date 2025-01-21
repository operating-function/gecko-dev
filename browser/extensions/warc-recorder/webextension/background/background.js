const requestStore = new Map();
const redirectChains = new Map();

function generateWarcRecord(request, response) {
  const warcVersion = "WARC/1.1";
  const recordId = crypto.randomUUID();
  const date = new Date().toISOString();

  // Generate request record
  let requestRecord = `${warcVersion}\r\n`;
  requestRecord += `WARC-Type: request\r\n`;
  requestRecord += `WARC-Date: ${date}\r\n`;
  requestRecord += `WARC-Record-ID: <urn:uuid:${recordId}>\r\n`;
  requestRecord += `Content-Type: application/http;msgtype=request\r\n`;
  requestRecord += `WARC-Target-URI: ${request.url}\r\n`;

  // Add WARC-Concurrent-To headers if this was part of a redirect chain
  if (request.previousRequestIds) {
    for (const prevId of request.previousRequestIds) {
      requestRecord += `WARC-Concurrent-To: <urn:uuid:${prevId}>\r\n`;
    }
  }

  // Create request headers block
  let requestHeaders = `${request.method} ${request.url} HTTP/1.1\r\n`;
  for (const [name, value] of Object.entries(request.headers)) {
    requestHeaders += `${name}: ${value}\r\n`;
  }
  requestHeaders += "\r\n";

  // Convert headers to Uint8Array
  const requestHeadersBytes = new TextEncoder().encode(requestHeaders);

  // Combine headers and body
  const requestContent = new Uint8Array([
    ...requestHeadersBytes,
    ...(request.body || new Uint8Array(0)),
  ]);

  requestRecord += `Content-Length: ${requestContent.byteLength}\r\n\r\n`;

  // Generate response record
  let responseRecord = `${warcVersion}\r\n`;
  responseRecord += `WARC-Type: response\r\n`;
  responseRecord += `WARC-Date: ${date}\r\n`;
  responseRecord += `WARC-Record-ID: <urn:uuid:${crypto.randomUUID()}>\r\n`;
  responseRecord += `WARC-Concurrent-To: <urn:uuid:${recordId}>\r\n`;
  responseRecord += `Content-Type: application/http;msgtype=response\r\n`;
  responseRecord += `WARC-Target-URI: ${request.url}\r\n`;
  if (response.ip) {
    responseRecord += `WARC-IP-Address: ${response.ip}\r\n`;
  }

  // Parse HTTP version from status line
  const httpVersion = response.statusLine
    ? response.statusLine.split(" ")[0].split("/")[1]
    : "1.1";

  // Create response headers block
  let responseHeaders = `HTTP/${httpVersion} ${response.statusCode} ${response.statusLine ? response.statusLine.split(" ").slice(2).join(" ") : ""}\r\n`;
  for (const [name, value] of Object.entries(response.headers)) {
    responseHeaders += `${name}: ${value}\r\n`;
  }
  responseHeaders += "\r\n";

  // Convert headers to Uint8Array
  const responseHeadersBytes = new TextEncoder().encode(responseHeaders);

  // Combine headers and body
  const responseContent = new Uint8Array([
    ...responseHeadersBytes,
    ...(response.body || new Uint8Array(0)),
  ]);

  responseRecord += `Content-Length: ${responseContent.byteLength}\r\n\r\n`;

  // Combine everything into final WARC record
  const recordParts = [
    new TextEncoder().encode(requestRecord),
    requestContent,
    new TextEncoder().encode("\r\n\r\n"),
    new TextEncoder().encode(responseRecord),
    responseContent,
    new TextEncoder().encode("\r\n\r\n"),
  ];

  return new Blob(recordParts);
}

async function uploadWarcRecord(warcRecord) {
  try {
    const response = await fetch("http://localhost:12345", {
      method: "POST",
      headers: {
        "Content-Type": "application/warc",
      },
      body: warcRecord,
    });

    if (!response.ok) {
      console.error("Failed to upload WARC record:", response.statusText);
    }
  } catch (error) {
    console.error("Error uploading WARC record:", error);
  }
}

browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    const request = {
      id: details.requestId,
      method: details.method,
      url: details.url,
      headers: {},
      body: null,
    };

    details.requestHeaders.forEach((header) => {
      request.headers[header.name] = header.value;
    });

    requestStore.set(details.requestId, { request });
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"],
);

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Create new request entry
    const request = {
      id: details.requestId,
      method: details.method,
      url: details.url,
      headers: {},
      body: null,
    };

    // Handle request body if present
    if (details.requestBody) {
      if (details.requestBody.raw) {
        const totalLength = details.requestBody.raw.reduce(
          (sum, chunk) => sum + chunk.bytes.byteLength,
          0,
        );
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of details.requestBody.raw) {
          combined.set(new Uint8Array(chunk.bytes), offset);
          offset += chunk.bytes.byteLength;
        }
        request.body = combined;
      } else if (details.requestBody.formData) {
        // Convert form data to URLSearchParams format
        const formData = new URLSearchParams();
        for (const [name, values] of Object.entries(
          details.requestBody.formData,
        )) {
          for (const value of values) {
            formData.append(name, value);
          }
        }
        request.body = new TextEncoder().encode(formData.toString());
      }
    }

    // Check if this request was the target of a redirect
    if (redirectChains.has(details.url)) {
      request.previousRequestIds = redirectChains.get(details.url);
      redirectChains.delete(details.url);
    }

    requestStore.set(details.requestId, { request });
  },
  { urls: ["<all_urls>"] },
  ["requestBody"],
);

browser.webRequest.onResponseStarted.addListener(
  (details) => {
    if (requestStore.has(details.requestId)) {
      const stored = requestStore.get(details.requestId);
      stored.ip = details.ip; // Firefox provides the IP address here
      requestStore.set(details.requestId, stored);
    }
  },
  { urls: ["<all_urls>"] },
);

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (requestStore.has(details.requestId)) {
      const filter = browser.webRequest.filterResponseData(details.requestId);
      const chunks = [];

      filter.ondata = (event) => {
        chunks.push(new Uint8Array(event.data));
        filter.write(event.data);
      };

      filter.onstop = () => {
        const stored = requestStore.get(details.requestId);
        if (stored) {
          // Combine all chunks into one Uint8Array
          const totalLength = chunks.reduce(
            (acc, chunk) => acc + chunk.length,
            0,
          );
          stored.response.body = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            stored.response.body.set(chunk, offset);
            offset += chunk.length;
          }

          const warcRecord = generateWarcRecord(
            stored.request,
            stored.response,
          );
          uploadWarcRecord(warcRecord);

          requestStore.delete(details.requestId);
        }
        filter.disconnect();
      };

      const stored = requestStore.get(details.requestId);
      const response = {
        statusCode: details.statusCode,
        statusLine: details.statusLine,
        headers: {},
        body: null,
      };

      details.responseHeaders.forEach((header) => {
        response.headers[header.name] = header.value;
      });

      stored.response = response;
      requestStore.set(details.requestId, stored);
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "blocking"],
);

browser.webRequest.onBeforeRedirect.addListener(
  (details) => {
    // Store the relationship between the old request and the new one
    if (!redirectChains.has(details.redirectUrl)) {
      redirectChains.set(details.redirectUrl, []);
    }
    redirectChains.get(details.redirectUrl).push(details.requestId);

    // Mark the current request as part of a redirect chain
    if (requestStore.has(details.requestId)) {
      const stored = requestStore.get(details.requestId);
      stored.isRedirect = true;
      stored.redirectUrl = details.redirectUrl;
      requestStore.set(details.requestId, stored);
    }
  },
  { urls: ["<all_urls>"] },
);

/*
browser.webRequest.filterResponseData.addListener(
  (details) => {
    const chunks = [];
    const filter = browser.webRequest.filterResponseData(details.requestId);

    filter.ondata = (event) => {
      chunks.push(new Uint8Array(event.data));
      filter.write(event.data);
    };

    filter.onstop = () => {
      if (requestStore.has(details.requestId)) {
        const stored = requestStore.get(details.requestId);

        // Combine all chunks into one Uint8Array
        const totalLength = chunks.reduce(
          (acc, chunk) => acc + chunk.length,
          0,
        );
        stored.response.body = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          stored.response.body.set(chunk, offset);
          offset += chunk.length;
        }

        const warcRecord = generateWarcRecord(stored.request, stored.response);
        uploadWarcRecord(warcRecord);

        requestStore.delete(details.requestId);
      }
      filter.disconnect();
    };
  },
  { urls: ["<all_urls>"] },
);
*/

browser.webRequest.onCompleted.addListener(
  (details) => {
    requestStore.delete(details.requestId);
  },
  { urls: ["<all_urls>"] },
);

browser.webRequest.onErrorOccurred.addListener(
  (details) => {
    requestStore.delete(details.requestId);
  },
  { urls: ["<all_urls>"] },
);
