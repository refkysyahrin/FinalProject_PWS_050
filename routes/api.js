const express = require("express");
const router = express.Router();
const db = require("../config/database"); // Pastikan path ini benar
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ==========================================
// 1. KONFIGURASI UPLOAD GAMBAR (MULTER)
// ==========================================
const storage = multer.diskStorage({
  destination: "./public/uploads/",
  filename: (req, file, cb) => {
    // Nama file unik: IMG-timestamp.jpg
    cb(null, "IMG-" + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// Fungsi Bantu: Hapus Gambar Lama saat Edit/Delete
const deleteImage = (filename) => {
  if (!filename) return;
  const p = path.join(__dirname, "../public/uploads/", filename);
  if (fs.existsSync(p)) fs.unlinkSync(p);
};

// ==========================================
// 2. PUBLIC ROUTES (User / Member Area)
// ==========================================

// A. REGISTER MEMBER (Daftar Sendiri)
router.post("/register-member", async (req, res) => {
  const { name, email } = req.body;
  const apiKey = `PC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  try {
    await db.query(
      "INSERT INTO members (name, email, api_key) VALUES (?, ?, ?)",
      [name, email, apiKey]
    );
    res.json({ success: true, apiKey });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: "Email mungkin sudah terdaftar." });
  }
});

// B. GET MENU (Wajib API Key)
router.get("/products", async (req, res) => {
  const apiKey = req.query.apikey;
  if (!apiKey) return res.status(401).json({ error: "API Key Diperlukan!" });

  try {
    const [member] = await db.query("SELECT * FROM members WHERE api_key = ?", [
      apiKey,
    ]);
    if (member.length === 0)
      return res.status(403).json({ error: "API Key Tidak Valid!" });

    const [products] = await db.query(
      "SELECT * FROM products ORDER BY id DESC"
    );
    res.json({ success: true, data: products, user: member[0].name });
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

// C. CHECKOUT PESANAN (Simpan ke Database)
router.post("/orders", async (req, res) => {
  const { customer_name, total_amount, items } = req.body;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Simpan Header Pesanan
    const [orderResult] = await connection.query(
      "INSERT INTO orders (customer_name, total_amount) VALUES (?, ?)",
      [customer_name, total_amount]
    );
    const orderId = orderResult.insertId;

    // 2. Simpan Detail Item
    for (const item of items) {
      await connection.query(
        "INSERT INTO order_items (order_id, product_name, price, quantity) VALUES (?, ?, ?, ?)",
        [orderId, item.name, item.price, item.qty]
      );
    }

    await connection.commit();
    res.json({ success: true, orderId });
  } catch (err) {
    await connection.rollback();
    console.error("Order Error:", err);
    res
      .status(500)
      .json({ success: false, message: "Gagal memproses pesanan." });
  } finally {
    connection.release();
  }
});

// ==========================================
// 3. ADMIN ROUTES (Dashboard & CRUD)
// ==========================================

// A. LOGIN ADMIN
router.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [u] = await db.query(
      "SELECT * FROM users WHERE email=? AND password=?",
      [email, password]
    );
    res.json({ success: u.length > 0 });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// B. KELOLA PRODUK (CRUD)
// 1. Ambil Semua Produk
router.get("/admin/products", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM products ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).send(err);
  }
});

// 2. Tambah Produk Baru (Upload Gambar)
router.post("/admin/products", upload.single("image"), async (req, res) => {
  const { name, description, price, category } = req.body;
  const img = req.file ? req.file.filename : null;
  try {
    await db.query(
      "INSERT INTO products (name, description, price, category, image_url) VALUES (?,?,?,?,?)",
      [name, description, price, category, img]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 3. Edit Produk (Update Gambar jika ada)
router.put("/admin/products/:id", upload.single("image"), async (req, res) => {
  const { name, description, price, category } = req.body;
  const id = req.params.id;

  try {
    const [old] = await db.query("SELECT image_url FROM products WHERE id=?", [
      id,
    ]);
    let img = old[0].image_url;

    if (req.file) {
      deleteImage(img); // Hapus gambar lama
      img = req.file.filename; // Pakai gambar baru
    }

    await db.query(
      "UPDATE products SET name=?, description=?, price=?, category=?, image_url=? WHERE id=?",
      [name, description, price, category, img, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 4. Hapus Produk
router.delete("/admin/products/:id", async (req, res) => {
  try {
    const [d] = await db.query("SELECT image_url FROM products WHERE id=?", [
      req.params.id,
    ]);
    if (d.length > 0) deleteImage(d[0].image_url);
    await db.query("DELETE FROM products WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// C. KELOLA MEMBER
router.get("/admin/members", async (req, res) => {
  const [rows] = await db.query("SELECT * FROM members ORDER BY id DESC");
  res.json(rows);
});

router.post("/admin/members", async (req, res) => {
  const { name, email } = req.body;
  const apiKey = `PC-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  await db.query(
    "INSERT INTO members (name, email, api_key) VALUES (?, ?, ?)",
    [name, email, apiKey]
  );
  res.json({ success: true });
});

router.delete("/admin/members/:id", async (req, res) => {
  await db.query("DELETE FROM members WHERE id=?", [req.params.id]);
  res.json({ success: true });
});

// D. KELOLA PESANAN (ORDERS) - Fitur Dashboard
// 1. Ambil Semua Pesanan
router.get("/admin/orders", async (req, res) => {
  try {
    const [orders] = await db.query(
      "SELECT * FROM orders ORDER BY created_at DESC"
    );
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "DB Error" });
  }
});

// 2. Ambil Detail Item Pesanan
router.get("/admin/orders/:id/items", async (req, res) => {
  try {
    const [items] = await db.query(
      "SELECT * FROM order_items WHERE order_id = ?",
      [req.params.id]
    );
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: "DB Error" });
  }
});

// 3. Update Status Pesanan (Pending -> Completed)
router.put("/admin/orders/:id", async (req, res) => {
  const { status } = req.body;
  try {
    await db.query("UPDATE orders SET status = ? WHERE id = ?", [
      status,
      req.params.id,
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

module.exports = router;
