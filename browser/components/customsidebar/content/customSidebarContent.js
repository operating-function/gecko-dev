/* This file runs in the content process. */

console.log("customSidebarContent.js loaded");

addMessageListener("CustomSidebar:Ping", function (msg) {
  // This triggers when the parent sends "CustomSidebar:Ping" to this tab.
  let reply = {
    greeting: "Hello from the frame script!",
    originalMsg: msg.data,
  };

  // Send data back to the parent:
  sendAsyncMessage("CustomSidebar:Pong", reply);
});

addMessageListener("CustomSidebar:ArchivesRequest", function (msg) {
  console.log("message listener in UI");
  sendAsyncMessage("CustomSidebar:ArchiveRequestDone");
});

addMessageListener("CustomSidebar:AnyOtherMessage", function (msg) {
  // handle other messages...
});
