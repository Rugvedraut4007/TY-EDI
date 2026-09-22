const express = require("express");
const pool = require("../db");
const { auth, requireRole } = require("../middleware/auth");
const { asyncH } = require("../lib/helpers");
const { appendLedger } = require("../lib/ledger");

const router = express.Router();

const MEDICINE_FIELDS = `
  m.*,
  u.name  AS manufacturer_name,
  u.org_name AS manufacturer_org,
  (SELECT COALESCE(SUM(b.remaining_qty), 0)
     FROM batches b
    WHERE b.medicine_id = m.id AND b.holder_role = 'pharmacist' AND b.state IN ('in_stock','split')
  ) AS available_qty
`;

// Public catalog (approved medicines only) - used by the customer search
router.get(
  "/public",
  asyncH(async (req, res) => {
    const search = (req.query.search || "").trim();
    const { rows } = await pool.query(
      `SELECT ${MEDICINE_FIELDS}
         FROM medicines m JOIN users u ON u.id = m.manufacturer_id
        WHERE m.status = 'approved'
          AND ($1 = '' OR m.name ILIKE '%' || $1 || '%' OR m.generic_name ILIKE '%' || $1 || '%')
        ORDER BY m.name ASC`,
      [search]
    );
    res.json({ medicines: rows });
  })
);

// Approved medicine by id (public detail)
router.get(
  "/public/:id",
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${MEDICINE_FIELDS}
         FROM medicines m JOIN users u ON u.id = m.manufacturer_id
        WHERE m.id = $1 AND m.status = 'approved'`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Medicine not found" });
    res.json({ medicine: rows[0] });
  })
);

// Everything below requires a session
router.use(auth);

// Admin queue
router.get(
  "/pending",
  requireRole("admin"),
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${MEDICINE_FIELDS}
         FROM medicines m JOIN users u ON u.id = m.manufacturer_id
        WHERE m.status = 'pending'
        ORDER BY m.created_at ASC`
    );
    res.json({ medicines: rows });
  })
);

// Role-filtered catalog
router.get(
  "/",
  asyncH(async (req, res) => {
    const role = req.user.role;
    let where = "WHERE m.status = 'approved'";
    const params = [];

    if (role === "manufacturer") {
      where = "WHERE m.manufacturer_id = $1";
      params.push(req.user.id);
    } else if (role === "admin") {
      where = "WHERE 1 = 1";
      if (req.query.status) {
        params.push(req.query.status);
        where += ` AND m.status = $${params.length}`;
      }
    }

    const { rows } = await pool.query(
      `SELECT ${MEDICINE_FIELDS}
         FROM medicines m JOIN users u ON u.id = m.manufacturer_id
         ${where}
        ORDER BY m.created_at DESC`,
      params
    );
    res.json({ medicines: rows });
  })
);

// Single medicine
router.get(
  "/:id",
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${MEDICINE_FIELDS}
         FROM medicines m JOIN users u ON u.id = m.manufacturer_id
        WHERE m.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Medicine not found" });

    const medicine = rows[0];
    if (medicine.status !== "approved" && req.user.role !== "admin" && medicine.manufacturer_id !== req.user.id) {
      return res.status(403).json({ message: "Not available" });
    }
    res.json({ medicine });
  })
);

// Manufacturer submits a medicine
router.post(
  "/",
  requireRole("manufacturer"),
  asyncH(async (req, res) => {
    const {
      name, generic_name, strength, dosage_form, description,
      manufacturer_info, manufacturing_info, submitted_price,
      approval_document, approval_document_name,
    } = req.body;

    if (!name || !strength || !dosage_form) {
      return res.status(400).json({ message: "Medicine name, strength and dosage form are required" });
    }
    if (!submitted_price || Number(submitted_price) <= 0) {
      return res.status(400).json({ message: "Please provide a valid price" });
    }
    if (!approval_document && !approval_document_name) {
      return res.status(400).json({ message: "Government approval document is required" });
    }

    const { rows } = await pool.query(
      `INSERT INTO medicines
        (manufacturer_id, name, generic_name, strength, dosage_form, description,
         manufacturer_info, manufacturing_info, submitted_price, approval_document,
         approval_document_name, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
       RETURNING *`,
      [req.user.id, name, generic_name || null, strength, dosage_form, description || null,
       manufacturer_info || null, manufacturing_info || null, submitted_price,
       approval_document || null, approval_document_name || "approval-document"]
    );

    res.status(201).json({ message: "Medicine submitted for approval", medicine: rows[0] });
  })
);

// Manufacturer edits an own, still-pending medicine
router.patch(
  "/:id",
  requireRole("manufacturer"),
  asyncH(async (req, res) => {
    const { rows: own } = await pool.query("SELECT * FROM medicines WHERE id = $1", [req.params.id]);
    if (!own.length) return res.status(404).json({ message: "Medicine not found" });
    if (own[0].manufacturer_id !== req.user.id) {
      return res.status(403).json({ message: "Not your medicine" });
    }
    if (own[0].status !== "pending") {
      return res.status(400).json({ message: "Only pending medicines can be edited" });
    }

    const { name, generic_name, strength, dosage_form, description, manufacturer_info, manufacturing_info, submitted_price } = req.body;
    const { rows } = await pool.query(
      `UPDATE medicines SET
         name = COALESCE($2, name),
         generic_name = COALESCE($3, generic_name),
         strength = COALESCE($4, strength),
         dosage_form = COALESCE($5, dosage_form),
         description = COALESCE($6, description),
         manufacturer_info = COALESCE($7, manufacturer_info),
         manufacturing_info = COALESCE($8, manufacturing_info),
         submitted_price = COALESCE($9, submitted_price)
       WHERE id = $1 RETURNING *`,
      [req.params.id, name, generic_name, strength, dosage_form, description, manufacturer_info, manufacturing_info, submitted_price]
    );
    res.json({ message: "Medicine updated", medicine: rows[0] });
  })
);

// Admin approves (sets the official system price)
router.post(
  "/:id/approve",
  requireRole("admin"),
  asyncH(async (req, res) => {
    const { official_price } = req.body;
    const { rows: found } = await pool.query("SELECT * FROM medicines WHERE id = $1", [req.params.id]);
    if (!found.length) return res.status(404).json({ message: "Medicine not found" });

    const price = official_price || found[0].submitted_price;
    const { rows } = await pool.query(
      `UPDATE medicines
          SET status = 'approved', official_price = $2, rejection_reason = NULL,
              approved_by = $3, approved_at = now()
        WHERE id = $1 RETURNING *`,
      [req.params.id, price, req.user.id]
    );

    await appendLedger(pool, {
      medicine_id: rows[0].id,
      event: "MEDICINE_APPROVED",
      actor_role: "admin",
      actor_id: req.user.id,
      actor_name: req.user.name,
      details: { name: rows[0].name, official_price: price },
    });

    res.json({ message: "Medicine approved", medicine: rows[0] });
  })
);

// Admin rejects with a reason
router.post(
  "/:id/reject",
  requireRole("admin"),
  asyncH(async (req, res) => {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ message: "A rejection reason is required" });

    const { rows } = await pool.query(
      `UPDATE medicines SET status = 'rejected', rejection_reason = $2, approved_by = $3, approved_at = now()
        WHERE id = $1 RETURNING *`,
      [req.params.id, reason, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Medicine not found" });

    await appendLedger(pool, {
      medicine_id: rows[0].id,
      event: "MEDICINE_REJECTED",
      actor_role: "admin",
      actor_id: req.user.id,
      actor_name: req.user.name,
      details: { name: rows[0].name, reason },
    });

    res.json({ message: "Medicine rejected", medicine: rows[0] });
  })
);

// Admin updates the centrally controlled official price
router.patch(
  "/:id/price",
  requireRole("admin"),
  asyncH(async (req, res) => {
    const { official_price } = req.body;
    if (!official_price || Number(official_price) <= 0) {
      return res.status(400).json({ message: "Please provide a valid official price" });
    }
    const { rows } = await pool.query(
      `UPDATE medicines SET official_price = $2 WHERE id = $1 AND status = 'approved' RETURNING *`,
      [req.params.id, official_price]
    );
    if (!rows.length) return res.status(404).json({ message: "Approved medicine not found" });

    await appendLedger(pool, {
      medicine_id: rows[0].id,
      event: "PRICE_UPDATED",
      actor_role: "admin",
      actor_id: req.user.id,
      actor_name: req.user.name,
      details: { name: rows[0].name, official_price },
    });

    res.json({ message: "Official price updated", medicine: rows[0] });
  })
);

module.exports = router;
