const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  port: 3308, // Sesuaikan port XAMPP (biasanya 3306 atau 3308)
  password: "MySqlaku123", // Masukkan password DB jika ada
  database: "practicecoffe_db",
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = db;
