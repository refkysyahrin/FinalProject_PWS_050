const express = require("express");
const app = express();
const apiRoutes = require("./routes/api");
const pageRoutes = require("./routes/pages");

app.use(express.json());
app.use(express.static("public"));

app.use("/api", apiRoutes);
app.use("/", pageRoutes);

app.listen(3000, () =>
  console.log("☕ Server berjalan di http://localhost:3000")
);
