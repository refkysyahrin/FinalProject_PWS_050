const express = require("express");
const router = express.Router();
const db = require("../config/database");
const crypto = require("crypto");
const multer = require("multer"); // Import Multer
const path = require("path");

// --- KONFIGURASI UPLOAD FOTO ---
const storage = multer.diskStorage({
  destination: "./public/uploads/", // Simpan di folder public/uploads
  filename: function (req, file, cb) {
    // Format nama file: MENU-timestamp.jpg (agar unik)
    cb(null, "MENU-" + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Batas file 5MB
});

// --- PUBLIC: REGISTER MEMBER ---
router.post("/register-member", async (req, res) => {
  const { name, email } = req.body;
  const randomStr = crypto.randomBytes(4).toString("hex").toUpperCase();
  const newApiKey = `PC-${randomStr}`;

  try {
    await db.query(
      "INSERT INTO members (name, email, api_key) VALUES (?, ?, ?)",
      [name, email, newApiKey]
    );
    res.json({ success: true, apiKey: newApiKey });
  } catch (err) {
    res.status(500).json({ success: false, message: "Gagal register." });
  }
});

// --- PUBLIC: LIHAT MENU ---
router.get("/products", async (req, res) => {
  const apiKey = req.query.apikey;

  if (!apiKey) return res.status(401).json({ error: "API Key Diperlukan!" });

  const [member] = await db.query("SELECT * FROM members WHERE api_key = ?", [
    apiKey,
  ]);
  if (member.length === 0)
    return res.status(403).json({ error: "API Key Tidak Valid!" });

  const [products] = await db.query("SELECT * FROM products ORDER BY id DESC");
  res.json({ success: true, data: products, user: member[0].name });
});

// --- ADMIN: LOGIN ---
router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const [users] = await db.query(
    "SELECT * FROM users WHERE email = ? AND password = ?",
    [email, password]
  );
  if (users.length > 0) res.json({ success: true });
  else res.status(401).json({ success: false });
});

// --- ADMIN: LIHAT MEMBER ---
router.get("/admin/members", async (req, res) => {
  const [members] = await db.query(
    "SELECT * FROM members ORDER BY created_at DESC"
  );
  res.json(members);
});

// --- ADMIN: TAMBAH MENU (DENGAN UPLOAD FOTO) ---
// Perhatikan: upload.single('image') sesuai dengan name di form HTML
router.post("/admin/products", upload.single("image"), async (req, res) => {
  const { name, description, price, category } = req.body;

  // Jika ada file, ambil nama filenya. Jika tidak, null.
  const image_url = req.file ? req.file.filename : null;

  try {
    await db.query(
      "INSERT INTO products (name, description, price, category, image_url) VALUES (?, ?, ?, ?, ?)",
      [name, description, price, category, image_url]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal upload menu" });
  }
});

// --- ADMIN: HAPUS MENU ---
router.delete("/admin/products/:id", async (req, res) => {
  await db.query("DELETE FROM products WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

module.exports = router;
