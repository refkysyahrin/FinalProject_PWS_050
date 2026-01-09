const express = require("express");
const router = express.Router();
const path = require("path");

router.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/index.html"))
);
router.get("/menu", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/menu.html"))
);
router.get("/admin", (req, res) =>
  res.sendFile(path.join(__dirname, "../public/admin.html"))
);

module.exports = router;
