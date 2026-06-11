const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "items.json");
const MAX_BODY_BYTES = 16 * 1024;

const clients = new Set();
let writeQueue = Promise.resolve();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

async function ensureDataFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]\n", "utf8");
  }
}

async function readItems() {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf8");
  const parsed = JSON.parse(raw || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

async function writeItems(items) {
  await ensureDataFile();
  const tempFile = `${DATA_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tempFile, `${JSON.stringify(items, null, 2)}\n`, "utf8");
  await fs.rename(tempFile, DATA_FILE);
}

function sanitizeText(value, maxLength) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeItem(input = {}) {
  return {
    item: sanitizeText(input.item, 120),
    quantity: sanitizeText(input.quantity, 80),
    person: sanitizeText(input.person, 80)
  };
}

function isValidItem(item) {
  return item.item && item.quantity && item.person;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

async function readJsonBody(req) {
  let size = 0;
  const chunks = [];

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("REQUEST_TOO_LARGE");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function broadcast(items) {
  const payload = `event: sync\ndata: ${JSON.stringify(items)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

function updateItems(mutator) {
  const operation = async () => {
    const items = await readItems();
    const result = await mutator(items);
    await writeItems(items);
    broadcast(items);
    return result;
  };

  writeQueue = writeQueue.then(operation, operation);
  return writeQueue;
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalizedPath = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalizedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, "Zugriff verweigert.");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(file);
  } catch {
    sendError(res, 404, "Nicht gefunden.");
  }
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/items") {
    sendJson(res, 200, await readItems());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/items") {
    const body = await readJsonBody(req);
    const fields = normalizeItem(body);

    if (!isValidItem(fields)) {
      sendError(res, 400, "Bitte Mitbringsel, Menge und Namen eintragen.");
      return;
    }

    const created = await updateItems((items) => {
      const now = new Date().toISOString();
      const entry = {
        id: crypto.randomUUID(),
        ...fields,
        createdAt: now,
        updatedAt: now
      };
      items.push(entry);
      return entry;
    });

    sendJson(res, 201, created);
    return;
  }

  const itemMatch = url.pathname.match(/^\/api\/items\/([^/]+)$/);
  if (!itemMatch) {
    sendError(res, 404, "Nicht gefunden.");
    return;
  }

  const id = decodeURIComponent(itemMatch[1]);

  if (req.method === "PUT") {
    const body = await readJsonBody(req);
    const fields = normalizeItem(body);

    if (!isValidItem(fields)) {
      sendError(res, 400, "Bitte Mitbringsel, Menge und Namen eintragen.");
      return;
    }

    const updated = await updateItems((items) => {
      const item = items.find((entry) => entry.id === id);
      if (!item) return null;
      item.item = fields.item;
      item.quantity = fields.quantity;
      item.person = fields.person;
      item.updatedAt = new Date().toISOString();
      return item;
    });

    if (!updated) {
      sendError(res, 404, "Eintrag nicht gefunden.");
      return;
    }

    sendJson(res, 200, updated);
    return;
  }

  if (req.method === "DELETE") {
    const removed = await updateItems((items) => {
      const index = items.findIndex((entry) => entry.id === id);
      if (index === -1) return false;
      items.splice(index, 1);
      return true;
    });

    if (!removed) {
      sendError(res, 404, "Eintrag nicht gefunden.");
      return;
    }

    sendJson(res, 200, { ok: true });
    return;
  }

  sendError(res, 405, "Methode nicht erlaubt.");
}

async function handleEvents(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive"
  });

  clients.add(res);
  res.write(`event: sync\ndata: ${JSON.stringify(await readItems())}\n\n`);

  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 25000);
  req.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/events") {
      await handleEvents(req, res);
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    if (error.message === "REQUEST_TOO_LARGE") {
      sendError(res, 413, "Die Eingabe ist zu gross.");
      return;
    }

    if (error instanceof SyntaxError) {
      sendError(res, 400, "Die Anfrage konnte nicht gelesen werden.");
      return;
    }

    console.error(error);
    sendError(res, 500, "Interner Fehler.");
  }
});

function startServer(port) {
  const onListening = () => {
    const address = server.address();
    const activePort = typeof address === "object" && address ? address.port : port;
    console.log(`Sommerfest-Liste laeuft auf http://localhost:${activePort}`);
  };

  server.once("listening", onListening);
  server.once("error", (error) => {
    server.removeListener("listening", onListening);

    if (error.code === "EADDRINUSE" && !process.env.PORT) {
      startServer(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port);
}

ensureDataFile().then(() => startServer(PORT));
