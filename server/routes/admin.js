const express = require("express");
const pool = require("../db");
const { auth, requireRole } = require("../middleware/auth");
const { asyncH } = require("../lib/helpers");

const router = express.Router();
router.use(auth, requireRole("admin"));

// List accounts, optionally filtered by role
router.get(
  "/users",
  asyncH(async (req, res) => {
    const params = [];
    let where = "WHERE 1 = 1";
    if (req.query.role) {
      params.push(req.query.role);
      where += ` AND role = $1`;
    }
    const { rows } = await pool.query(
      `SELECT id, name, email, role, phone, address, org_name, license_no, created_at
         FROM users ${where} ORDER BY created_at DESC`,
      params
    );
    res.json({ users: rows });
  })
);

// Platform statistics for the admin dashboard
router.get(
  "/stats",
  asyncH(async (req, res) => {
    const one = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].count);
    const sum = async (sql, params = []) => Number((await pool.query(sql, params)).rows[0].total || 0);

    const [
      manufacturers, distributors, pharmacists, customers,
      pendingMedicines, approvedMedicines, rejectedMedicines,
      shipments, inTransit, complaints, openComplaints, bills, revenue,
    ] = await Promise.all([
      one("SELECT COUNT(*) FROM users WHERE role = 'manufacturer'"),
      one("SELECT COUNT(*) FROM users WHERE role = 'distributor'"),
      one("SELECT COUNT(*) FROM users WHERE role = 'pharmacist'"),
      one("SELECT COUNT(*) FROM users WHERE role = 'customer'"),
      one("SELECT COUNT(*) FROM medicines WHERE status = 'pending'"),
      one("SELECT COUNT(*) FROM medicines WHERE status = 'approved'"),
      one("SELECT COUNT(*) FROM medicines WHERE status = 'rejected'"),
      one("SELECT COUNT(*) FROM shipments"),
      one("SELECT COUNT(*) FROM shipments WHERE status IN ('dispatched','in_transit','out_for_delivery')"),
      one("SELECT COUNT(*) FROM complaints"),
      one("SELECT COUNT(*) FROM complaints WHERE status IN ('pending','under_review')"),
      one("SELECT COUNT(*) FROM bills"),
      sum("SELECT COALESCE(SUM(total_amount),0) AS total FROM bills"),
    ]);

    // Bills per day for the last 7 days
    const { rows: salesTrend } = await pool.query(
      `SELECT to_char(d::date,'DD Mon') AS label, COALESCE(COUNT(b.id),0) AS count,
              COALESCE(SUM(b.total_amount),0) AS total
         FROM generate_series(current_date - interval '6 days', current_date, interval '1 day') d
         LEFT JOIN bills b ON b.created_at::date = d::date
        GROUP BY d ORDER BY d`
    );

    // Medicine approvals by status (for the donut)
    const { rows: statusBreakdown } = await pool.query(
      `SELECT status AS label, COUNT(*) AS count FROM medicines GROUP BY status`
    );

    res.json({
      counts: {
        manufacturers, distributors, pharmacists, customers,
        pendingMedicines, approvedMedicines, rejectedMedicines,
        shipments, inTransit, complaints, openComplaints, bills, revenue,
      },
      salesTrend,
      statusBreakdown,
    });
  })
);

module.exports = router;
