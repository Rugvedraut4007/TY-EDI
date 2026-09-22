const express = require("express");
const pool = require("../db");
const { auth, requireRole } = require("../middleware/auth");
const { asyncH, getChainStages, getBatchLineage } = require("../lib/helpers");
const { verifyChain } = require("../lib/ledger");

const router = express.Router();
router.use(auth);

// Full trace for a batch QR (admin sees everything, others see a trimmed view)
router.get(
  "/:qrId",
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT b.*, m.name AS medicine_name, m.generic_name, m.strength, m.dosage_form,
              m.official_price, mu.org_name AS manufacturer_org, mu.name AS manufacturer_name
         FROM batches b
         JOIN medicines m ON m.id = b.medicine_id
         JOIN users mu ON mu.id = m.manufacturer_id
        WHERE b.qr_id = $1`,
      [req.params.qrId]
    );
    if (!rows.length) return res.status(404).json({ message: "Unknown QR code" });

    const batch = rows[0];
    const chain = await getChainStages(pool, req.params.qrId);

    const { rows: events } = await pool.query(
      `SELECT id, qr_id, event, actor_role, actor_name, location, details, previous_hash, hash, created_at
         FROM trace_ledger WHERE qr_id = ANY($1::text[]) ORDER BY id ASC`,
      [chain.lineage]
    );

    const isAdmin = req.user.role === "admin";
    const visible = isAdmin
      ? events
      : events.map((e) => ({
          id: e.id, event: e.event, actor_role: e.actor_role, actor_name: e.actor_name,
          location: e.location, created_at: e.created_at,
        }));

    res.json({ batch, chain: chain.stages, lineage: chain.lineage, events: visible, full: isAdmin });
  })
);

// Admin: batches whose Manufacturer -> Distributor -> Pharmacist chain is incomplete
router.get(
  "/admin/flags",
  requireRole("admin"),
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT b.id, b.qr_id, b.batch_no, b.quantity, b.remaining_qty, b.state, b.expiry_date,
              b.created_at, m.id AS medicine_id, m.name AS medicine_name, m.strength,
              mu.org_name AS manufacturer_org, hu.name AS holder_name, hu.role AS holder_role
         FROM batches b
         JOIN medicines m ON m.id = b.medicine_id
         JOIN users mu ON mu.id = m.manufacturer_id
         LEFT JOIN users hu ON hu.id = b.holder_id
        ORDER BY b.created_at DESC`
    );

    const flags = [];
    for (const batch of rows) {
      const chain = await getChainStages(pool, batch.qr_id);
      if (!chain.stages.complete) {
        flags.push({ ...batch, chain: chain.stages });
      }
    }
    res.json({ flags });
  })
);

// Admin: recent ledger blocks + integrity check
router.get(
  "/admin/ledger",
  requireRole("admin"),
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT t.*, m.name AS medicine_name
         FROM trace_ledger t LEFT JOIN medicines m ON m.id = t.medicine_id
        ORDER BY t.id DESC LIMIT 200`
    );
    const intact = await verifyChain(pool);
    res.json({ ledger: rows, intact, genesis: true });
  })
);

module.exports = router;
