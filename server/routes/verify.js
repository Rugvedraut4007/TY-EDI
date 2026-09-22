const express = require("express");
const pool = require("../db");
const { asyncH, getChainStages } = require("../lib/helpers");
const { sha256 } = require("../lib/ledger");

const router = express.Router();
const VERIFY_SALT = process.env.BILL_SALT || "medsure-bill-secret";

// Public medicine verification by QR id (no login required)
router.get(
  "/:qrId",
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT b.qr_id, b.batch_no, b.quantity, b.remaining_qty, b.expiry_date, b.state, b.created_at,
              m.id AS medicine_id, m.name AS medicine_name, m.generic_name, m.strength, m.dosage_form,
              m.description, m.official_price, m.status,
              mu.name AS manufacturer_name, mu.org_name AS manufacturer_org
         FROM batches b
         JOIN medicines m ON m.id = b.medicine_id
         JOIN users mu ON mu.id = m.manufacturer_id
        WHERE b.qr_id = $1`,
      [req.params.qrId]
    );
    if (!rows.length) {
      return res.status(404).json({ verified: false, message: "This QR code is not registered in MedSure" });
    }
    if (rows[0].status !== "approved") {
      return res.json({ verified: false, message: "This medicine is not approved in the system", medicine: null });
    }

    const batch = rows[0];
    const chain = await getChainStages(pool, batch.qr_id);

    // Resolve the parties that handled this batch (simplified for customers)
    const { rows: parties } = await pool.query(
      `SELECT DISTINCT actor_role, actor_name FROM trace_ledger
        WHERE qr_id = ANY($1::text[]) AND actor_role IN ('manufacturer','distributor','pharmacist')
        ORDER BY actor_role`,
      [chain.lineage]
    );

    res.json({
      verified: true,
      complete: chain.stages.complete,
      stages: chain.stages,
      medicine: batch,
      parties,
    });
  })
);

// Public bill verification
router.get(
  "/bill/:billNo",
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT b.*, u.name AS pharmacist_name, u.org_name AS pharmacist_org
         FROM bills b JOIN users u ON u.id = b.pharmacist_id WHERE b.bill_no = $1`,
      [req.params.billNo]
    );
    if (!rows.length) return res.status(404).json({ valid: false, message: "Bill not found" });

    const bill = rows[0];
    const expected = sha256(
      `${bill.bill_no}|${bill.pharmacist_id}|${Number(bill.total_amount).toFixed(2)}|${new Date(bill.created_at).toISOString()}|${VERIFY_SALT}`
    );
    const provided = req.query.h;
    const valid = expected === bill.verification_hash && (!provided || provided === bill.verification_hash);

    const { rows: items } = await pool.query("SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id", [bill.id]);
    res.json({ valid, bill, items });
  })
);

module.exports = router;
