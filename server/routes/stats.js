const express = require("express");
const pool = require("../db");
const { auth } = require("../middleware/auth");
const { asyncH } = require("../lib/helpers");

const router = express.Router();
router.use(auth);

const num = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].count);

router.get(
  "/",
  asyncH(async (req, res) => {
    const { role, id } = req.user;
    const data = { role };

    if (role === "manufacturer") {
      data.medicines = await num("SELECT COUNT(*) FROM medicines WHERE manufacturer_id = $1", [id]);
      data.pending = await num("SELECT COUNT(*) FROM medicines WHERE manufacturer_id = $1 AND status = 'pending'", [id]);
      data.approved = await num("SELECT COUNT(*) FROM medicines WHERE manufacturer_id = $1 AND status = 'approved'", [id]);
      data.rejected = await num("SELECT COUNT(*) FROM medicines WHERE manufacturer_id = $1 AND status = 'rejected'", [id]);
      data.shipments = await num("SELECT COUNT(*) FROM shipments WHERE from_id = $1", [id]);
      data.inTransit = await num(
        "SELECT COUNT(*) FROM shipments WHERE from_id = $1 AND status IN ('dispatched','in_transit','out_for_delivery')",
        [id]
      );
    } else if (role === "distributor") {
      data.incoming = await num(
        "SELECT COUNT(*) FROM shipments WHERE to_id = $1 AND status <> 'received' AND status <> 'cancelled'",
        [id]
      );
      data.inventoryItems = await num(
        "SELECT COUNT(*) FROM batches WHERE holder_id = $1 AND remaining_qty > 0 AND state IN ('in_stock','split')",
        [id]
      );
      data.totalUnits = Number(
        (
          await pool.query(
            "SELECT COALESCE(SUM(remaining_qty),0) AS count FROM batches WHERE holder_id = $1 AND state IN ('in_stock','split')",
            [id]
          )
        ).rows[0].count
      );
      data.orders = await num("SELECT COUNT(*) FROM orders WHERE distributor_id = $1 AND status = 'pending'", [id]);
      data.dispatched = await num("SELECT COUNT(*) FROM shipments WHERE from_id = $1", [id]);
    } else if (role === "pharmacist") {
      data.inventoryItems = await num(
        "SELECT COUNT(*) FROM batches WHERE holder_id = $1 AND remaining_qty > 0 AND state IN ('in_stock','split')",
        [id]
      );
      data.totalUnits = Number(
        (
          await pool.query(
            "SELECT COALESCE(SUM(remaining_qty),0) AS count FROM batches WHERE holder_id = $1 AND state IN ('in_stock','split')",
            [id]
          )
        ).rows[0].count
      );
      data.incoming = await num("SELECT COUNT(*) FROM shipments WHERE to_id = $1 AND status <> 'received'", [id]);
      data.bills = await num("SELECT COUNT(*) FROM bills WHERE pharmacist_id = $1", [id]);
      data.billsToday = await num("SELECT COUNT(*) FROM bills WHERE pharmacist_id = $1 AND created_at::date = current_date", [id]);
      data.revenueToday = Number(
        (
          await pool.query(
            "SELECT COALESCE(SUM(total_amount),0) AS count FROM bills WHERE pharmacist_id = $1 AND created_at::date = current_date",
            [id]
          )
        ).rows[0].count
      );
      data.revenue = Number(
        (await pool.query("SELECT COALESCE(SUM(total_amount),0) AS count FROM bills WHERE pharmacist_id = $1", [id])).rows[0].count
      );
      data.orders = await num("SELECT COUNT(*) FROM orders WHERE pharmacist_id = $1", [id]);
    } else if (role === "customer") {
      data.medicines = await num("SELECT COUNT(*) FROM medicines WHERE status = 'approved'");
      data.complaints = await num("SELECT COUNT(*) FROM complaints WHERE customer_id = $1", [id]);
      data.openComplaints = await num(
        "SELECT COUNT(*) FROM complaints WHERE customer_id = $1 AND status IN ('pending','under_review')",
        [id]
      );
      data.bills = await num("SELECT COUNT(*) FROM bills WHERE customer_phone = (SELECT phone FROM users WHERE id = $1)", [id]);
    }

    res.json(data);
  })
);

module.exports = router;
