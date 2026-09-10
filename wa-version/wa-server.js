/* =====================================================================
   J & B JOKI — WhatsApp Version Server
   Simple Node.js server with file-based order storage
   No database, no login — just simple JSON files
   ===================================================================== */
const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = 8743;
const ADMIN_TOKEN = process.env.WA_ADMIN_TOKEN || "";
const MAX_BODY_BYTES = 64 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQUESTS = 120;
const rateBuckets = new Map();
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]", "utf-8");

function isAdminRequest(req) {
  if (!ADMIN_TOKEN) return false;
  const header = req.headers["x-admin-token"];
  return typeof header === "string" && header.length > 0 && header === ADMIN_TOKEN;
}

function clientIp(req) {
  return req.socket?.remoteAddress || "unknown";
}

function isRateLimited(req) {
  const key = clientIp(req);
  const now = Date.now();
  const bucket = rateBuckets.get(key) || [];
  const fresh = bucket.filter((t) => now - t < RATE_WINDOW_MS).slice(-RATE_MAX_REQUESTS);
  fresh.push(now);
  rateBuckets.set(key, fresh);
  return fresh.length > RATE_MAX_REQUESTS;
}

function sanitizeText(value, maxLength) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.slice(0, maxLength);
}

function isValidStatus(value) {
  return Number.isInteger(value) && value >= 0 && value <= 5;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify(payload));
}

function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8")); }
  catch (e) { return []; }
}

function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
}

function safeStaticPath(pathname) {
  let requested = pathname === "/" ? "wa-index.html" : pathname.slice(1);
  requested = requested.split("?")[0];
  if (!requested || requested.endsWith("/")) requested += "wa-index.html";
  if (!path.extname(requested)) requested += ".html";
  const normalized = path.normalize(requested).replace(/^\.\.(\\|\/)/, "");
  const filePath = path.join(__dirname, normalized);
  if (filePath !== __dirname && !filePath.startsWith(__dirname + path.sep)) return null;
  if (path.basename(filePath) === "wa-server.js") return null;
  return filePath;
}

function serveFile(res, filePath) {
  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Akses ditolak");
  }
  const ext = path.extname(filePath).toLowerCase();
  const ct = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("File tidak ditemukan");
    }
    res.writeHead(200, { "Content-Type": ct });
    res.end(data);
  });
}

function getBody(req) {
  return new Promise((resolve) => {
    let received = 0;
    let body = "";
    let tooLarge = false;
    req.on("data", (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (tooLarge) return resolve(null);
      try { resolve(JSON.parse(body || "{}")); }
      catch (e) { resolve({}); }
    });
  });
}

function generateId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "FJ-";
  for (let i = 0; i < 8; i++) id += chars.charAt(cryptoRandomIndex(chars.length));
  return id;
}

function cryptoRandomIndex(max) {
  try {
    const crypto = require("crypto");
    return crypto.randomInt(max);
  } catch (e) {
    return Math.floor(Math.random() * max);
  }
}

// Kalkulasi harga
function calcPrice(servicePrice, target, priorityKey, config) {
  const num = parseInt(String(target || "").replace(/[^\d]/g, ""), 10) || 0;
  let base = servicePrice;
  if (num > 0) {
    const factor = 1 + Math.min(num / config.targetDivider, config.maxTargetFactor);
    base = servicePrice * factor;
  }
  const mult = (priorityKey === "express") ? config.expressMultiplier : 1;
  let price = Math.max(config.minPrice, Math.round(base * mult / config.roundTo) * config.roundTo);
  return price;
}

// ========================
// ROUTING
// ========================
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  const method = req.method;

  // CORS + security headers
  res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:8743");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Token");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; script-src 'self' https://cdnjs.cloudflare.com");

  if (isRateLimited(req)) return sendJson(res, 429, { success: false, error: "Terlalu banyak permintaan. Coba lagi sebentar." });

  if (method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // --- Static files ---
  if (method === "GET" && !pathname.startsWith("/api/")) {
    return serveFile(res, safeStaticPath(pathname));
  }

  // --- API Routes ---
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // GET /api/services?game=fisch
  if (pathname === "/api/services" && method === "GET") {
    const game = parsed.query.game === "fishit" ? "fishit" : "fisch";
    const config = require("./wa-config.js");
    const services = config.WACONFIG.services[game] || [];
    return sendJson(res, 200, { success: true, data: services });
  }

  // POST /api/order — Create order from WhatsApp chat
  if (pathname === "/api/order" && method === "POST") {
    const body = await getBody(req);
    if (!body) return sendJson(res, 413, { success: false, error: "Data terlalu besar." });
    const config = require("./wa-config.js").WACONFIG;

    // Validate required fields
    const game = sanitizeText(body.game, 10);
    const service = sanitizeText(body.service, 30);
    const target = sanitizeText(body.target, 200);
    const username = sanitizeText(body.username, 30);
    const detail = sanitizeText(body.detail, 500);
    const contact = sanitizeText(body.contact, 30).replace(/[^0-9+]/g, "");
    if (!game || !service || !target || !username) {
      return sendJson(res, 400, { success: false, error: "Lengkapi semua data: game, service, target, username" });
    }
    if (!/^[A-Za-z0-9_.]{3,30}$/.test(username)) {
      return sendJson(res, 400, { success: false, error: "Username Roblox tidak valid." });
    }

    const gameServices = config.services[game];
    if (!gameServices) {
      return sendJson(res, 400, { success: false, error: "Game tidak valid. Pilih: fisch atau fishit" });
    }
    const svc = gameServices.find(s => s.id === service);
    if (!svc) {
      return sendJson(res, 400, { success: false, error: "Layanan tidak valid untuk game ini" });
    }

    const priorityKey = body.priority === "express" ? "express" : "normal";
    const price = calcPrice(svc.price, target, priorityKey, config);
    const now = new Date().toISOString();
    const order = {
      id: generateId(),
      game,
      gameName: config.games[game].name,
      service,
      serviceName: svc.name,
      target,
      username,
      detail,
      priority: priorityKey === "express" ? "Express" : "Normal",
      priorityKey,
      price,
      est: svc.est + (priorityKey === "express" ? " (Express)" : " (Normal)"),
      status: 0, // Menunggu Pembayaran
      createdAt: now,
      updatedAt: now,
      customerContact: contact,
      notes: "",
    };

    const orders = readOrders();
    orders.unshift(order);
    writeOrders(orders);

    return sendJson(res, 200, {
      success: true,
      data: order,
      message: `Order berhasil dibuat! ID: ${order.id}. Total: Rp ${price.toLocaleString("id-ID")}. Kami akan hubungi kamu via WhatsApp.`
    });
  }

  // GET /api/orders — hanya admin, daftar ringkas tanpa kontak penuh
  if (pathname === "/api/orders" && method === "GET") {
    if (!isAdminRequest(req)) return sendJson(res, 403, { success: false, error: "Butuh token admin." });
    const orders = readOrders().map((o) => ({
      id: o.id, game: o.game, gameName: o.gameName, service: o.service, serviceName: o.serviceName,
      target: o.target, username: o.username, priority: o.priority, price: o.price,
      est: o.est, status: o.status, createdAt: o.createdAt, updatedAt: o.updatedAt,
      notes: o.notes || "",
    }));
    return sendJson(res, 200, { success: true, data: orders });
  }

  // GET /api/order/:id — Get single order
  if (pathname.startsWith("/api/order/") && method === "GET") {
    if (!isAdminRequest(req)) return sendJson(res, 403, { success: false, error: "Butuh token admin." });
    const id = sanitizeText(pathname.replace("/api/order/", ""), 20).toUpperCase();
    if (!/^FJ-[A-Z0-9]{6,10}$/.test(id)) return sendJson(res, 400, { success: false, error: "Order ID tidak valid." });
    const orders = readOrders();
    const order = orders.find(o => String(o.id).toUpperCase() === id);
    if (!order) {
      return sendJson(res, 404, { success: false, error: "Order tidak ditemukan" });
    }
    return sendJson(res, 200, { success: true, data: order });
  }

  // PUT /api/order/:id — Update order status
  if (pathname.startsWith("/api/order/") && method === "PUT") {
    if (!isAdminRequest(req)) return sendJson(res, 403, { success: false, error: "Butuh token admin." });
    const id = sanitizeText(pathname.replace("/api/order/", ""), 20).toUpperCase();
    if (!/^FJ-[A-Z0-9]{6,10}$/.test(id)) return sendJson(res, 400, { success: false, error: "Order ID tidak valid." });
    const body = await getBody(req);
    if (!body) return sendJson(res, 413, { success: false, error: "Data terlalu besar." });
    const orders = readOrders();
    const idx = orders.findIndex(o => String(o.id).toUpperCase() === id);
    if (idx === -1) {
      return sendJson(res, 404, { success: false, error: "Order tidak ditemukan" });
    }
    if (body.status !== undefined) {
      const status = Number(body.status);
      if (!isValidStatus(status)) return sendJson(res, 400, { success: false, error: "Status tidak valid." });
      orders[idx].status = status;
    }
    if (body.notes !== undefined) orders[idx].notes = sanitizeText(body.notes, 500);
    orders[idx].updatedAt = new Date().toISOString();
    writeOrders(orders);
    return sendJson(res, 200, { success: true, data: orders[idx] });
  }

  // DELETE /api/order/:id
  if (pathname.startsWith("/api/order/") && method === "DELETE") {
    if (!isAdminRequest(req)) return sendJson(res, 403, { success: false, error: "Butuh token admin." });
    const id = sanitizeText(pathname.replace("/api/order/", ""), 20).toUpperCase();
    if (!/^FJ-[A-Z0-9]{6,10}$/.test(id)) return sendJson(res, 400, { success: false, error: "Order ID tidak valid." });
    let orders = readOrders();
    const idx = orders.findIndex(o => String(o.id).toUpperCase() === id);
    if (idx === -1) {
      return sendJson(res, 404, { success: false, error: "Order tidak ditemukan" });
    }
    orders.splice(idx, 1);
    writeOrders(orders);
    return sendJson(res, 200, { success: true, message: "Order dihapus" });
  }

  // 404
  res.writeHead(404);
  res.end(JSON.stringify({ success: false, error: "Route tidak ditemukan" }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`🐟 J & B JOKI — WhatsApp Version`);
  console.log(`📦 Server: http://127.0.0.1:${PORT}`);
  console.log(`📋 Admin: http://127.0.0.1:${PORT}/wa-admin.html`);
  console.log(`💬 WhatsApp: https://wa.me/6281229422012`);
});