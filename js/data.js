/* =====================================================================
   J&B JOKI — KONFIGURASI DATA & HARGA
   ---------------------------------------------------------------------
   File ini adalah "otak" dari seluruh website.
   ADMIN cukup mengubah angka / teks di bawah ini — perubahan otomatis
   terlihat di semua halaman (Home, Layanan, Order, Dashboard).
   ===================================================================== */

const APPCONFIG = {
  brand: "J&B JOKI",
  tagline: "Target Fishing Kamu, Biar Kami yang Selesaikan.",
  /* ====== KONTAK — ganti sesuai data admin ====== */
  whatsapp: "6281229422012",                                   // nomor WhatsApp (format internasional tanpa +)
  whatsappMsg: "Halo J&B JOKI! Saya mau tanya tentang jasa joki Fisch & Fish It! 🎣",
  discord: "https://discord.gg/fishjoki",                      // link server Discord
  discordUsers: ["crazy0895_26480", "akbar056490"],       // akun Discord customer service
  /* ====== ATURAN HARGA ====== */
  expressMultiplier: 1.5,                                      // harga Express = normal x 1.5
  minPrice: 10000,                                             // harga minimum order
  roundTo: 5000,                                               // pembulatan harga otomatis
  targetDivider: 500000,                                       // makin besar target, makin besar faktor harga (maks x3)
  maxTargetFactor: 3,
  acceptedPayments: "QRIS, DANA, OVO, GoPay & Transfer Bank (BCA / BRI)",
  noteLangka: "Harga menyesuaikan tingkat kesulitan & lama pengerjaan target ikan langka.",
};

const SUPABASE_CONFIG = {
  url: "https://wlejczjcnyypkoycjzvv.supabase.co",
  publishableKey: "sb_publishable_bR2qiLpbPlhiWXbk2n6SyQ_rLdeEkNU",
};

/* ============ DAFTAR GAME ============ */
const GAMES_META = {
  fisch: { name: "Fisch", icon: "fa-fish", chip: "chip-fisch" },
  fishit: { name: "Fish It!", icon: "fa-water", chip: "chip-fishit" },
};

/* ============ DAFTAR LAYAN & HARGA ============ */
/* price = harga mulai (Rp). est = estimasi waktu pengerjaan.
   icon  = ikon Font Awesome. */
const SERVICES = {
  fisch: [
    { id: "f-coins",    name: "Farming Coins",      icon: "fa-coins",     desc: "Isi coins / uang akun dengan metode farming yang aman, tanpa cheat.",              est: "1–3 Hari",  price: 15000 },
    { id: "f-xp",       name: "Farming XP",         icon: "fa-chart-line",desc: "Naikkan XP akun dengan cepat sampai target yang kamu tentukan.",                   est: "1–3 Hari",  price: 15000 },
    { id: "f-level",    name: "Leveling",           icon: "fa-level-up-alt",desc: "Leveling level karakter ke angka yang kamu inginkan.",                             est: "2–5 Hari",  price: 25000 },
    { id: "f-item",     name: "Farming Item",       icon: "fa-box-open",  desc: "Mendapatkan item & rod tertentu yang kamu butuhkan.",                               est: "2–5 Hari",  price: 20000 },
    { id: "f-quest",    name: "Farming Quest",      icon: "fa-clipboard-check", desc: "Selesaikan quest, event, dan bestiary dengan tuntas.",                         est: "1–3 Hari",  price: 20000 },
    { id: "f-target",   name: "Farming Target Tertentu", icon: "fa-bullseye", desc: "Request target spesifik — ikan langka, fishdex, atau progress tertentu.",        est: "2–7 Hari",  price: 30000 },
    { id: "f-custom",   name: "Custom Request",     icon: "fa-wand-magic-sparkles", desc: "Target di luar daftar? Diskusikan dengan admin, kami bantu wujudkan.", est: "Diskusikan", price: 35000 },
  ],
  fishit: [
    { id: "i-coins",    name: "Farming Coins",      icon: "fa-coins",     desc: "Tambah uang in-game Fish It! dengan farming aman & terarah.",                      est: "1–3 Hari",  price: 15000 },
    { id: "i-xp",       name: "Farming XP",         icon: "fa-chart-line",desc: "Farm XP untuk level karakter sesuai target yang diminta.",                         est: "1–3 Hari",  price: 15000 },
    { id: "i-level",    name: "Leveling",           icon: "fa-level-up-alt",desc: "Naikkan level akun ke level yang kamu inginkan.",                                  est: "2–5 Hari",  price: 25000 },
    { id: "i-fish",     name: "Farming Fish",       icon: "fa-fish",      desc: "Kumpulkan jenis ikan langka & trophy fish di Fish It!",                            est: "1–4 Hari",  price: 20000 },
    { id: "i-item",     name: "Farming Item",       icon: "fa-box-open",  desc: "Amankan item, rod, dan gear kesukaanmu.",                                         est: "2–5 Hari",  price: 20000 },
    { id: "i-quest",    name: "Farming Quest",      icon: "fa-clipboard-check", desc: "Bersihkan quest & event harian/mingguan sampai target.",                     est: "1–3 Hari",  price: 20000 },
    { id: "i-custom",   name: "Custom Request",     icon: "fa-wand-magic-sparkles", desc: "Butuh target khusus di Fish It!? Konsultasikan ke admin dulu.",        est: "Diskusikan", price: 35000 },
  ],
};

/* ============ STATUS ORDER ============ */
const ORDER_STATUS = [
  "Menunggu Pembayaran",     // 0
  "Pembayaran Dikonfirmasi", // 1
  "Menunggu Dikerjakan",     // 2
  "Sedang Diproses",         // 3
  "Selesai",                 // 4
  "Dibatalkan",              // 5
];

/* ============ PRIORITAS ============ */
const PRIORITIES = {
  normal: { label: "Normal",  icon: "fa-clock",       hint: "Estimasi waktu standar.",        mult: 1 },
  express:{ label: "Express", icon: "fa-bolt",        hint: "Dikerjakan lebih cepat (x1.5 harga).", mult: 1.5 },
};

/* ============ FAQ (kelola juga dari Dashboard Admin) ============ */
const FAQS = [
  { q: "Berapa lama proses pengerjaan?", a: "Tergantung layanan dan target. Umumnya 1–7 hari kerja. Prioritas Express bisa lebih cepat (sekitar setengah dari estimasi normal). Estimasi pasti ditampilkan saat kamu membuat order." },
  { q: "Apakah akun saya aman?", a: "100% aman. Kami hanya login untuk mengerjakan target yang kamu setujui, tidak mengubah apa pun di luar pesanan. Kami tidak menyimpan data akun setelah order selesai." },
  { q: "Apakah harus memberikan password?", a: "Ya, tapi HANYA password DUMMY. Sebelum order, ganti dulu password Roblox kamu ke password dummy (contoh: 12345678), lalu isi password dummy itu di form order. Setelah orderan selesai, segera ganti kembali ke password asli kamu." },
  { q: "Bagaimana cara mengetahui status order?", a: "Setiap order mendapat Order ID unik (contoh: FJ-8XK2PA). Klik menu Status Order, masukkan Order ID kamu, dan lihat progresnya secara real-time." },
  { q: "Apakah bisa request target tertentu?", a: "Bisa! Pilih layanan Custom Request atau Farming Target Tertentu, lalu tulis target kamu di form order — misal ikan tertentu, jumlah coins, atau level tertentu." },
  { q: "Bagaimana jika target tidak tercapai?", a: "Jika target tidak tercapai dalam estimasi waktu, kamu berhak mendapatkan penggantian pengerjaan lanjutan tanpa biaya tambahan, atau refund sesuai kebijakan. Hubungi customer service untuk mediasi." },
  { q: "Bagaimana cara pembayaran?", a: "Pembayaran melalui QRIS, DANA, OVO, GoPay, atau transfer bank (BCA/BRI). Instruksi lengkap dikirim setelah order dibuat. Pastikan menyimpan bukti transfer." },
];

/* ============ TESTIMONI (kelola juga dari Dashboard Admin) ============ */
const TESTIMONIALS = [
  { name: "Rizky_Pro",  game: "fisch", star: 5, review: "Proses cepat dan hasil sesuai target. Dari level 30 langsung ke 90, mantap!" },
  { name: "AlyaGamers", game: "fishit", star: 5, review: "Awalnya ragu, tapi timnya profesional. Coins saya naik drastis tanpa masalah." },
  { name: "BangJoko",   game: "fisch", star: 5, review: "Request ikan langka berhasil didapat dalam 2 hari. Harga sebanding hasilnya." },
  { name: "ShiroKun",   game: "fishit", star: 4, review: "CS fast response, progres selalu diupdate. Bakal order lagi untuk event." },
  { name: "MilkyWayz",  game: "fisch", star: 5, review: "Aman, cepat, dan komunikatif. Target quest dan bestiary beres semua." },
  { name: "Don_Fish",   game: "fishit", star: 5, review: "Levelling cepat banget, estimasi waktu akurat. Recommended!" },
];

/* ============ STATISTIK ============ */
const STATS = [
  { num: 500, suffix: "+", label: "Order Selesai" },
  { num: 300, suffix: "+", label: "Customer" },
  { num: 2,   suffix: "",  label: "Game" },
  { num: 1,   suffix: "",  label: "Fast Response", fast: true },
];

/* ============ PROJECT HIGHLIGHT ============ */
const PROJECTS = [
  { title: "Fisch Growth Boost", category: "Fisch", description: "Optimasi leveling, item langka, dan farming quest untuk progres akun lebih cepat tanpa ribet.", metrics: "Level +30 • 3 hari" },
  { title: "Fish It! Coin Rush", category: "Fish It!", description: "Target coins, fish trophy, dan gear premium yang cocok untuk pemain yang ingin naik cepat.", metrics: "500K coins • 2 hari" },
  { title: "Custom Request", category: "Custom", description: "Request target spesifik dari admin, mulai dari ikan langka sampai progres event tertentu.", metrics: "Sesuaikan target" },
];

/* ============ CARA ORDER ============ */
const ORDER_STEPS = [
  { n: "01", t: "Pilih Game",         d: "Pilih Fisch atau Fish It! sesuai kebutuhan." },
  { n: "02", t: "Pilih Layanan",      d: "Tentukan target yang ingin dicapai." },
  { n: "03", t: "Buat Order",         d: "Ganti password kamu ke password dummy, lalu masukkan username & password dummy." },
  { n: "04", t: "Pembayaran",         d: "Ikuti instruksi pembayaran yang tersedia." },
  { n: "05", t: "Proses",             d: "Order dikerjakan sesuai detail pesanan." },
  { n: "06", t: "Selesai",            d: "Hasil diterima & order ditandai selesai." },
];

/* Ikon status per index — urut sesuai ORDER_STATUS */
const STATUS_ICONS = ["fa-hourglass-half","fa-credit-card","fa-clock","fa-gear","fa-circle-check","fa-circle-xmark"];
