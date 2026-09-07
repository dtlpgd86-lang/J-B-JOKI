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

function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf-8")); }
  catch (e) { return []; }
}

function writeOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), "utf-8");
}

function serveFile(res, filePath) {
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
    let body = "";
    req.on("data", (chunk) => body += chunk);
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve({}); }
    });
  });
}

function generateId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "FJ-";
  for (let i = 0; i < 6; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
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

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // --- Static files ---
  if (method === "GET" && !pathname.startsWith("/api/")) {
    let filePath = path.join(__dirname, pathname === "/" ? "wa-index.html" : pathname);
    // Fallback to .html if no extension
    if (!path.extname(filePath)) filePath += ".html";
    return serveFile(res, filePath);
  }

  // --- API Routes ---
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  // GET /api/services?game=fisch
  if (pathname === "/api/services" && method === "GET") {
    const game = parsed.query.game || "fisch";
    const config = require("./wa-config.js");
    const services = config.WACONFIG.services[game] || [];
    return res.end(JSON.stringify({ success: true, data: services }));
  }

  // POST /api/order — Create order from WhatsApp chat
  if (pathname === "/api/order" && method === "POST") {
    const body = await getBody(req);
    const config = require("./wa-config.js").WACONFIG;

    // Validate required fields
    if (!body.game || !body.service || !body.target || !body.username) {
      return res.end(JSON.stringify({ success: false, error: "Lengkapi semua data: game, service, target, username" }));
    }

    const gameServices = config.services[body.game];
    if (!gameServices) {
      return res.end(JSON.stringify({ success: false, error: "Game tidak valid. Pilih: fisch atau fishit" }));
    }
    const svc = gameServices.find(s => s.id === body.service);
    if (!svc) {
      return res.end(JSON.stringify({ success: false, error: "Layanan tidak valid untuk game ini" }));
    }

    const priorityKey = body.priority || "normal";
    const price = calcPrice(svc.price, body.target, priorityKey, config);
    const now = new Date().toISOString();
    const order = {
      id: generateId(),
      game: body.game,
      gameName: config.games[body.game].name,
      service: body.service,
      serviceName: svc.name,
      target: body.target,
      username: body.username,
      detail: body.detail || "",
      priority: priorityKey === "express" ? "Express" : "Normal",
      priorityKey: priorityKey,
      price: price,
      est: svc.est + (priorityKey === "express" ? " (Express)" : " (Normal)"),
      status: 0, // Menunggu Pembayaran
      createdAt: now,
      updatedAt: now,
      customerContact: body.contact || "",
      notes: "",
    };

    const orders = readOrders();
    orders.unshift(order);
    writeOrders(orders);

    return res.end(JSON.stringify({
      success: true,
      data: order,
      message: `Order berhasil dibuat! ID: ${order.id}. Total: Rp ${price.toLocaleString("id-ID")}. Kami akan hubungi kamu via WhatsApp.`
    }));
  }

  // GET /api/orders — List orders
  if (pathname === "/api/orders" && method === "GET") {
    const orders = readOrders();
    return res.end(JSON.stringify({ success: true, data: orders }));
  }

  // GET /api/order/:id — Get single order
  if (pathname.startsWith("/api/order/") && method === "GET") {
    const id = pathname.replace("/api/order/", "");
    const orders = readOrders();
    const order = orders.find(o => o.id.toLowerCase() === id.toLowerCase());
    if (!order) {
      return res.end(JSON.stringify({ success: false, error: "Order tidak ditemukan" }));
    }
    return res.end(JSON.stringify({ success: true, data: order }));
  }

  // PUT /api/order/:id — Update order status
  if (pathname.startsWith("/api/order/") && method === "PUT") {
    const id = pathname.replace("/api/order/", "");
    const body = await getBody(req);
    const orders = readOrders();
    const idx = orders.findIndex(o => o.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) {
      return res.end(JSON.stringify({ success: false, error: "Order tidak ditemukan" }));
    }
    if (body.status !== undefined) orders[idx].status = body.status;
    if (body.notes !== undefined) orders[idx].notes = body.notes;
    orders[idx].updatedAt = new Date().toISOString();
    writeOrders(orders);
    return res.end(JSON.stringify({ success: true, data: orders[idx] }));
  }

  // DELETE /api/order/:id
  if (pathname.startsWith("/api/order/") && method === "DELETE") {
    const id = pathname.replace("/api/order/", "");
    let orders = readOrders();
    const idx = orders.findIndex(o => o.id.toLowerCase() === id.toLowerCase());
    if (idx === -1) {
      return res.end(JSON.stringify({ success: false, error: "Order tidak ditemukan" }));
    }
    orders.splice(idx, 1);
    writeOrders(orders);
    return res.end(JSON.stringify({ success: true, message: "Order dihapus" }));
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