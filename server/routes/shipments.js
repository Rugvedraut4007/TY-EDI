const express = require("express");
const pool = require("../db");
const { auth, requireRole } = require("../middleware/auth");
const { asyncH, genCode, genQrId } = require("../lib/helpers");
const { appendLedger } = require("../lib/ledger");

const router = express.Router();
router.use(auth);

const SHIPMENT_FIELDS = `
  s.*,
  m.name AS medicine_name, m.strength, m.dosage_form, m.official_price,
  fu.name AS from_name, fu.org_name AS from_org,
  tu.name AS to_name, tu.org_name AS to_org,
  b.qr_id, b.remaining_qty, b.quantity AS batch_quantity, b.state AS batch_state
`;

// Role-filtered shipment list
router.get(
  "/",
  asyncH(async (req, res) => {
    let where = "WHERE 1 = 1";
    const params = [];
    if (req.user.role !== "admin") {
      params.push(req.user.id, req.user.role);
      where += ` AND ((s.to_id = $1 AND s.to_role = $2) OR (s.from_id = $1 AND s.from_role = $2))`;
    }
    if (req.query.status) {
      params.push(req.query.status);
      where += ` AND s.status = $${params.length}`;
    }

    const { rows } = await pool.query(
      `SELECT ${SHIPMENT_FIELDS}
         FROM shipments s
         JOIN medicines m ON m.id = s.medicine_id
         JOIN users fu ON fu.id = s.from_id
         JOIN users tu ON tu.id = s.to_id
         LEFT JOIN batches b ON b.shipment_id = s.id AND b.parent_qr_id IS NULL
         ${where}
        ORDER BY s.created_at DESC`,
      params
    );
    res.json({ shipments: rows });
  })
);

// Shipment detail with timeline
router.get(
  "/:id",
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${SHIPMENT_FIELDS}
         FROM shipments s
         JOIN medicines m ON m.id = s.medicine_id
         JOIN users fu ON fu.id = s.from_id
         JOIN users tu ON tu.id = s.to_id
         LEFT JOIN batches b ON b.shipment_id = s.id AND b.parent_qr_id IS NULL
        WHERE s.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Shipment not found" });

    const shipment = rows[0];
    const party = req.user.id === shipment.from_id || req.user.id === shipment.to_id;
    if (req.user.role !== "admin" && !party) {
      return res.status(403).json({ message: "Not your shipment" });
    }

    const { rows: events } = await pool.query(
      "SELECT * FROM shipment_events WHERE shipment_id = $1 ORDER BY created_at ASC",
      [req.params.id]
    );
    res.json({ shipment, events });
  })
);

// Manufacturer creates + dispatches a shipment to a distributor
router.post(
  "/",
  requireRole("manufacturer"),
  asyncH(async (req, res) => {
    const { medicine_id, to_id, quantity, batch_no, expiry_date, notes } = req.body;

    if (!medicine_id || !to_id || !quantity || !batch_no) {
      return res.status(400).json({ message: "Medicine, distributor, quantity and batch number are required" });
    }
    if (Number(quantity) <= 0) return res.status(400).json({ message: "Quantity must be greater than zero" });

    const { rows: med } = await pool.query("SELECT * FROM medicines WHERE id = $1", [medicine_id]);
    if (!med.length) return res.status(404).json({ message: "Medicine not found" });
    if (med[0].status !== "approved") return res.status(400).json({ message: "Medicine is not approved yet" });
    if (med[0].manufacturer_id !== req.user.id) return res.status(403).json({ message: "Not your medicine" });

    const { rows: partner } = await pool.query("SELECT id, name, role FROM users WHERE id = $1", [to_id]);
    if (!partner.length || partner[0].role !== "distributor") {
      return res.status(400).json({ message: "Select a valid distributor" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const shipment_code = genCode("SHP");
      const { rows: ship } = await client.query(
        `INSERT INTO shipments
          (shipment_code, medicine_id, from_role, from_id, to_role, to_id, batch_no, quantity,
           expiry_date, status, notes, dispatched_at)
         VALUES ($1,$2,'manufacturer',$3,'distributor',$4,$5,$6,$7,'dispatched',$8, now())
         RETURNING *`,
        [shipment_code, medicine_id, req.user.id, to_id, batch_no, quantity, expiry_date || null, notes || null]
      );

      const seq = Number((await client.query("SELECT COUNT(*) FROM batches WHERE batch_no = $1", [batch_no])).rows[0].count) + 1;
      const qr_id = await genQrId(client, batch_no, seq);

      const { rows: batch } = await client.query(
        `INSERT INTO batches
          (qr_id, medicine_id, shipment_id, batch_no, quantity, remaining_qty, expiry_date,
           holder_role, holder_id, state)
         VALUES ($1,$2,$3,$4,$5,$5,$6,'manufacturer',$7,'in_transit')
         RETURNING *`,
        [qr_id, medicine_id, ship[0].id, batch_no, quantity, expiry_date || null, req.user.id]
      );

      await client.query(
        `INSERT INTO shipment_events (shipment_id, status, note, actor_role, actor_id)
         VALUES ($1,'dispatched',$2,'manufacturer',$3)`,
        [ship[0].id, `Dispatched to ${partner[0].name}`, req.user.id]
      );

      await appendLedger(client, {
        qr_id, batch_id: batch[0].id, medicine_id, shipment_id: ship[0].id,
        event: "DISPATCHED", actor_role: "manufacturer", actor_id: req.user.id,
        actor_name: req.user.name, location: med[0].manufacturer_info || "Manufacturer",
        details: { to: partner[0].name, quantity, batch_no },
      });

      await client.query("COMMIT");
      res.status(201).json({ message: "Shipment dispatched", shipment: ship[0], batch: batch[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

// Advance shipment status (from/to party or admin)
router.post(
  "/:id/status",
  asyncH(async (req, res) => {
    const { status, note } = req.body;
    const allowed = ["created", "dispatched", "in_transit", "out_for_delivery", "delivered", "cancelled", "damaged", "rejected"];
    if (!allowed.includes(status)) return res.status(400).json({ message: "Invalid status" });

    const { rows } = await pool.query("SELECT * FROM shipments WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Shipment not found" });
    const shipment = rows[0];
    if (req.user.role !== "admin" && req.user.id !== shipment.from_id && req.user.id !== shipment.to_id) {
      return res.status(403).json({ message: "Not your shipment" });
    }

    const { rows: updated } = await pool.query(
      `UPDATE shipments
          SET status = $2,
              dispatched_at = CASE WHEN $2 = 'dispatched' THEN COALESCE(dispatched_at, now()) ELSE dispatched_at END,
              delivered_at  = CASE WHEN $2 IN ('delivered','received') THEN COALESCE(delivered_at, now()) ELSE delivered_at END
        WHERE id = $1 RETURNING *`,
      [req.params.id, status]
    );

    await pool.query(
      `INSERT INTO shipment_events (shipment_id, status, note, actor_role, actor_id) VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, status, note || null, req.user.role, req.user.id]
    );

    await appendLedger(pool, {
      qr_id: null, shipment_id: shipment.id, medicine_id: shipment.medicine_id,
      event: `SHIPMENT_${status.toUpperCase()}`, actor_role: req.user.role,
      actor_id: req.user.id, actor_name: req.user.name, details: { note: note || null },
    });

    res.json({ message: "Shipment status updated", shipment: updated[0] });
  })
);

// QR-based receiving (distributor or pharmacist)
router.post(
  "/:id/receive",
  requireRole("distributor", "pharmacist"),
  asyncH(async (req, res) => {
    const { qr_id } = req.body;
    const { rows } = await pool.query("SELECT * FROM shipments WHERE id = $1", [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Shipment not found" });
    const shipment = rows[0];

    if (shipment.to_id !== req.user.id) {
      return res.status(403).json({ message: "This shipment is not addressed to you" });
    }
    if (shipment.status === "received") {
      return res.status(400).json({ message: "Shipment already received" });
    }

    const { rows: batchRows } = await pool.query(
      "SELECT * FROM batches WHERE shipment_id = $1 AND parent_qr_id IS NULL",
      [shipment.id]
    );
    const batch = batchRows[0];
    if (qr_id && batch && qr_id.trim() !== batch.qr_id) {
      return res.status(400).json({ message: `QR does not match this shipment (expected ${batch.qr_id})` });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE shipments SET status = 'received', received_at = now(), delivered_at = COALESCE(delivered_at, now())
          WHERE id = $1`,
        [shipment.id]
      );
      if (batch) {
        await client.query(
          `UPDATE batches SET holder_role = $2, holder_id = $3, state = 'in_stock' WHERE id = $1`,
          [batch.id, req.user.role, req.user.id]
        );
      }

      await client.query(
        `INSERT INTO shipment_events (shipment_id, status, note, actor_role, actor_id)
         VALUES ($1,'received',$2,$3,$4)`,
        [shipment.id, `Received via QR scan${batch ? ` (${batch.qr_id})` : ""}`, req.user.role, req.user.id]
      );

      await appendLedger(client, {
        qr_id: batch ? batch.qr_id : null, batch_id: batch ? batch.id : null,
        medicine_id: shipment.medicine_id, shipment_id: shipment.id,
        event: "RECEIVED", actor_role: req.user.role, actor_id: req.user.id,
        actor_name: req.user.name, location: req.user.name,
        details: { quantity: batch ? batch.remaining_qty : shipment.quantity, batch_no: shipment.batch_no },
      });

      await client.query("COMMIT");
      res.json({ message: "Shipment received and added to inventory", qr_id: batch ? batch.qr_id : null });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

module.exports = router;
