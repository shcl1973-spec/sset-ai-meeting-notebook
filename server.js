const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "0.0.0.0";
const syncToken = process.env.SYNC_TOKEN || "";
const latestAppVersion = "v9";
const syncDir = path.join(root, "sync-data");
const syncFile = path.join(syncDir, "notebook.json");

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

function send(response, status, body, type = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Sync-Token",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
  });
  response.end(body);
}

function sendJson(response, status, data) {
  send(response, status, JSON.stringify(data, null, 2), "application/json; charset=utf-8");
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 25 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function getToken(request, url, body = {}) {
  const auth = request.headers.authorization || "";
  return body.token || request.headers["x-sync-token"] || auth.replace(/^Bearer\s+/i, "") || url.searchParams.get("token") || "";
}

function checkToken(request, url, body = {}) {
  if (!syncToken) return true;
  return getToken(request, url, body) === syncToken;
}

function readSyncStore() {
  try {
    return JSON.parse(fs.readFileSync(syncFile, "utf8"));
  } catch (error) {
    return { serverUpdatedAt: "", updatedBy: "", data: null };
  }
}

function writeSyncStore(payload) {
  fs.mkdirSync(syncDir, { recursive: true });
  fs.writeFileSync(syncFile, JSON.stringify(payload, null, 2), "utf8");
}

function getLanUrls(request) {
  const hostHeader = request.headers.host || `127.0.0.1:${port}`;
  const portPart = hostHeader.includes(":") ? hostHeader.split(":").pop() : String(port);
  const urls = [`http://127.0.0.1:${portPart}/`];
  Object.values(os.networkInterfaces()).flat().filter(Boolean).forEach((entry) => {
    if (entry.family === "IPv4" && !entry.internal) {
      urls.push(`http://${entry.address}:${portPart}/`);
    }
  });
  return [...new Set(urls)];
}

async function handleApi(request, response, url) {
  if (request.method === "OPTIONS") {
    send(response, 204, "");
    return true;
  }

  if (url.pathname === "/api/install-info" && request.method === "GET") {
    const urls = getLanUrls(request);
    sendJson(response, 200, {
      appName: "SSET 業務會議 AI 筆記本",
      localUrl: urls[0],
      lanUrls: urls.slice(1),
      allUrls: urls,
      syncEndpoint: `${urls[0].replace(/\/$/, "")}/api/sync`,
      tokenRequired: Boolean(syncToken)
    });
    return true;
  }

  if (url.pathname === "/api/sync" && request.method === "GET") {
    if (!checkToken(request, url)) {
      sendJson(response, 401, { error: "Invalid sync token" });
      return true;
    }
    sendJson(response, 200, readSyncStore());
    return true;
  }

  if (url.pathname === "/api/sync" && request.method === "POST") {
    let body = {};
    try {
      body = JSON.parse(await readBody(request) || "{}");
    } catch (error) {
      sendJson(response, 400, { error: "Invalid JSON" });
      return true;
    }
    if (!checkToken(request, url, body)) {
      sendJson(response, 401, { error: "Invalid sync token" });
      return true;
    }
    if (!body.data || !Array.isArray(body.data.meetings)) {
      sendJson(response, 400, { error: "Missing notebook data" });
      return true;
    }
    const payload = {
      serverUpdatedAt: new Date().toISOString(),
      updatedBy: body.deviceName || body.deviceId || "unknown-device",
      data: body.data
    };
    writeSyncStore(payload);
    sendJson(response, 200, { ok: true, ...payload });
    return true;
  }

  return false;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `127.0.0.1:${port}`}`);
  if (await handleApi(request, response, url)) return;

  if ((url.pathname === "/" || url.pathname === "/index.html") && url.searchParams.get("v") !== latestAppVersion) {
    url.pathname = "/";
    url.searchParams.set("v", latestAppVersion);
    response.writeHead(302, {
      "Location": url.pathname + url.search,
      "Cache-Control": "no-store"
    });
    response.end();
    return;
  }

  const pathname = decodeURIComponent(url.pathname);
  const normalized = path.normalize(pathname === "/" ? "/index.html" : pathname);
  const filePath = path.join(root, normalized);
  const relative = path.relative(root, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative) || relative.startsWith("sync-data")) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(response, 404, "Not found");
      return;
    }
    send(response, 200, data, types[path.extname(filePath)] || "application/octet-stream");
  });
});

server.listen(port, host, () => {
  console.log(`SSET AI notebook running at http://127.0.0.1:${port}/`);
  Object.values(os.networkInterfaces()).flat().filter(Boolean).forEach((entry) => {
    if (entry.family === "IPv4" && !entry.internal) {
      console.log(`LAN install URL: http://${entry.address}:${port}/install.html`);
    }
  });
});
