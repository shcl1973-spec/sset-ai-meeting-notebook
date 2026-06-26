const FOLDER_NAME = "SSET AI Meeting Notebook";
const FILE_NAME = "notebook.json";
const TOKEN_PROPERTY = "SYNC_TOKEN";

function doGet(e) {
  if (!checkToken_(e.parameter.token || "")) {
    return json_({ error: "Invalid sync token" });
  }
  return json_(readStore_());
}

function doPost(e) {
  var body = parseBody_(e);
  if (!checkToken_(body.token || e.parameter.token || "")) {
    return json_({ error: "Invalid sync token" });
  }
  if (!body.data || !Array.isArray(body.data.meetings)) {
    return json_({ error: "Missing notebook data" });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var payload = {
      ok: true,
      serverUpdatedAt: new Date().toISOString(),
      updatedBy: body.deviceName || body.deviceId || "unknown-device",
      data: body.data
    };
    writeStore_(payload);
    return json_(payload);
  } finally {
    lock.releaseLock();
  }
}

function parseBody_(e) {
  var raw = e.postData && e.postData.contents ? e.postData.contents : "{}";
  try {
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY) || "";
  return !expected || token === expected;
}

function readStore_() {
  var file = getStoreFile_(false);
  if (!file) {
    return { serverUpdatedAt: "", updatedBy: "", data: null };
  }
  try {
    return JSON.parse(file.getBlob().getDataAsString("UTF-8"));
  } catch (error) {
    return { serverUpdatedAt: "", updatedBy: "", data: null };
  }
}

function writeStore_(payload) {
  var file = getStoreFile_(true);
  file.setContent(JSON.stringify(payload, null, 2));
}

function getStoreFile_(createIfMissing) {
  var folder = getFolder_(createIfMissing);
  if (!folder) return null;

  var files = folder.getFilesByName(FILE_NAME);
  if (files.hasNext()) return files.next();
  if (!createIfMissing) return null;

  return folder.createFile(FILE_NAME, JSON.stringify({
    serverUpdatedAt: "",
    updatedBy: "",
    data: null
  }, null, 2), MimeType.PLAIN_TEXT);
}

function getFolder_(createIfMissing) {
  var folders = DriveApp.getFoldersByName(FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return createIfMissing ? DriveApp.createFolder(FOLDER_NAME) : null;
}

function json_(data) {
  var output = ContentService.createTextOutput(JSON.stringify(data, null, 2));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
