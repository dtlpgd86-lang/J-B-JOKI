/* =====================================================================
   J&B JOKI — script.js
   Interaksi: loader, partikel, navbar, animasi, order, status, admin
   ===================================================================== */
"use strict";

/* ---------- Helper dasar ---------- */
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const fmtR = (n) => "Rp " + Math.round(n).toLocaleString("id-ID");
const waLink = (msg = APPCONFIG.whatsappMsg) => `https://wa.me/${APPCONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;
const PAGE = document.body.dataset.page || "index";

/* ---------- LocalStorage (database lokal demo; siap diganti PHP/MySQL) ---------- */
const KEY = { orders: "fj_orders", svc: "fj_services", faq: "fj_faq", testi: "fj_testi", auth: "fj_auth" };
const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
  del(k) { localStorage.removeItem(k); },
};
const supabaseClient = window.supabase?.createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.publishableKey,
);

/* ---------- Tema gelap / terang (light theme) ---------- */
function setTheme(t, save = true) {
  t = t === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", t);
  if (save) { try { localStorage.setItem("fj_theme", t); } catch (e) { } }
  $$(".theme-toggle").forEach(b => {
    b.innerHTML = t === "light" ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    b.setAttribute("aria-label", t === "light" ? "Ganti ke mode gelap" : "Ganti ke mode terang");
  });
}
const currentTheme = () => document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
function initTheme() {
  setTheme(currentTheme(), false);
  $$(".theme-toggle").forEach(b => b.addEventListener("click", () => setTheme(currentTheme() === "light" ? "dark" : "light")));
}

/* ---------- Data dengan override admin ---------- */
const getServices = (game) => {
  const ov = store.get(KEY.svc, {});
  return (ov[game] && ov[game].length) ? ov[game] : SERVICES[game];
};
const getFaqs = () => { const f = store.get(KEY.faq, null); return (f && f.length) ? f : FAQS; };
const getTestis = () => { const t = store.get(KEY.testi, null); return (t && t.length) ? t : TESTIMONIALS; };
let adminOrders = [];
const getOrders = () => PAGE === "admin" ? adminOrders : store.get(KEY.orders, []);
const dbOrder = (row) => ({
  id: row.id, game: row.game, gameName: row.game_name, service: row.service,
  serviceName: row.service_name, target: row.target, username: row.username,
  detail: row.detail, priority: row.priority, priorityKey: row.priority_key,
  price: row.price, est: row.est, status: row.status,
  createdAt: row.created_at, updatedAt: row.updated_at, trackingToken: row.tracking_token,
});
async function refreshAdminOrders() {
  if (!supabaseClient) throw new Error("Supabase client belum tersedia.");
  const { data, error } = await supabaseClient.from("orders").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  adminOrders = data.map(dbOrder);
}

/* ---------- Toast notification ---------- */
function toast(msg, type = "ok", ms = 3800) {
  let wrap = $("#toastWrap");
  if (!wrap) { wrap = document.createElement("div"); wrap.id = "toastWrap"; document.body.appendChild(wrap); }
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const ic = type === "err" ? "fa-circle-exclamation" : type === "info" ? "fa-circle-info" : "fa-circle-check";
  el.innerHTML = `<i class="fa-solid ${ic} ti"></i><span>${msg}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 420); }, ms);
}

/* ---------- Kalkulasi estimasi harga otomatis ---------- */
function calcQuote(game, svcId, target, priority) {
  const svc = getServices(game).find(s => s.id === svcId);
  if (!svc) return null;
  const num = parseInt(String(target || "").replace(/[^\d]/g, ""), 10) || 0;
  let base = svc.price;
  if (num > 0) {
    const factor = 1 + Math.min(num / APPCONFIG.targetDivider, APPCONFIG.maxTargetFactor);
    base = svc.price * factor;
  }
  const mult = (priority === "express") ? APPCONFIG.expressMultiplier : 1;
  let price = Math.max(APPCONFIG.minPrice, Math.round(base * mult / APPCONFIG.roundTo) * APPCONFIG.roundTo);
  const time = svc.est + ((priority === "express") ? " (Express — lebih cepat)" : " (Normal)");
  return { svc, price, time, num };
}

/* ---------- Create order ---------- */
async function createOrder(data) {
  if (!supabaseClient) throw new Error("Koneksi database belum tersedia.");
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.user) throw new Error("Silakan login dengan Google terlebih dahulu.");
  const id = "FJ-" + Date.now().toString(36).toUpperCase().slice(-6);
  const trackingToken = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const order = {
    id, ...data,
    status: 0,
    createdAt,
    updatedAt: new Date().toISOString(), trackingToken,
  };
  const { error } = await supabaseClient.from("orders").insert({
    id: order.id, tracking_token: trackingToken, game: order.game,
    game_name: order.gameName, service: order.service, service_name: order.serviceName,
    target: order.target, username: order.username, detail: order.detail,
    priority: order.priority, priority_key: order.priorityKey, price: order.price,
    est: order.est, status: order.status, created_at: createdAt,
    customer_id: session.user.id, customer_email: session.user.email || "",
  });
  if (error) throw error;
  return order;
}
const findOrder = (id) => getOrders().find(o => String(o.id).toLowerCase() === String(id).trim().toLowerCase());

/* =================================================================
   LOADING SCREEN — bertema laut
   ================================================================= */
function initLoader() {
  const l = $("#loader");
  if (!l) return;
  const t0 = Date.now();
  window.addEventListener("load", () => {
    const wait = Math.max(0, 900 - (Date.now() - t0));
    setTimeout(() => l.classList.add("hide"), wait);
    setTimeout(() => l.remove(), wait + 800);
  });
  setTimeout(() => l.classList.add("hide"), 3500); // pengaman
}
/* =================================================================
   BACKGROUND FX — gelembung + partikel laut (halus)
   ================================================================= */
function reduceMotionOK() {
  return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function initBgFX() {
  if ($(".bg-fx") || reduceMotionOK()) return;
  const fx = document.createElement("div");
  fx.className = "bg-fx";
  // partikel kecil - 18 -> 10 agar ringan di perangkat lemah
  for (let i = 0; i < 10; i++) {
    const p = document.createElement("span");
    p.className = "part";
    const size = 2 + Math.random() * 3;
    p.style.cssText = `left:${Math.random()*100}%;width:${size}px;height:${size}px;` +
      `--dx:${(Math.random()*120-60).toFixed(0)}px;--o:${(0.15+Math.random()*0.35).toFixed(2)};` +
      `animation-duration:${(9+Math.random()*14).toFixed(1)}s;animation-delay:${(Math.random()*9).toFixed(1)}s;`;
    fx.appendChild(p);
  }
  // gelembung - 8 -> 5 agar ringan di perangkat lemah
  for (let i = 0; i < 5; i++) {
    const b = document.createElement("span");
    b.className = "bubble";
    const size = 8 + Math.random() * 12;
    b.style.cssText = `left:${Math.random()*100}%;width:${size}px;height:${size}px;` +
      `--sway:${(Math.random()*60-30).toFixed(0)}px;animation-duration:${(12+Math.random()*16).toFixed(1)}s;` +
      `animation-delay:${(Math.random()*10).toFixed(1)}s;`;
    fx.appendChild(b);
  }
  document.body.appendChild(fx);
}

/* =================================================================
   NAVBAR & FOOTER — di-inject agar konsisten di semua halaman
   ================================================================= */
const NAV_LINKS = [
  { label: "Home",          href: "index.html",            page: "index" },
  { label: "Layanan",       href: "layanan.html",          page: "layanan" },
  { label: "Harga",         href: "layanan.html#harga" },
  { label: "Cara Order",    href: "index.html#cara-order" },
  { label: "Status Order",  href: "status.html",           page: "status" },
  { label: "FAQ",           href: "faq.html",              page: "faq" },
];
function injectNav() {
  if ($("#siteNav")) return;
  const host = document.createElement("header");
  host.id = "siteNav";
  host.className = "navbar";
  const inner = NAV_LINKS.map(l => {
    const active = l.page === PAGE ? " active" : "";
    return `<li><a href="${l.href}" class="${active.trim()}">${l.label}</a></li>`;
  }).join("");
  host.innerHTML = `
    <div class="container nav-inner">
      <a href="index.html" class="logo" aria-label="J &amp; B JOKI">
        <img class="logo-image" src="logo.png" alt="J &amp; B JOKI">
        <span>J &amp; B <b>JOKI</b></span>
      </a>
      <nav class="nav-scrim" id="navScrim"></nav>
      <ul class="nav-links" id="navLinks">
        ${inner}
        <li class="nav-cta"><a href="login.html?next=order.html" class="btn btn-primary btn-sm"><i class="fa-solid fa-anchor"></i> Order Sekarang</a></li>
      </ul>
      <div class="nav-right">
        <button class="theme-toggle" aria-label="Ganti tema gelap/terang"><i class="fa-solid fa-moon"></i></button>
        <a href="login.html" class="nav-login" aria-label="Masuk"><i class="fa-solid fa-right-to-bracket"></i><span> Masuk</span></a>
        <a href="login.html?next=order.html" class="btn btn-primary btn-sm"><i class="fa-solid fa-anchor"></i> Order Sekarang</a>
        <button class="ham" id="hamBtn" aria-label="Menu"><span></span><span></span><span></span></button>
      </div>
    </div>`;
  document.body.prepend(host);

  const nav = host, scrim = $("#navScrim"), links = $("#navLinks"), ham = $("#hamBtn");
  const toggle = (open) => {
    links.classList.toggle("open", open); scrim.classList.toggle("show", open); ham.classList.toggle("open", open);
  };
  ham.addEventListener("click", () => toggle(!links.classList.contains("open")));
  scrim.addEventListener("click", () => toggle(false));
  links.addEventListener("click", (e) => { if (e.target.tagName === "A") toggle(false); });

  window.addEventListener("scroll", () => nav.classList.toggle("scrolled", window.scrollY > 30), { passive: true });
}
function injectFooter() {
  if ($("#siteFooter")) return;
  const f = document.createElement("footer");
  f.id = "siteFooter";
  f.className = "footer";
  f.innerHTML = `
    <div class="container">
      <div class="footer-grid">
        <div>
          <a href="index.html" class="logo"><img class="logo-image" src="logo.png" alt="J &amp; B JOKI"><span>J &amp; B <b>JOKI</b></span></a>
          <p class="brand-desc">${esc(APPCONFIG.tagline)} Jasa joki premium untuk Fisch &amp; Fish It! — cepat, aman, dan profesional.</p>
          <div class="social">
            <a href="${waLink()}" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fa-brands fa-whatsapp"></i></a>
            <a href="${esc(APPCONFIG.discord)}" target="_blank" rel="noopener" aria-label="Discord"><i class="fa-brands fa-discord"></i></a>
            <a href="https://www.roblox.com" target="_blank" rel="noopener" aria-label="Roblox"><i class="fa-brands fa-roblox"></i></a>
            <a href="#" aria-label="Instagram"><i class="fa-brands fa-instagram"></i></a>
          </div>
        </div>
        <div>
          <h5>Menu</h5>
          <ul>
            <li><a href="index.html">Home</a></li>
            <li><a href="layanan.html">Layanan</a></li>
            <li><a href="layanan.html#harga">Daftar Harga</a></li>
            <li><a href="status.html">Status Order</a></li>
            <li><a href="faq.html">FAQ</a></li>
          </ul>
        </div>
        <div>
          <h5>Layanan Populer</h5>
          <ul>
            <li><a href="login.html?next=order.html">Farming Coins</a></li>
            <li><a href="login.html?next=order.html">Leveling</a></li>
            <li><a href="login.html?next=order.html">Farming Item</a></li>
            <li><a href="login.html?next=order.html">Farming Quest</a></li>
            <li><a href="login.html?next=order.html">Custom Request</a></li>
          </ul>
        </div>
        <div>
          <h5>Kontak</h5>
          <ul class="contact">
            <li><i class="fa-brands fa-whatsapp"></i><span>WhatsApp<br><b style="color:var(--text)">+${APPCONFIG.whatsapp}</b></span></li>
            <li><i class="fa-brands fa-discord"></i><span>Discord<br><b style="color:var(--text)">${APPCONFIG.discordUsers.map(esc).join("<br>")}</b></span></li>
            <li><i class="fa-solid fa-clock"></i><span>Fast Response<br><b style="color:var(--text)">Setiap hari, 09.00–23.00 WIB</b></span></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© <span id="fy"></span> <b>J&B JOKI</b> — All rights reserved.</span>
        <span>Tidak berafiliasi dengan Roblox Corporation.</span>
      </div>
    </div>`;
  document.body.appendChild(f);
  $("#fy").textContent = new Date().getFullYear();
}
/* =================================================================
   REVEAL ON SCROLL + COUNTER STATISTIK
   ================================================================= */
function observeReveals() {
  const els = $$(".reveal:not(.in)");
  if (!("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12 });
  els.forEach(e => io.observe(e));
}
function initCounters() {
  const els = $$("[data-count]:not([data-live-stat])");
  const io = new IntersectionObserver((entries) => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target; io.unobserve(el);
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || "";
      const fast = el.dataset.fast;
      const dur = fast ? 700 : 1600, t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString("id-ID") + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.4 });
  els.forEach(e => io.observe(e));
}

/* =================================================================
   RENDER — statistik, langkah order, layanan, harga
   ================================================================= */
function renderStats() {
  const wrap = $("#statsRow"); if (!wrap) return;
  wrap.innerHTML = STATS.map((s, i) => `
    <div class="stat-card reveal d${i}">
      ${s.fast
        ? `<div class="stat-num" style="font-size:1.7rem">⚡</div>`
        : `<div class="stat-num" ${i < 2 ? `data-live-stat="${i === 0 ? "completed_orders" : "customers"}"` : ""} data-count="${s.num}" data-suffix="${esc(s.suffix)}">0</div>`}
      <div class="stat-lbl">${esc(s.label)}</div>
    </div>`).join("");
  initCounters();
  observeReveals();
}
let publicStatsSubscription = null;
async function refreshPublicStats() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.rpc("get_public_order_stats");
  if (error || !data) return;
  const stats = typeof data === "string" ? JSON.parse(data) : data;
  ["completed_orders", "customers"].forEach(key => {
    const el = $(`[data-live-stat="${key}"]`);
    if (el) el.textContent = `${Number(stats[key] || 0).toLocaleString("id-ID")}+`;
  });
}
function initLiveStats() {
  refreshPublicStats();
  if (!supabaseClient?.channel) return;
  publicStatsSubscription = supabaseClient.channel("public-order-stats")
    .on("broadcast", { event: "stats_updated" }, refreshPublicStats)
    .subscribe();
  // Cadangan jika koneksi WebSocket pelanggan sedang terputus.
  const poller = window.setInterval(refreshPublicStats, 60000);
  window.addEventListener("pagehide", () => {
    window.clearInterval(poller);
    if (publicStatsSubscription) supabaseClient.removeChannel(publicStatsSubscription);
  }, { once: true });
}
function renderProjects() {
  const wrap = $("#projectGrid"); if (!wrap) return;
  wrap.innerHTML = PROJECTS.map((project, i) => `
    <article class="project-card reveal d${i % 3}">
      <div class="project-icon"><i class="fa-solid fa-fish"></i></div>
      <span class="project-tag">${esc(project.category)}</span>
      <h3>${esc(project.title)}</h3>
      <p>${esc(project.description)}</p>
      <div class="project-metric">${esc(project.metrics)}</div>
    </article>`).join("");
  observeReveals();
}
function renderSteps() {
  const wrap = $("#stepsRow"); if (!wrap) return;
  wrap.innerHTML = ORDER_STEPS.map((s, i) => `
    <div class="step reveal d${i % 3}">
      <div class="step-num">${s.n}</div>
      <h4>${s.t}</h4>
      <p>${s.d}</p>
    </div>`).join("");
  observeReveals();
}
function renderServices(game) {
  const wrap = $("#servicesGrid"); if (!wrap) return;
  const meta = GAMES_META[game];
  wrap.innerHTML = getServices(game).map((s, i) => `
    <div class="svc-card reveal d${i % 4}" data-svc="${s.id}" data-game="${game}">
      <div class="svc-ico"><i class="fa-solid ${s.icon}"></i></div>
      <div class="svc-name">${esc(s.name)}</div>
      <p class="svc-desc">${esc(s.desc)}</p>
      <div class="svc-meta">
        <span><i class="fa-regular fa-clock" style="color:var(--cyan);margin-right:.4rem"></i>Estimasi: <b>${esc(s.est)}</b></span>
      </div>
      <div class="svc-price">
        <span class="from">Mulai</span>
        <span class="val">${fmtR(s.price)}</span>
      </div>
      <button class="btn btn-primary btn-block order-btn" data-game="${game}" data-svc="${s.id}">
        <i class="fa-solid fa-anchor"></i> Order
      </button>
    </div>`).join("");
  bindOrderButtons();
  observeReveals();
}
function renderPriceTable(game) {
  const wrap = $("#priceTableWrap"); if (!wrap) return;
  const meta = GAMES_META[game];
  wrap.innerHTML = `
    <div class="price-table reveal">
      <table>
        <thead><tr><th>Layanan (${meta.name})</th><th>Estimasi</th><th>Harga Mulai</th><th></th></tr></thead>
        <tbody>
          ${getServices(game).map(s => `
            <tr>
              <td><b>${esc(s.name)}</b><br><small style="color:var(--muted)">${esc(s.desc)}</small></td>
              <td>${esc(s.est)}</td>
              <td><span class="r">${fmtR(s.price)}</span></td>
              <td><button class="btn btn-ghost btn-sm order-btn" data-game="${game}" data-svc="${s.id}">Pilih</button></td>
            </tr>`).join("")}
        </tbody>
      </table>
    </div>
    <p class="mini-note"><b>*</b> Harga dapat disesuaikan otomatis sesuai besar target &amp; prioritas. ${esc(APPCONFIG.noteLangka)}</p>`;
  bindOrderButtons();
  observeReveals();
}

/* Tab layanan (Fisch / Fish It!) */
let currentGame = "fisch";
function activateGame(game, { scroll = false } = {}) {
  currentGame = game;
  $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.game === game));
  renderServices(game);
  const title = $("#svcTitle"); if (title) {
    const meta = GAMES_META[game];
    title.innerHTML = `<span class="ico" style="background:${game === "fisch" ? "var(--grad-fisch)" : "var(--grad-fishit)"}"><i class="fa-solid ${meta.icon}"></i></span>
      <div><h3>Layanan ${meta.name}</h3><p>Pilih layanan — harga dihitung otomatis sesuai target kamu.</p></div>`;
  }
  const pt = $("#priceTableWrap"); if (pt) renderPriceTable(game);
  if (scroll) $("#layanan").scrollIntoView({ behavior: "smooth" });
}
function bindServiceTabs() {
  const tabs = $("#serviceTabs"); if (!tabs) return;
  tabs.addEventListener("click", (e) => {
    const t = e.target.closest(".tab"); if (!t) return;
    activateGame(t.dataset.game);
  });
}
function bindGameCards() {
  const cards = $$(".game-card"); if (!cards.length) return;
  cards.forEach(c => c.addEventListener("click", () => activateGame(c.dataset.game, { scroll: true })));
}
/* =================================================================
   FORM ORDER — kalkulasi estimasi harga & waktu otomatis
   Dipakai oleh order.html (prefix "") dan modal (prefix "m-")
   ================================================================= */
function fillServiceOptions(prefix, game, keepId) {
  const sel = $("#" + prefix + "service"); if (!sel) return;
  sel.innerHTML = `<option value="">— Pilih Layanan —</option>` +
    getServices(game).map(s => `<option value="${s.id}" ${s.id === keepId ? "selected" : ""}>${esc(s.name)} — mulai ${fmtR(s.price)}</option>`).join("");
}
function recalcEstimate(prefix) {
  const game = $("#" + prefix + "game").value;
  const svcId = $("#" + prefix + "service").value;
  const target = $("#" + prefix + "target").value;
  const prioEl = document.querySelector(`input[name="${prefix}prio"]:checked`);
  const priority = prioEl ? prioEl.value : "normal";
  const quote = calcQuote(game, svcId, target, priority);

  const priceEl = $("#" + prefix + "estPrice"); if (!priceEl) return;
  const svcName = quote ? quote.svc.name : "";
  const gameName = game ? GAMES_META[game].name : "";
  const timeEl = $("#" + prefix + "estTime");
  const listEl = $("#" + prefix + "detailsList");

  if (!quote) {
    priceEl.textContent = "—";
    timeEl.textContent = "—";
    listEl.innerHTML = `<li>Lengkapi pilihan game & layanan untuk melihat estimasi.</li>`;
    return;
  }
  priceEl.textContent = fmtR(quote.price);
  timeEl.textContent = quote.time;
  listEl.innerHTML = `
    <li><span>Game</span><b>${esc(gameName)}</b></li>
    <li><span>Layanan</span><b>${esc(svcName)}</b></li>
    <li><span>Target</span><b>${esc(target || "—")}</b></li>
    <li><span>Prioritas</span><b>${priority === "express" ? "Express ⚡ (x" + APPCONFIG.expressMultiplier + ")" : "Normal"}</b></li>`;
}
function bindOrderForm(prefix) {
  const form = $("#" + prefix + "orderForm"); if (!form) return;
  const gameSel = $("#" + prefix + "game");
  const svcSel = $("#" + prefix + "service");

  gameSel.addEventListener("change", () => fillServiceOptions(prefix, gameSel.value, ""));
  svcSel.addEventListener("change", () => recalcEstimate(prefix));
  $("#" + prefix + "target").addEventListener("input", () => recalcEstimate(prefix));
  $$(`input[name="${prefix}prio"]`).forEach(r => {
    r.addEventListener("change", () => {
      $$(`input[name="${prefix}prio"]`).forEach(x => x.closest(".prio-card").classList.toggle("on", x.checked));
      recalcEstimate(prefix);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) { redirectToCustomerLogin(); return; }
    if (!validateForm(prefix)) { toast("Mohon lengkapi data yang wajib diisi dengan benar.", "err"); return; }
    const data = {
      game: gameSel.value,
      gameName: GAMES_META[gameSel.value].name,
      service: svcSel.value,
      serviceName: getServices(gameSel.value).find(s => s.id === svcSel.value).name,
      target: $("#" + prefix + "target").value.trim(),
      username: $("#" + prefix + "user").value.trim(),
      detail: ($("#" + prefix + "detail").value || "").trim(),
      priority: ($(`input[name="${prefix}prio"]:checked`).value === "express") ? "Express" : "Normal",
      priorityKey: $(`input[name="${prefix}prio"]:checked`).value,
    };
    const quote = calcQuote(data.game, data.service, data.target, data.priorityKey);
    data.price = quote.price;
    data.est = quote.time;
    let order;
    try {
      order = await createOrder(data);
    } catch (err) {
      console.error(err);
      const detail = err?.message ? ` (${esc(err.message)})` : "";
      toast("Order belum tersimpan" + detail, "err", 9000);
      return;
    }

    const modal = $("#orderModal");
    if (modal) { modal.classList.remove("open"); document.body.style.overflow = ""; }
    form.reset();
    $$(`input[name="${prefix}prio"]`).forEach(r => { if (r.value === "normal") r.checked = true; r.closest(".prio-card").classList.toggle("on", r.value === "normal"); });
    recalcEstimate(prefix);
    toast("Order berhasil dibuat! 🎉 Order ID: " + order.id, "ok", 5200);
    showSuccess(order);
  });
}
function validateForm(prefix) {
  let ok = true;
  const check = (id, emptyMsg, extraTest) => {
    const el = $("#" + prefix + id), f = el.closest(".field");
    const bad = !el.value.trim() || (extraTest && !extraTest(el.value.trim()));
    if (bad) { f.classList.add("bad"); ok = false; } else f.classList.remove("bad");
    return !bad;
  };
  check("game", ""); check("service", "");
  check("target", "Target wajib diisi.");
  check("user", "Username Roblox wajib diisi.", (v) => /^[A-Za-z0-9_.]{3,20}$/.test(v));
  if ($("#" + prefix + "user").closest(".field").classList.contains("bad"))
    toast("Username Roblox harus 3–20 karakter (huruf, angka, _ atau .).", "err");
  if (!$(`input[name="${prefix}prio"]:checked`)) { ok = false; }
  return ok;
}
function showSuccess(order) {
  let m = $("#successModal");
  if (!m) {
    m = document.createElement("div");
    m.id = "successModal"; m.className = "modal";
    m.innerHTML = `
      <div class="modal-card" style="max-width:460px;text-align:center">
        <div class="modal-head"><h3><i class="fa-solid fa-circle-check" style="color:var(--green)"></i> Order Dibuat!</h3>
          <button class="modal-x" data-close="successModal"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="modal-body">
          <div style="font-size:3rem;margin-bottom:.6rem">🎣</div>
          <p style="color:var(--muted)">Simpan Order ID berikut untuk mengecek status:</p>
          <div style="font-family:var(--font-head);font-size:1.6rem;font-weight:900;letter-spacing:2px;background:linear-gradient(120deg,#00d4ff,#a855f7);-webkit-background-clip:text;background-clip:text;color:transparent;margin:.8rem 0" id="succId"></div>
          <p style="color:var(--muted);font-size:.93rem">Instruksi pembayaran akan dikirim ke Customer Service.<br>Pembayaran: <b style="color:var(--gold)">${esc(APPCONFIG.acceptedPayments)}</b></p>
          <div class="prio-grid" style="margin-top:1.2rem">
            <a href="status.html?id=${order.id}&token=${order.trackingToken}" class="btn btn-primary"><i class="fa-solid fa-magnifying-glass"></i> Cek Status</a>
            <a href="#" class="btn btn-ghost" data-close="successModal">Tutup</a>
          </div>
        </div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener("click", (e) => {
      const closer = e.target === m || e.target.closest("[data-close]");
      if (closer) { e.preventDefault(); m.classList.remove("open"); document.body.style.overflow = ""; }
    });
  }
  $("#succId").textContent = order.id;
  m.classList.add("open");
  document.body.style.overflow = "hidden";
}
/* =================================================================
   MODAL ORDER — digunakan di halaman index & layanan
   ================================================================= */
const MODAL_TMPL = `
 <div class="modal" id="orderModal">
    <div class="modal-card">
      <div class="modal-head">
        <h3><i class="fa-solid fa-anchor" style="color:var(--cyan)"></i> Buat Order</h3>
        <button class="modal-x" data-close="orderModal"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="modal-body">
        <form id="m-orderForm" class="form-grid" novalidate>
          <div class="field full">
            <label>Pilih Game<b>*</b></label>
            <select class="sel" id="m-game" required>
              <option value="">— Pilih Game —</option>
              <option value="fisch">🐟 Fisch</option>
              <option value="fishit">🎣 Fish It!</option>
            </select>
            <span class="err">Pilih game terlebih dahulu.</span>
          </div>
          <div class="field full">
            <label>Pilih Layanan<b>*</b></label>
            <select class="sel" id="m-service" required><option value="">— Pilih Layanan —</option></select>
            <span class="err">Pilih layanan yang diinginkan.</span>
          </div>
          <div class="field full">
            <label>Target Kamu<b>*</b></label>
            <input class="inp" id="m-target" placeholder="Contoh: 1.000.000 coins / Level 75 / ikan langka tertentu" required>
            <span class="err">Tulis target kamu — jumlah atau nama target.</span>
          </div>
          <div class="field full">
            <label>Username Roblox<b>*</b></label>
            <input class="inp" id="m-user" placeholder="Username kamu di Roblox" required autocomplete="off">
            <span class="err">Username Roblox 3–20 karakter (huruf, angka, _ atau .)</span>
          </div>
          <div class="field full">
            <label>Detail Tambahan</label>
            <textarea class="area" id="m-detail" placeholder="Catatan tambahan, misal: warna rod, preferensi area, dll (opsional)"></textarea>
          </div>
          <div class="field full">
            <label>Prioritas<b>*</b></label>
            <div class="prio-grid" id="m-prio">
              <label class="prio-card on">
                <input type="radio" name="m-prio" value="normal" checked>
                <span class="pi"><i class="fa-solid fa-clock"></i></span>
                <span><b>Normal</b><small>Estimasi waktu standar.</small></span>
              </label>
              <label class="prio-card">
                <input type="radio" name="m-prio" value="express">
                <span class="pi"><i class="fa-solid fa-bolt"></i></span>
                <span><b>Express</b><small>Lebih cepat — harga x${APPCONFIG.expressMultiplier}.</small></span>
              </label>
            </div>
          </div>
          <div class="field full">
            <div class="est-panel">
              <div class="est-price">
                <span class="lbl">Estimasi Harga</span>
                <span class="num" id="m-estPrice">—</span>
              </div>
              <div class="est-row"><span class="k">Estimasi Waktu</span><span class="v" id="m-estTime">—</span></div>
              <div class="est-row"><span class="k">Detail Pesanan</span></div>
              <ul id="m-detailsList" style="list-style:none;display:flex;flex-direction:column;gap:.35rem;font-size:.92rem;color:var(--muted)">
                <li>Lengkapi pilihan game &amp; layanan.</li>
              </ul>
            </div>
          </div>
          <div class="field full">
            <div class="warn-box"><i class="fa-solid fa-triangle-exclamation"></i>
              <span>Jangan pernah memberikan <b>password akun</b> kepada siapa pun. Kami tidak akan pernah memintanya.</span>
            </div>
          </div>
          <div class="field full">
            <button type="submit" class="btn btn-primary btn-block" style="padding:1rem"><i class="fa-solid fa-paper-plane"></i> Buat Order</button>
          </div>
        </form>
      </div>
    </div>
 </div>`;
function ensureOrderModal() {
  if ($("#orderModal")) return;
  document.body.insertAdjacentHTML("beforeend", MODAL_TMPL);
  const m = $("#orderModal");
  m.addEventListener("click", (e) => {
    const closer = e.target === m || e.target.closest("[data-close]");
    if (closer) { e.preventDefault(); m.classList.remove("open"); document.body.style.overflow = ""; }
  });
  bindOrderForm("m-");
}
function redirectToCustomerLogin() {
  if (location.pathname.endsWith("/login.html")) return;
  const url = new URL("login.html", location.href);
  url.searchParams.set("next", "order.html");
  location.href = url.href;
}
async function requireCustomerLogin() {
  if (location.pathname.endsWith("/login.html")) return true;
  if (!supabaseClient) {
    toast("Koneksi login belum tersedia. Silakan coba lagi.", "err");
    return false;
  }
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) return true;
  redirectToCustomerLogin();
  return false;
}
async function openOrderModal(game, svcId) {
  if (!await requireCustomerLogin()) return;
  ensureOrderModal();
  const m = $("#orderModal");
  $("#m-game").value = game || "";
  fillServiceOptions("m-", game || "fisch", svcId || "");
  recalcEstimate("m-");
  m.classList.add("open");
  document.body.style.overflow = "hidden";
}
function bindOrderButtons() {
  $$(".order-btn").forEach(b => b.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();
    openOrderModal(b.dataset.game, b.dataset.svc);
  }));
}

/* =================================================================
   FAQ + TESTIMONI
   ================================================================= */
function renderFaqs(list) {
  if (!list) return;
  list.innerHTML = getFaqs().map((f, i) => `
    <div class="faq-item reveal d${i % 3}">
      <button class="faq-q" type="button">
        <span class="qi"><i class="fa-solid fa-circle-question"></i></span>
        <span style="flex:1">${esc(f.q)}</span>
        <i class="fa-solid fa-chevron-down chev"></i>
      </button>
      <div class="faq-a"><div class="faq-a-inner">${esc(f.a)}</div></div>
    </div>`).join("");
  list.addEventListener("click", (e) => {
    const q = e.target.closest(".faq-q"); if (!q) return;
    const item = q.parentElement;
    const open = item.classList.contains("open");
    $$(".faq-item.open", list).forEach(i => i.classList.remove("open"));
    if (!open) item.classList.add("open");
  });
  observeReveals();
}
function renderTestis() {
  const wrap = $("#testiGrid"); if (!wrap) return;
  wrap.innerHTML = getTestis().map((t, i) => {
    const meta = GAMES_META[t.game];
    const stars = "★".repeat(t.star) + "☆".repeat(5 - t.star);
    return `
      <div class="testi-card reveal d${i % 3}">
        <div class="testi-top">
          <div class="avatar av-${(i % 6) + 1}">${esc(t.name.slice(0, 2).toUpperCase())}</div>
          <div>
            <div class="uname">${esc(t.name)}</div>
            <div class="ugame"><span class="game-chip ${meta.chip}"><i class="fa-solid ${meta.icon}"></i>${meta.name}</span></div>
          </div>
        </div>
        <div class="stars" title="${t.star}/5">${stars}</div>
        <div class="review">${esc(t.review)}</div>
      </div>`;
  }).join("");
  observeReveals();
}
/* =================================================================
   HALAMAN STATUS — cek order via Order ID + timeline progres
   ================================================================= */
function statusTimelineHTML(status) {
  const flow = 5; // langkah progres normal (0..4); index 5 = dibatalkan
  const labels = ORDER_STATUS.slice(0, flow);
  const cur = status === 5 ? 0 : Math.min(status, flow); // order dibatalkan => semua step netral
  const html = labels.map((lbl, i) => {
    const cls = i < cur ? "done" : (i === cur && status < flow ? "cur" : "");
    return `<div class="tl-step ${cls}">
      <span class="tl-dot"><i class="fa-solid ${i < cur ? "fa-check" : STATUS_ICONS[i]}"></i></span>
      <div class="tl-lbl">${lbl}</div>
    </div>`;
  }).join("");
  const cancel = status === 5
    ? `<div class="tl-step cancel-led"><span class="tl-dot" style="background:var(--red);border-color:transparent;color:#fff"><i class="fa-solid fa-circle-xmark"></i></span><div class="tl-lbl" style="color:var(--red)">Dibatalkan</div></div>`
    : "";
  return `<div class="tl">${html}${cancel}</div>`;
}
let statusSubscription = null;
let ratingCountdown = null;
let orderChatSubscription = null;

function stopStatusWatcher() {
  if (statusSubscription) supabaseClient?.removeChannel(statusSubscription);
  statusSubscription = null;
  if (ratingCountdown) window.clearInterval(ratingCountdown);
  ratingCountdown = null;
}

function chatPanelHTML(orderId, role) {
  return `<section class="order-chat" id="orderChat" data-order="${esc(orderId)}" data-role="${role}">
    <div class="chat-head"><span><i class="fa-solid fa-comments"></i> Chat Order</span><small>Order #${esc(orderId)} · Real-time</small></div>
    <div class="chat-list" id="chatList"><div class="chat-empty">Memuat percakapan…</div></div>
    <form class="chat-form" id="chatForm">
      <textarea class="area" id="chatInput" maxlength="1000" required placeholder="Tulis pesan untuk ${role === "admin" ? "pelanggan" : "admin"}…"></textarea>
      <button class="btn btn-primary btn-sm" type="submit"><i class="fa-solid fa-paper-plane"></i> Kirim</button>
    </form>
  </section>`;
}
function chatMessageHTML(message, role) {
  const own = message.sender === role;
  return `<div class="chat-message ${own ? "own" : ""}"><small>${message.sender === "admin" ? "Admin" : "Customer"} · ${new Date(message.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</small><div>${esc(message.body)}</div></div>`;
}
function renderChatMessages(messages, role) {
  const list = $("#chatList"); if (!list) return;
  list.innerHTML = messages.length ? messages.map(m => chatMessageHTML(m, role)).join("") : `<div class="chat-empty">Belum ada pesan. Mulai chat untuk Order #${esc($("#orderChat")?.dataset.order || "")}.</div>`;
  list.scrollTop = list.scrollHeight;
}
async function initOrderChat(order, token, role) {
  if (orderChatSubscription) { supabaseClient?.removeChannel(orderChatSubscription); orderChatSubscription = null; }
  const getRpc = role === "admin" ? "get_admin_order_messages" : "get_order_messages";
  const args = role === "admin" ? { p_id: order.id } : { p_id: order.id, p_tracking_token: token };
  const { data, error } = await supabaseClient.rpc(getRpc, args);
  if (error) { renderChatMessages([], role); return; }
  renderChatMessages(data || [], role);
  const channelName = `order-chat:${order.id}:${token}`;
  orderChatSubscription = supabaseClient.channel(channelName)
    .on("broadcast", { event: "new_message" }, ({ payload }) => {
      const list = $("#chatList"); if (!list) return;
      list.insertAdjacentHTML("beforeend", chatMessageHTML(payload, role)); list.scrollTop = list.scrollHeight;
    }).subscribe();
  const form = $("#chatForm"); if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("#chatInput"), body = input.value.trim(); if (!body) return;
    const sendRpc = role === "admin" ? "send_admin_order_message" : "send_customer_order_message";
    const sendArgs = role === "admin" ? { p_id: order.id, p_body: body } : { p_id: order.id, p_tracking_token: token, p_body: body };
    const { error: sendError } = await supabaseClient.rpc(sendRpc, sendArgs);
    if (sendError) { toast(sendError.message || "Pesan gagal dikirim.", "err"); return; }
    input.value = "";
  });
}

function ratingPanelHTML(order) {
  if (order.status !== 4 || !order.completedAt) return "";
  if (order.rating) return `<div class="rating-panel submitted"><i class="fa-solid fa-heart"></i><span>Terima kasih! Penilaian kamu <b>${order.rating}/5</b> sudah diterima.</span></div>`;
  const expiresAt = new Date(order.completedAt).getTime() + 10 * 60 * 1000;
  if (Date.now() >= expiresAt) return `<div class="rating-panel expired"><i class="fa-solid fa-clock"></i><span>Waktu untuk memberi penilaian sudah berakhir.</span></div>`;
  return `<form class="rating-panel" id="ratingForm">
    <div class="rating-heading"><i class="fa-solid fa-star"></i><span><b>Bagaimana pesananmu?</b><small>Penilaian tersedia selama <strong id="ratingTimer"></strong>.</small></span></div>
    <div class="rating-stars" role="group" aria-label="Pilih nilai">
      ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="rating-star" data-rating="${n}" aria-label="${n} bintang"><i class="fa-regular fa-star"></i></button>`).join("")}
    </div>
    <textarea class="area" id="ratingReview" maxlength="500" placeholder="Tulis pengalaman kamu (opsional)"></textarea>
    <button class="btn btn-primary btn-sm" type="submit" disabled id="ratingSubmit"><i class="fa-solid fa-paper-plane"></i> Kirim Penilaian</button>
  </form>`;
}

function bindRatingForm(order, token) {
  const form = $("#ratingForm"); if (!form) return;
  const expiresAt = new Date(order.completedAt).getTime() + 10 * 60 * 1000;
  let rating = 0;
  const refreshTimer = () => {
    const left = expiresAt - Date.now();
    const timer = $("#ratingTimer");
    if (left <= 0) { stopStatusWatcher(); renderStatus(order.id, token, { watch: true }); return; }
    const min = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
    if (timer) timer.textContent = `${min}:${String(sec).padStart(2, "0")} menit lagi`;
  };
  refreshTimer();
  ratingCountdown = window.setInterval(refreshTimer, 1000);
  $$(".rating-star", form).forEach(btn => btn.addEventListener("click", () => {
    rating = +btn.dataset.rating;
    $$(".rating-star", form).forEach(b => {
      const on = +b.dataset.rating <= rating;
      b.classList.toggle("on", on); b.innerHTML = `<i class="fa-${on ? "solid" : "regular"} fa-star"></i>`;
    });
    $("#ratingSubmit").disabled = false;
  }));
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = $("#ratingSubmit"); submit.disabled = true;
    const { error } = await supabaseClient.rpc("submit_order_rating", {
      p_id: order.id, p_tracking_token: token, p_rating: rating,
      p_review: $("#ratingReview").value.trim(),
    });
    if (error) { toast(error.message.includes("10 menit") ? error.message : "Penilaian tidak dapat dikirim. Coba lagi.", "err"); submit.disabled = false; return; }
    toast("Terima kasih atas penilaianmu!", "ok");
    renderStatus(order.id, token, { watch: true });
  });
}

function watchOrderStatus(id, token) {
  if (!supabaseClient?.channel) return;
  statusSubscription = supabaseClient.channel(`order-status:${id}:${token}`)
    .on("broadcast", { event: "status_updated" }, () => renderStatus(id, token, { watch: true }))
    .subscribe();
  // Cadangan bila Realtime belum diaktifkan di proyek Supabase.
  const poller = window.setInterval(() => renderStatus(id, token, { watch: false }), 15000);
  window.addEventListener("pagehide", () => window.clearInterval(poller), { once: true });
}

async function renderStatus(id, token, { watch = false } = {}) {
  if (ratingCountdown) { window.clearInterval(ratingCountdown); ratingCountdown = null; }
  if (orderChatSubscription) { supabaseClient?.removeChannel(orderChatSubscription); orderChatSubscription = null; }
  const card = $("#statusCard");
  card.classList.remove("show");
  if (!supabaseClient || !token) {
    $("#statusBody").innerHTML = `<div class="empty"><i class="fa-solid fa-key"></i>Gunakan tautan status yang diberikan setelah order dibuat.</div>`;
    card.classList.add("show");
    return;
  }
  const { data, error } = await supabaseClient.rpc("get_order_status", { p_id: id, p_tracking_token: token });
  const row = !error && data && data[0];
  const order = row && {
    id: row.id, gameName: row.game_name, serviceName: row.service_name, target: row.target,
    priority: row.priority, price: row.price, est: row.est, status: row.status,
    createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at,
    rating: row.rating, ratingReview: row.rating_review,
  };
  if (!order) {
    $("#statusBody").innerHTML = `
      <div class="empty"><i class="fa-solid fa-fish"></i>Order ID <b style="color:var(--cyan)">${esc(id)}</b> tidak ditemukan.<br>
      Periksa kembali Order ID kamu, atau hubungi customer service.</div>`;
    card.classList.add("show");
    return;
  }
  const s = order.status;
  const meta = Object.values(GAMES_META).find(x => x.name === order.gameName) || GAMES_META.fisch;
  $("#statusBody").innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between">
      <div>
        <div class="status-id">${esc(order.id)}</div>
        <div style="color:var(--muted);font-size:.9rem">Dibuat: ${new Date(order.createdAt).toLocaleString("id-ID")}</div>
      </div>
      <span class="badge s${s}"><i class="fa-solid ${STATUS_ICONS[s]}"></i> ${ORDER_STATUS[s]}</span>
    </div>
    <div class="detail-grid">
      <div class="detail-cell"><div class="k">Game</div><div class="v"><span class="game-chip ${meta.chip}"><i class="fa-solid ${meta.icon}"></i>${meta.name}</span></div></div>
      <div class="detail-cell"><div class="k">Layanan</div><div class="v">${esc(order.serviceName)}</div></div>
      <div class="detail-cell"><div class="k">Target</div><div class="v">${esc(order.target)}</div></div>
      <div class="detail-cell"><div class="k">Prioritas</div><div class="v">${esc(order.priority)}</div></div>
      <div class="detail-cell"><div class="k">Estimasi Harga</div><div class="v" style="color:var(--cyan)">${fmtR(order.price)}</div></div>
    </div>
    ${order.detail ? `<div style="margin-top:1rem;color:var(--muted);font-size:.95rem;background:var(--soft-bg);border:1px solid var(--stroke);border-radius:14px;padding:.9rem 1rem"><b>Detail tambahan:</b> ${esc(order.detail)}</div>` : ""}
    <div style="margin-top:1.4rem;font-family:var(--font-head);font-size:.72rem;letter-spacing:2px;text-transform:uppercase;color:var(--muted-2)">Progres Order</div>
    ${statusTimelineHTML(s)}
    ${s === 5 ? `<div class="cancel-banner"><i class="fa-solid fa-circle-xmark"></i><span>Order ini <b>dibatalkan</b>. Hubungi customer service bila ada kendala pembayaran.</span></div>` : ""}
    ${s === 0 ? `<div class="pay-note"><i class="fa-solid fa-hand-holding-dollar" style="margin-right:.5rem"></i>Order menunggu pembayaran. Bayar melalui <b>${esc(APPCONFIG.acceptedPayments)}</b> lalu kirim bukti ke customer service untuk konfirmasi.</div>` : ""}
    ${s >= 0 && s <= 3 ? chatPanelHTML(order.id, "customer") : ""}
    ${s === 4 ? `<div class="pay-note" style="border-color:rgba(52,211,153,.35);background:rgba(52,211,153,.08);color:var(--green)"><i class="fa-solid fa-circle-check" style="margin-right:.5rem"></i>Order <b>selesai</b>! Terima kasih telah menggunakan J&B JOKI.</div>${ratingPanelHTML(order)}` : ""}`;
  card.classList.add("show");
  bindRatingForm(order, token);
  if (s >= 0 && s <= 3) initOrderChat(order, token, "customer");
  if (watch && !statusSubscription) watchOrderStatus(id, token);
}
function initStatusPage() {
  const form = $("#statusForm"); if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const id = $("#statusId").value.trim();
    if (!id) { toast("Masukkan Order ID terlebih dahulu.", "err"); return; }
    stopStatusWatcher();
    renderStatus(id, $("#statusToken").value.trim(), { watch: true });
  });
  const params = new URLSearchParams(location.search);
  const url = params.get("id"), token = params.get("token");
  if (url && token) { $("#statusId").value = url; $("#statusToken").value = token; renderStatus(url, token, { watch: true }); }
}
/* =================================================================
   ADMIN — Login
   ================================================================= */
function initAdminLogin() {
  const form = $("#loginForm"); if (!form) return;
  const reason = new URLSearchParams(location.search).get("error");
  if (reason === "access") toast("Akun ini belum diberi hak admin. Jalankan query admin di Supabase.", "err", 6000);
  if (reason === "session") toast("Sesi login tidak ditemukan. Silakan login kembali.", "err");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: $("#loginEmail").value.trim(), password: $("#loginPass").value,
    });
    if (error) { toast("Email atau password admin salah.", "err"); return; }
    location.href = "dashboard.html";
  });
}
function getLoginDestination() {
  const next = new URLSearchParams(location.search).get("next") || "order.html";
  return /^[a-z0-9_-]+\.html(?:#[a-z0-9_-]+)?$/i.test(next) && !next.startsWith("admin/") ? next : "order.html";
}
async function initCustomerLogin() {
  const button = $("#googleLoginBtn");
  if (!button) return;
  if (!supabaseClient) {
    button.disabled = true;
    toast("Konfigurasi login belum tersedia.", "err", 7000);
    return;
  }
  const destination = getLoginDestination();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) { location.replace(destination); return; }
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menghubungkan ke Google...';
    const redirectTo = new URL(`login.html?next=${encodeURIComponent(destination)}`, location.href).href;
    const { error } = await supabaseClient.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      button.disabled = false;
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v4.1h5.7c-.25 1.32-1.76 3.88-5.7 3.88A6.19 6.19 0 1 1 12 5.81c2.24 0 3.75.96 4.61 1.79l3.14-3.05C17.74 2.67 15.13 1.5 12 1.5A10.5 10.5 0 1 0 22.5 12c0-.7-.08-1.22-.17-1.8H12Z"/></svg> Lanjutkan dengan Google';
      toast("Login Google gagal: " + esc(error.message), "err", 9000);
    }
  });
}
async function guardAdmin() {
  if (!supabaseClient) {
    toast("Koneksi login admin belum tersedia.", "err");
    return false;
  }
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.user) {
    const url = new URL("login.html", location.href);
    url.searchParams.set("error", "session");
    location.replace(url.href);
    return false;
  }
  const { data, error } = await supabaseClient.from("admin_users").select("user_id", { head: false }).eq("user_id", session.user.id).maybeSingle();
  if (error || !data) {
    await supabaseClient.auth.signOut();
    const url = new URL("login.html", location.href);
    url.searchParams.set("error", "access");
    location.replace(url.href);
    return false;
  }
  return true;
}

/* =================================================================
   ADMIN — Dashboard
   ================================================================= */
const VIEWS = ["dash", "orders", "services", "faq", "testi"];

function adminStats() {
  const orders = getOrders();
  const total = orders.length;
  const active = orders.filter(o => o.status === 3).length;
  const done = orders.filter(o => o.status === 4).length;
  const pending = orders.filter(o => o.status === 0).length;
  const cfg = [
    { ic: "fa-layer-group", bg: "linear-gradient(135deg,#0ea5e9,#2563eb)", glow: "rgba(0,212,255,.16)", n: total, t: "Total Order" },
    { ic: "fa-gear",        bg: "linear-gradient(135deg,#8b5cf6,#d946ef)", glow: "rgba(139,92,246,.16)", n: active, t: "Order Aktif" },
    { ic: "fa-circle-check",bg: "linear-gradient(135deg,#10b981,#059669)", glow: "rgba(52,211,153,.16)", n: done, t: "Order Selesai" },
    { ic: "fa-hourglass-half",bg: "linear-gradient(135deg,#f59e0b,#ea580c)", glow: "rgba(251,191,36,.16)", n: pending, t: "Order Pending" },
  ];
  $("#statGrid").innerHTML = cfg.map(c => `
    <div class="a-stat" style="--glow-a:${c.glow}">
      <div class="ic" style="background:${c.bg}"><i class="fa-solid ${c.ic}"></i></div>
      <div class="n">${c.n}</div><div class="t">${c.t}</div>
    </div>`).join("");
  $("#dashRecent").innerHTML = orders.length
    ? orders.slice(0, 6).map(o => orderRow(o, true)).join("")
    : `<tr><td colspan="7"><div class="empty"><i class="fa-solid fa-fish"></i>Belum ada order. Order dari sisi customer akan muncul di sini.</div></td></tr>`;
  bindStatusSelects();
  bindAdminChatButtons();
}
function orderRow(o, recent) {
  const meta = GAMES_META[o.game];
  const opts = ORDER_STATUS.map((s, i) => `<option value="${i}" ${i === o.status ? "selected" : ""}>${s}</option>`).join("");
  return `
    <tr data-id="${o.id}">
      <td><span class="td-id">${esc(o.id)}</span><br><small style="color:var(--muted-2)">${new Date(o.createdAt).toLocaleString("id-ID")}</small></td>
      <td><span class="game-chip ${meta.chip}"><i class="fa-solid ${meta.icon}"></i>${meta.name}</span><br><small style="color:var(--muted)">${esc(o.serviceName)}</small></td>
      <td>${esc(o.target)}</td>
      <td>${esc(o.username)}</td>
      <td>${esc(o.priority)}<br><small style="color:var(--muted-2)">${fmtR(o.price)}</small></td>
      <td><select class="sel st-sel" data-id="${o.id}">${opts}</select></td>
      <td class="a-actions">
        ${o.status >= 0 && o.status <= 3 ? `<button class="icon-btn green chat-order" data-id="${o.id}" title="Chat Order"><i class="fa-solid fa-comments"></i></button>` : ""}
        ${recent ? "" : `<button class="icon-btn red del-order" data-id="${o.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>`}
      </td>
    </tr>`;
}
function renderOrdersTable() {
  const orders = getOrders();
  $("#ordersBody").innerHTML = orders.length
    ? orders.map(o => orderRow(o, false)).join("")
    : `<tr><td colspan="7"><div class="empty"><i class="fa-solid fa-fish"></i>Belum ada order.</div></td></tr>`;
  bindStatusSelects();
  bindDelOrders();
  bindAdminChatButtons();
}
function bindAdminChatButtons() {
  $$(".chat-order").forEach(btn => btn.addEventListener("click", () => {
    const order = getOrders().find(o => o.id === btn.dataset.id);
    if (order) openAdminOrderChat(order);
  }));
}
function openAdminOrderChat(order) {
  let modal = $("#adminChatModal");
  if (!modal) {
    modal = document.createElement("div"); modal.id = "adminChatModal"; modal.className = "modal";
    document.body.appendChild(modal);
  }
  modal.innerHTML = `<div class="modal-card"><div class="modal-head"><h3><i class="fa-solid fa-comments" style="color:var(--cyan)"></i> Chat Order #${esc(order.id)}</h3><button class="modal-x" data-close="adminChatModal"><i class="fa-solid fa-xmark"></i></button></div><div class="modal-body">${chatPanelHTML(order.id, "admin")}</div></div>`;
  modal.classList.add("open"); document.body.style.overflow = "hidden";
  $("[data-close=adminChatModal]", modal).addEventListener("click", () => {
    modal.classList.remove("open"); document.body.style.overflow = "";
    if (orderChatSubscription) { supabaseClient?.removeChannel(orderChatSubscription); orderChatSubscription = null; }
  });
  initOrderChat(order, order.trackingToken, "admin");
}
function bindStatusSelects() {
  $$(".st-sel").forEach(sel => sel.addEventListener("change", async () => {
    const orders = getOrders();
    const o = orders.find(x => x.id === sel.dataset.id);
    if (!o) return;
    const status = +sel.value;
    const { error } = await supabaseClient.from("orders").update({ status, updated_at: new Date().toISOString() }).eq("id", o.id);
    if (error) { toast("Status gagal diperbarui.", "err"); sel.value = o.status; return; }
    o.status = status; o.updatedAt = new Date().toISOString();
    toast(`Status ${o.id} diupdate → ${ORDER_STATUS[o.status]}.`, "ok");
    adminStats(); renderOrdersTable();
  }));
}
function bindDelOrders() {
  $$(".del-order").forEach(b => b.addEventListener("click", async () => {
    const id = b.dataset.id;
    if (!confirm("Hapus order " + id + "?")) return;
    const { error } = await supabaseClient.from("orders").delete().eq("id", id);
    if (error) { toast("Order gagal dihapus.", "err"); return; }
    adminOrders = adminOrders.filter(o => o.id !== id);
    toast("Order dihapus.", "ok");
    adminStats(); renderOrdersTable();
  }));
}
/* ---------- Admin: kelola layanan & harga ---------- */
let editSvcTarget = null; // {game, id} saat mode edit
function renderServicesAdmin() {
  const wrap = $("#svcAdminList"); if (!wrap) return;
  wrap.innerHTML = Object.keys(GAMES_META).map((game, gi) => {
    const meta = GAMES_META[game];
    const rows = getServices(game).map(s => `
      <tr data-game="${game}" data-svc="${s.id}">
        <td><i class="fa-solid ${s.icon}" style="color:var(--cyan);margin-right:.5rem"></i>${esc(s.name)}</td>
        <td style="color:var(--muted);max-width:320px;font-size:.9rem">${esc(s.desc)}</td>
        <td>${esc(s.est)}</td>
        <td class="td-id">${fmtR(s.price)}</td>
        <td class="a-actions">
          <button class="icon-btn green edit-svc" data-game="${game}" data-svc="${s.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn red del-svc" data-game="${game}" data-svc="${s.id}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`).join("");
    return `
      <div class="panel fade-in">
        <div class="panel-head">
          <h3><i class="fa-solid ${meta.icon}" style="color:var(--cyan)"></i> Layanan ${meta.name} &amp; Harga</h3>
          <button class="btn btn-primary btn-sm add-svc" data-game="${game}"><i class="fa-solid fa-plus"></i> Tambah Layanan</button>
        </div>
        <div class="table-wrap"><table class="a-table" style="min-width:760px">
          <thead><tr><th>Layanan</th><th>Deskripsi</th><th>Estimasi</th><th>Harga Mulai</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
  }).join("");

  $$(".add-svc").forEach(b => b.addEventListener("click", () => openSvcModal(b.dataset.game)));
  $$(".edit-svc").forEach(b => b.addEventListener("click", () => {
    const svc = getServices(b.dataset.game).find(s => s.id === b.dataset.svc);
    openSvcModal(b.dataset.game, svc);
  }));
  $$(".del-svc").forEach(b => b.addEventListener("click", () => {
    const game = b.dataset.game, id = b.dataset.svc;
    const svc = getServices(game).find(s => s.id === id);
    if (!confirm(`Hapus layanan "${svc.name}"?`)) return;
    const ov = store.get(KEY.svc, {});
    ov[game] = getServices(game).filter(s => s.id !== id);
    store.set(KEY.svc, ov);
    toast("Layanan dihapus.", "ok"); renderServicesAdmin();
  }));
}
function openSvcModal(game, svc) {
  editSvcTarget = svc ? { game, id: svc.id } : null;
  const m = $("#svcModal");
  $("#svcForm").reset();
  $("#svcGame").value = game;
  $("#svcModalTitle").innerHTML = svc ? "Edit Layanan" : "Tambah Layanan";
  if (svc) {
    $("#svcName").value = svc.name; $("#svcIcon").value = svc.icon;
    $("#svcDesc").value = svc.desc; $("#svcEst").value = svc.est; $("#svcPrice").value = svc.price;
  }
  m.classList.add("open"); document.body.style.overflow = "hidden";
}
function bindSvcModal() {
  const form = $("#svcForm"); if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const game = $("#svcGame").value;
    const ov = store.get(KEY.svc, {});
    const list = (ov[game] && ov[game].length) ? ov[game] : SERVICES[game];
    const data = {
      name: $("#svcName").value.trim(),
      icon: $("#svcIcon").value.trim().replace(/^fa-solid\s+/i, "") || "fa-fish",
      desc: $("#svcDesc").value.trim(),
      est: $("#svcEst").value.trim(),
      price: Math.max(5000, +$("#svcPrice").value || 15000),
    };
    if (editSvcTarget) {
      const t = list.find(s => s.id === editSvcTarget.id);
      Object.assign(t, data);
    } else {
      data.id = game.slice(0, 1) + "-" + Date.now().toString(36).slice(-4);
      list.push(data);
    }
    ov[game] = list;
    store.set(KEY.svc, ov);
    $("#svcModal").classList.remove("open"); document.body.style.overflow = "";
    toast("Layanan & harga tersimpan! Perubahan langsung tampil di situs.", "ok");
    renderServicesAdmin();
  });
}

/* ---------- Admin: kelola FAQ ---------- */
let editFaqIdx = null;
function renderFaqAdmin() {
  const wrap = $("#faqAdminList"); if (!wrap) return;
  const faqs = getFaqs();
  wrap.innerHTML = faqs.length ? faqs.map((f, i) => `
    <tr data-i="${i}">
      <td style="max-width:380px"><b>${esc(f.q)}</b></td>
      <td style="color:var(--muted);font-size:.9rem">${esc(f.a)}</td>
      <td class="a-actions">
        <button class="icon-btn green edit-faq" data-i="${i}"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn red del-faq" data-i="${i}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`).join("") : `<tr><td colspan="3"><div class="empty"><i class="fa-solid fa-circle-question"></i>Belum ada FAQ.</div></td></tr>`;
  $$(".edit-faq").forEach(b => b.addEventListener("click", () => {
    const f = getFaqs()[+b.dataset.i]; editFaqIdx = +b.dataset.i;
    $("#faqQ").value = f.q; $("#faqA").value = f.a;
    $("#faqModalTitle").textContent = "Edit FAQ"; $("#faqModal").classList.add("open"); document.body.style.overflow = "hidden";
  }));
  $$(".del-faq").forEach(b => b.addEventListener("click", () => {
    if (!confirm("Hapus FAQ ini?")) return;
    const arr = getFaqs().filter((_, i) => i !== +b.dataset.i);
    store.set(KEY.faq, arr); toast("FAQ dihapus.", "ok"); renderFaqAdmin();
  }));
}
function bindFaqModal() {
  const form = $("#faqForm"); if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const arr = getFaqs();
    const item = { q: $("#faqQ").value.trim(), a: $("#faqA").value.trim() };
    if (editFaqIdx != null) arr[editFaqIdx] = item; else arr.push(item);
    store.set(KEY.faq, arr);
    $("#faqModal").classList.remove("open"); document.body.style.overflow = "";
    editFaqIdx = null; toast("FAQ tersimpan.", "ok"); renderFaqAdmin();
    renderFaqs($("#faqList"));
  });
}

/* ---------- Admin: kelola testimoni ---------- */
let editTestiIdx = null;
function renderTestiAdmin() {
  const wrap = $("#testiAdminList"); if (!wrap) return;
  const list = getTestis();
  wrap.innerHTML = list.length ? list.map((t, i) => {
    const meta = GAMES_META[t.game];
    return `
    <tr data-i="${i}">
      <td><div class="avatar av-${(i % 6) + 1}" style="width:38px;height:38px;font-size:.8rem">${esc(t.name.slice(0, 2).toUpperCase())}</div></td>
      <td><b>${esc(t.name)}</b></td>
      <td><span class="game-chip ${meta.chip}">${meta.name}</span></td>
      <td style="color:var(--gold)">${"★".repeat(t.star)}</td>
      <td style="color:var(--muted);font-size:.88rem;max-width:280px">${esc(t.review)}</td>
      <td class="a-actions">
        <button class="icon-btn green edit-testi" data-i="${i}"><i class="fa-solid fa-pen"></i></button>
        <button class="icon-btn red del-testi" data-i="${i}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>`;
  }).join("") : `<tr><td colspan="6"><div class="empty"><i class="fa-solid fa-star"></i>Belum ada testimoni.</div></td></tr>`;
  $$(".edit-testi").forEach(b => b.addEventListener("click", () => {
    const t = getTestis()[+b.dataset.i]; editTestiIdx = +b.dataset.i;
    $("#testiName").value = t.name; $("#testiGame").value = t.game; $("#testiStar").value = t.star; $("#testiReview").value = t.review;
    $("#testiModalTitle").textContent = "Edit Testimoni"; $("#testiModal").classList.add("open"); document.body.style.overflow = "hidden";
  }));
  $$(".del-testi").forEach(b => b.addEventListener("click", () => {
    if (!confirm("Hapus testimoni ini?")) return;
    store.set(KEY.testi, getTestis().filter((_, i) => i !== +b.dataset.i));
    toast("Testimoni dihapus.", "ok"); renderTestiAdmin();
  }));
}
function bindTestiModal() {
  const form = $("#testiForm"); if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const arr = getTestis();
    const item = { name: $("#testiName").value.trim(), game: $("#testiGame").value, star: +$("#testiStar").value, review: $("#testiReview").value.trim() };
    if (editTestiIdx != null) arr[editTestiIdx] = item; else arr.push(item);
    store.set(KEY.testi, arr);
    $("#testiModal").classList.remove("open"); document.body.style.overflow = "";
    editTestiIdx = null; toast("Testimoni tersimpan.", "ok"); renderTestiAdmin();
  });
}
/* ---------- Admin: navigasi view + reset data ---------- */
function switchView(v) {
  if (!VIEWS.includes(v)) v = "dash";
  $$(".side-nav button").forEach(b => b.classList.toggle("active", b.dataset.view === v));
  $$(".a-view").forEach(x => x.classList.toggle("hidden", x.id !== "view-" + v));
  $("#viewTitle").textContent = {
    dash: "Ringkasan Dashboard", orders: "Manajemen Order", services: "Layanan & Harga", faq: "Kelola FAQ", testi: "Kelola Testimoni",
  }[v];
  window.scrollTo({ top: 0 });
}
async function initAdminDashboard() {
  if (!(await guardAdmin())) return;
  let refreshTimer;
  try {
    await refreshAdminOrders();
  } catch (err) {
    console.error(err);
    toast("Order tidak dapat dimuat. Periksa konfigurasi admin.", "err");
  }
  const sidebar = $(".sidebar"), main = $(".admin-main");
  $("#sideToggle").addEventListener("click", () => sidebar.classList.toggle("open"));
  main.addEventListener("click", (e) => { if (window.innerWidth < 1024 && sidebar.classList.contains("open") && !e.target.closest(".sidebar")) sidebar.classList.remove("open"); });
  $$(".side-nav button").forEach(b => b.addEventListener("click", () => switchView(b.dataset.view)));
  $("#logoutBtn").addEventListener("click", () => { store.del(KEY.auth); location.href = "login.html"; });
  $("#resetData").addEventListener("click", () => {
    if (!confirm("Reset semua data ke default (layanan, FAQ, testimoni, order)?")) return;
    ["fj_services", "fj_faq", "fj_testi", "fj_orders"].forEach(k => localStorage.removeItem(k));
    toast("Semua data direset ke default.", "ok");
    setTimeout(() => location.reload(), 800);
  });
  switchView("dash");
  adminStats();
  renderOrdersTable();
  refreshTimer = window.setInterval(async () => {
    try {
      await refreshAdminOrders();
      adminStats();
      renderOrdersTable();
    } catch (err) {
      console.error("Penyegaran order gagal:", err);
    }
  }, 10000);
  window.addEventListener("pagehide", () => window.clearInterval(refreshTimer), { once: true });
  renderServicesAdmin();
  renderFaqAdmin();
  renderTestiAdmin();
  bindSvcModal(); bindFaqModal(); bindTestiModal();
}
function seedDemo() {
  if (getOrders().length) return;
  const demo = [
    { id: "FJ-DEMO01", game: "fisch", gameName: "Fisch", service: "f-level", serviceName: "Leveling", target: "Level 90", username: "Rizky_Pro", detail: "", priority: "Normal", priorityKey: "normal", price: 35000, est: "2–5 Hari (Normal)", status: 3, createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), updatedAt: new Date().toISOString() },
    { id: "FJ-DEMO02", game: "fishit", gameName: "Fish It!", service: "i-coins", serviceName: "Farming Coins", target: "500.000 coins", username: "AlyaGamers", detail: "Cicil 2x pembayaran", priority: "Express", priorityKey: "express", price: 37500, est: "1–3 Hari (Express — lebih cepat)", status: 4, createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), updatedAt: new Date().toISOString() },
    { id: "FJ-DEMO03", game: "fisch", gameName: "Fisch", service: "f-target", serviceName: "Farming Target Tertentu", target: "Ikan Raksasa (Megalodon)", username: "ShiroKun", detail: "", priority: "Normal", priorityKey: "normal", price: 50000, est: "2–7 Hari (Normal)", status: 0, createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date().toISOString() },
  ];
  store.set(KEY.orders, demo);
}

/* =================================================================
   INIT — dispatch sesuai halaman
   ================================================================= */
document.addEventListener("DOMContentLoaded", () => {
  // Wire tombol WhatsApp melayang (dipakai semua halaman)
  const wb = $("#waBanner");
  if (wb) { wb.href = waLink(); wb.target = "_blank"; wb.rel = "noopener"; }
  initLoader();
  initBgFX();
  if (PAGE !== "admin" && PAGE !== "admin-login" && PAGE !== "login" && !PAGE.startsWith("wa-")) {
    injectNav();
    injectFooter();
  }
  initTheme();
  observeReveals();
  if ((PAGE === "index" || PAGE === "layanan") && !PAGE.startsWith("wa-")) {
    bindServiceTabs();
    activateGame("fisch");
    bindGameCards();
    initOrderButtonsFallback();
  }
  if (PAGE === "index" && !PAGE.startsWith("wa-")) { renderStats(); initLiveStats(); renderProjects(); renderSteps(); renderTestis(); renderFaqs($("#faqList")); }
  if (PAGE === "layanan" && !PAGE.startsWith("wa-")) { renderPriceTable("fisch"); }
  if (PAGE === "order") {
    requireCustomerLogin().then(isLoggedIn => { if (isLoggedIn) bindOrderForm(""); });
  }
  if (PAGE === "status") initStatusPage();
  if (PAGE === "faq") { renderFaqs($("#faqList")); }
  if (PAGE === "admin-login") initAdminLogin();
  if (PAGE === "login") initCustomerLogin();
  if (PAGE === "admin") initAdminDashboard();
  initDynamicAnim();
});
/* Fallback: tombol Order di luar kartu layanan (misal hero) */
function initOrderButtonsFallback() {
  $$("[data-order]").forEach(b => b.addEventListener("click", (e) => {
    e.preventDefault();
    const g = b.dataset.order === "fishit" ? "fishit" : "fisch";
    openOrderModal(g, "");
  }));
}
/* Animasi hero: bikin gelembung scene saat halaman tampil */
function initDynamicAnim() {
  const scene = $(".scene"); if (!scene || reduceMotionOK()) return;
  const bubs = [[8, -18], [26, -55], [42, -30], [58, -70], [76, -45], [88, -20], [95, -60]];
  bubs.forEach(([l, d], i) => {
    const s = document.createElement("span");
    s.className = "bub";
    const size = 4 + Math.random() * 8;
    s.style.cssText = `left:${l}%;width:${size}px;height:${size}px;animation-duration:${(5 + Math.random() * 6).toFixed(1)}s;animation-delay:${(i * 0.7).toFixed(1)}s`;
    scene.appendChild(s);
  });
}

/* Jeda animasi CSS saat tab tidak terlihat - hemat CPU/GPU */
document.addEventListener("visibilitychange", () => {
  document.body.classList.toggle("tab-hidden", document.visibilityState === "hidden");
});
