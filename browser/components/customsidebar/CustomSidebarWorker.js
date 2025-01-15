self.onmessage = function (e) {
  console.log("onmessage ", { e });
  switch (e.data.type) {
    case "ARCHIVE_PAGE":
      archivePage(e.data.url, e.data.content);
      break;
    case "PROCESS_ARCHIVE":
      processArchive(e.data.archiveData);
      break;
  }
};

function archivePage(url, content) {
  console.log("archiving page ", { url, content });
  // Heavy processing of page content
  // For now just send back some dummy data
  const processedData = {
    url,
    timestamp: Date.now(),
    contentLength: content ? content.length : 0,
  };

  self.postMessage({
    type: "ARCHIVE_COMPLETE",
    url,
    result: processedData,
  });
}

function processArchive(archiveData) {
  console.log("processing archive ", { archiveData });
  // Process the archive data
  const result = {
    processed: true,
    data: archiveData,
  };

  self.postMessage({
    type: "PROCESS_COMPLETE",
    result,
  });
}
