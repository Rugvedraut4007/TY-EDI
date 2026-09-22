const express = require("express");
const pool = require("../db");
const { auth, requireRole } = require("../middleware/auth");
const { asyncH, genCode, genQrId, getChainStages } = require("../lib/helpers");
const { appendLedger } = require("../lib/ledger");

const router = express.Router();
router.use(auth);

const BATCH_FIELDS = `
  b.*,
  m.name AS medicine_name, m.generic_name, m.strength, m.dosage_form, m.official_price,
  mu.org_name AS manufacturer_org,
  h.name AS holder_name, h.org_name AS holder_org
`;

// Role-filtered inventory (batches currently held by me)
router.get(
  "/",
  asyncH(async (req, res) => {
    let where = "WHERE b.remaining_qty > 0 AND b.state IN ('in_stock','split')";
    const params = [];

    if (req.user.role !== "admin") {
      params.push(req.user.id);
      where += ` AND b.holder_id = $${params.length}`;
    }
    if (req.query.search) {
      params.push(`%${req.query.search}%`);
      where += ` AND (m.name ILIKE $${params.length} OR b.batch_no ILIKE $${params.length} OR b.qr_id ILIKE $${params.length})`;
    }

    const { rows } = await pool.query(
      `SELECT ${BATCH_FIELDS}
         FROM batches b
         JOIN medicines m ON m.id = b.medicine_id
         JOIN users mu ON mu.id = m.manufacturer_id
         LEFT JOIN users h ON h.id = b.holder_id
         ${where}
        ORDER BY m.name ASC, b.expiry_date ASC NULLS LAST`,
      params
    );
    res.json({ batches: rows });
  })
);

// Look up a batch by scanned QR id
router.get(
  "/scan/:qrId",
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${BATCH_FIELDS} FROM batches b
         JOIN medicines m ON m.id = b.medicine_id
         JOIN users mu ON mu.id = m.manufacturer_id
         LEFT JOIN users h ON h.id = b.holder_id
        WHERE b.qr_id = $1`,
      [req.params.qrId]
    );
    if (!rows.length) return res.status(404).json({ message: "Unknown QR code" });

    const chain = await getChainStages(pool, req.params.qrId);
    res.json({ batch: rows[0], chain });
  })
);

// Receive a shipment by scanning its QR (works for distributor and pharmacist)
router.post(
  "/receive",
  requireRole("distributor", "pharmacist"),
  asyncH(async (req, res) => {
    const { qr_id } = req.body;
    if (!qr_id) return res.status(400).json({ message: "Scan or enter a QR code" });

    const { rows: batchRows } = await pool.query("SELECT * FROM batches WHERE qr_id = $1", [qr_id.trim()]);
    if (!batchRows.length) return res.status(404).json({ message: "Unknown QR code" });
    const batch = batchRows[0];

    const { rows: shipRows } = await pool.query("SELECT * FROM shipments WHERE id = $1", [batch.shipment_id]);
    if (!shipRows.length) return res.status(400).json({ message: "No shipment linked to this QR" });
    const shipment = shipRows[0];

    if (shipment.to_id !== req.user.id) {
      return res.status(403).json({ message: "This package is not addressed to you" });
    }
    if (shipment.status === "received") {
      return res.status(400).json({ message: "This package has already been received" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE shipments SET status = 'received', received_at = now(), delivered_at = COALESCE(delivered_at, now()) WHERE id = $1`,
        [shipment.id]
      );
      await client.query(`UPDATE batches SET holder_role = $2, holder_id = $3, state = 'in_stock' WHERE id = $1`, [
        batch.id, req.user.role, req.user.id,
      ]);
      await client.query(
        `INSERT INTO shipment_events (shipment_id, status, note, actor_role, actor_id) VALUES ($1,'received',$2,$3,$4)`,
        [shipment.id, `Received via QR scan (${batch.qr_id})`, req.user.role, req.user.id]
      );
      await appendLedger(client, {
        qr_id: batch.qr_id, batch_id: batch.id, medicine_id: batch.medicine_id, shipment_id: shipment.id,
        event: "RECEIVED", actor_role: req.user.role, actor_id: req.user.id, actor_name: req.user.name,
        location: req.user.name, details: { quantity: batch.remaining_qty, batch_no: batch.batch_no },
      });
      await client.query("COMMIT");
      res.json({ message: "Package received and added to inventory", batch: { ...batch, holder_id: req.user.id } });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

// Partial Dispatch / Package Split: send part of a batch to a pharmacist
router.post(
  "/:id/split",
  requireRole("distributor"),
  asyncH(async (req, res) => {
    const { dispatch_qty, to_id, note } = req.body;
    const qty = Number(dispatch_qty);

    if (!qty || qty <= 0) return res.status(400).json({ message: "Enter a valid dispatch quantity" });
    if (!to_id) return res.status(400).json({ message: "Select a pharmacist" });

    const { rows: batchRows } = await pool.query(
      `SELECT b.*, m.name AS medicine_name FROM batches b JOIN medicines m ON m.id = b.medicine_id WHERE b.id = $1`,
      [req.params.id]
    );
    if (!batchRows.length) return res.status(404).json({ message: "Batch not found" });
    const batch = batchRows[0];

    if (batch.holder_id !== req.user.id) return res.status(403).json({ message: "You do not hold this batch" });
    if (batch.state !== "in_stock" && batch.state !== "split") {
      return res.status(400).json({ message: "This batch cannot be dispatched" });
    }
    if (qty > batch.remaining_qty) {
      return res.status(400).json({ message: `Only ${batch.remaining_qty} units available` });
    }

    const { rows: partner } = await pool.query("SELECT id, name, role FROM users WHERE id = $1", [to_id]);
    if (!partner.length || partner[0].role !== "pharmacist") {
      return res.status(400).json({ message: "Select a valid pharmacist" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const seq = Number((await client.query("SELECT COUNT(*) FROM batches WHERE batch_no = $1", [batch.batch_no])).rows[0].count) + 1;
      const childQr = await genQrId(client, batch.batch_no, seq);

      const shipment_code = genCode("SHP");
      const { rows: ship } = await client.query(
        `INSERT INTO shipments
          (shipment_code, medicine_id, from_role, from_id, to_role, to_id, batch_no, quantity,
           expiry_date, status, notes, dispatched_at)
         VALUES ($1,$2,'distributor',$3,'pharmacist',$4,$5,$6,$7,'dispatched',$8, now())
         RETURNING *`,
        [shipment_code, batch.medicine_id, req.user.id, to_id, batch.batch_no, qty,
         batch.expiry_date, note || `Split from ${batch.qr_id}`]
      );

      const { rows: child } = await client.query(
        `INSERT INTO batches
          (qr_id, medicine_id, shipment_id, batch_no, quantity, remaining_qty, expiry_date,
           holder_role, holder_id, parent_qr_id, state)
         VALUES ($1,$2,$3,$4,$5,$5,$6,'distributor',$7,$8,'in_transit')
         RETURNING *`,
        [childQr, batch.medicine_id, ship[0].id, batch.batch_no, qty, batch.expiry_date, req.user.id, batch.qr_id]
      );

      const remaining = batch.remaining_qty - qty;
      await client.query(
        `UPDATE batches SET remaining_qty = $2, state = $3 WHERE id = $1`,
        [batch.id, remaining, remaining === 0 ? "sold_out" : "split"]
      );

      await client.query(
        `INSERT INTO shipment_events (shipment_id, status, note, actor_role, actor_id)
         VALUES ($1,'dispatched',$2,'distributor',$3)`,
        [ship[0].id, `Partial dispatch ${qty} of ${batch.quantity} to ${partner[0].name}`, req.user.id]
      );

      await appendLedger(client, {
        qr_id: batch.qr_id, batch_id: batch.id, medicine_id: batch.medicine_id,
        event: "SPLIT", actor_role: "distributor", actor_id: req.user.id, actor_name: req.user.name,
        location: req.user.name,
        details: { original_qty: batch.quantity, dispatched: qty, remaining, child_qr: childQr, to: partner[0].name },
      });
      await appendLedger(client, {
        qr_id: childQr, batch_id: child[0].id, medicine_id: batch.medicine_id, shipment_id: ship[0].id,
        event: "DISPATCHED", actor_role: "distributor", actor_id: req.user.id, actor_name: req.user.name,
        location: req.user.name, details: { to: partner[0].name, quantity: qty, batch_no: batch.batch_no },
      });

      await client.query("COMMIT");
      res.status(201).json({
        message: "Partial dispatch recorded",
        child_batch: child[0],
        shipment: ship[0],
        remaining,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

module.exports = router;
