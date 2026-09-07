/* =====================================================================
   J & B JOKI — WhatsApp Version Config & Data
   ===================================================================== */

const WACONFIG = {
  brand: "J & B JOKI",
  tagline: "Target Fishing Kamu, Biar Kami yang Selesaikan.",
  /* ====== KONTAK ADMIN ====== */
  whatsapp: "6281229422012",
  whatsappMsg: "Halo J & B JOKI! Saya mau order jasa joki 🎣",
  /* ====== DATA GAME ====== */
  games: {
    fisch: { name: "Fisch", icon: "🐟" },
    fishit: { name: "Fish It!", icon: "🎣" },
  },
  /* ====== LAYANAN ====== */
  services: {
    fisch: [
      { id: "f-coins", name: "Farming Coins", price: 15000, est: "1–3 Hari" },
      { id: "f-xp", name: "Farming XP", price: 15000, est: "1–3 Hari" },
      { id: "f-level", name: "Leveling", price: 25000, est: "2–5 Hari" },
      { id: "f-item", name: "Farming Item", price: 20000, est: "2–5 Hari" },
      { id: "f-quest", name: "Farming Quest", price: 20000, est: "1–3 Hari" },
      { id: "f-target", name: "Target Tertentu", price: 30000, est: "2–7 Hari" },
      { id: "f-custom", name: "Custom Request", price: 35000, est: "Diskusikan" },
    ],
    fishit: [
      { id: "i-coins", name: "Farming Coins", price: 15000, est: "1–3 Hari" },
      { id: "i-xp", name: "Farming XP", price: 15000, est: "1–3 Hari" },
      { id: "i-level", name: "Leveling", price: 25000, est: "2–5 Hari" },
      { id: "i-fish", name: "Farming Fish", price: 20000, est: "1–4 Hari" },
      { id: "i-item", name: "Farming Item", price: 20000, est: "2–5 Hari" },
      { id: "i-quest", name: "Farming Quest", price: 20000, est: "1–3 Hari" },
      { id: "i-custom", name: "Custom Request", price: 35000, est: "Diskusikan" },
    ],
  },
  /* ====== PRIORITAS ====== */
  priorities: {
    normal: { label: "Normal", mult: 1 },
    express: { label: "Express", mult: 1.5 },
  },
  expressMultiplier: 1.5,
  minPrice: 10000,
  roundTo: 5000,
  targetDivider: 500000,
  maxTargetFactor: 3,
  acceptedPayments: "QRIS, DANA, OVO, GoPay & Transfer Bank (BCA / BRI)",
};

/* ====== STATUS ORDER ====== */
const ORDER_STATUS = [
  "Menunggu Pembayaran",
  "Pembayaran Dikonfirmasi",
  "Menunggu Dikerjakan",
  "Sedang Diproses",
  "Selesai",
  "Dibatalkan",
];

/* ====== FAQ ====== */
const FAQS = [
  { q: "Berapa lama proses pengerjaan?", a: "Tergantung layanan dan target. Umumnya 1–7 hari kerja. Prioritas Express bisa lebih cepat." },
  { q: "Apakah akun saya aman?", a: "100% aman. Kami hanya login untuk mengerjakan target yang kamu setujui." },
  { q: "Apakah harus memberikan password?", a: "TIDAK. Kami tidak pernah meminta password akun Roblox kamu." },
  { q: "Bagaimana cara pembayaran?", a: "Pembayaran melalui QRIS, DANA, OVO, GoPay, atau transfer bank (BCA/BRI)." },
];// Ekspor untuk Node.js server
if (typeof module !== "undefined" && module.exports) {
  module.exports = { WACONFIG, ORDER_STATUS, FAQS };
}