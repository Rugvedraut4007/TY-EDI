require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");

const authRoutes = require("./routes/auth");
const medicinesRoutes = require("./routes/medicines");
const shipmentsRoutes = require("./routes/shipments");
const batchesRoutes = require("./routes/batches");
const ordersRoutes = require("./routes/orders");
const billingRoutes = require("./routes/billing");
const traceRoutes = require("./routes/trace");
const complaintsRoutes = require("./routes/complaints");
const adminRoutes = require("./routes/admin");
const statsRoutes = require("./routes/stats");
const directoryRoutes = require("./routes/directory");
const verifyRoutes = require("./routes/verify");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" })); // allows base64 approval-document uploads

app.get("/", (req, res) => {
  res.json({ message: "MedSure API is running", version: "1.0.0" });
});

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS now");
    res.json({ ok: true, database: "connected", time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ ok: false, database: "unavailable" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/medicines", medicinesRoutes);
app.use("/api/shipments", shipmentsRoutes);
app.use("/api/batches", batchesRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/bills", billingRoutes);
app.use("/api/trace", traceRoutes);
app.use("/api/complaints", complaintsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/directory", directoryRoutes);
app.use("/api/verify", verifyRoutes);

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Uploaded file is too large (max 15MB)" });
  }
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

// Ignore empty/0/invalid PORT values (e.g. a stray PORT=0 in the shell env).
const parsedPort = Number(process.env.PORT);
const PORT = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 5000;

app.listen(PORT, () => {
  console.log(`MedSure API running on http://localhost:${PORT}`);
});
