const express = require("express");
const pool = require("../db");
const { auth, requireRole } = require("../middleware/auth");
const { asyncH, genCode } = require("../lib/helpers");

const router = express.Router();
router.use(auth);

const COMPLAINT_FIELDS = `
  c.*,
  cu.name AS customer_name,
  m.name AS medicine_name,
  ph.name AS pharmacist_name, ph.org_name AS pharmacist_org,
  b.bill_no
`;

// File a complaint
router.post(
  "/",
  requireRole("customer"),
  asyncH(async (req, res) => {
    const { category, medicine_id, pharmacist_id, bill_id, description } = req.body;
    if (!category || !description) {
      return res.status(400).json({ message: "Complaint category and description are required" });
    }

    const { rows } = await pool.query(
      `INSERT INTO complaints (complaint_code, customer_id, category, medicine_id, pharmacist_id, bill_id, description, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending') RETURNING *`,
      [genCode("CMP"), req.user.id, category, medicine_id || null, pharmacist_id || null, bill_id || null, description]
    );
    res.status(201).json({ message: "Complaint submitted to the admin", complaint: rows[0] });
  })
);

// List complaints (customer: own, admin: all)
router.get(
  "/",
  asyncH(async (req, res) => {
    const params = [];
    let where = "WHERE 1 = 1";
    if (req.user.role === "customer") {
      params.push(req.user.id);
      where += ` AND c.customer_id = $1`;
    } else if (req.user.role !== "admin") {
      return res.json({ complaints: [] });
    }
    if (req.query.status) {
      params.push(req.query.status);
      where += ` AND c.status = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${COMPLAINT_FIELDS}
         FROM complaints c
         JOIN users cu ON cu.id = c.customer_id
         LEFT JOIN medicines m ON m.id = c.medicine_id
         LEFT JOIN users ph ON ph.id = c.pharmacist_id
         LEFT JOIN bills b ON b.id = c.bill_id
         ${where}
        ORDER BY c.created_at DESC`,
      params
    );
    res.json({ complaints: rows });
  })
);

// Admin updates complaint status
router.patch(
  "/:id",
  requireRole("admin"),
  asyncH(async (req, res) => {
    const { status, admin_note } = req.body;
    const allowed = ["pending", "under_review", "resolved", "rejected"];
    if (status && !allowed.includes(status)) {
      return res.status(400).json({ message: "Invalid complaint status" });
    }

    const { rows } = await pool.query(
      `UPDATE complaints
          SET status = COALESCE($2, status), admin_note = COALESCE($3, admin_note), updated_at = now()
        WHERE id = $1 RETURNING *`,
      [req.params.id, status || null, admin_note ?? null]
    );
    if (!rows.length) return res.status(404).json({ message: "Complaint not found" });
    res.json({ message: "Complaint updated", complaint: rows[0] });
  })
);

module.exports = router;
