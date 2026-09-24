const express = require("express");
const pool = require("../db");
const { auth, requireRole } = require("../middleware/auth");
const { asyncH, genCode, genQrId } = require("../lib/helpers");
const { appendLedger } = require("../lib/ledger");

const router = express.Router();
router.use(auth);

const ORDER_FIELDS = `
  o.*,
  m.name AS medicine_name, m.strength, m.dosage_form, m.official_price,
  ph.name AS pharmacist_name, ph.org_name AS pharmacist_org,
  d.name AS distributor_name, d.org_name AS distributor_org,
  sh.shipment_code AS shipment_code, sh.status AS shipment_status,
  (SELECT b.qr_id FROM batches b WHERE b.shipment_id = o.shipment_id ORDER BY b.id LIMIT 1) AS shipment_qr
`;

router.get(
  "/",
  asyncH(async (req, res) => {
    let where = "WHERE 1 = 1";
    const params = [];
    if (req.user.role === "pharmacist") {
      params.push(req.user.id);
      where += ` AND o.pharmacist_id = $${params.length}`;
    } else if (req.user.role === "distributor") {
      params.push(req.user.id);
      where += ` AND o.distributor_id = $${params.length}`;
    } else if (req.user.role !== "admin") {
      return res.json({ orders: [] });
    }

    const { rows } = await pool.query(
      `SELECT ${ORDER_FIELDS}
         FROM orders o
         JOIN medicines m ON m.id = o.medicine_id
         JOIN users ph ON ph.id = o.pharmacist_id
         JOIN users d ON d.id = o.distributor_id
         LEFT JOIN shipments sh ON sh.id = o.shipment_id
         ${where}
        ORDER BY o.created_at DESC`,
      params
    );
    res.json({ orders: rows });
  })
);

// Pharmacist places an order
router.post(
  "/",
  requireRole("pharmacist"),
  asyncH(async (req, res) => {
    const { distributor_id, medicine_id, quantity, note } = req.body;
    if (!distributor_id || !medicine_id || !quantity) {
      return res.status(400).json({ message: "Distributor, medicine and quantity are required" });
    }
    if (Number(quantity) <= 0) return res.status(400).json({ message: "Quantity must be greater than zero" });

    const { rows: med } = await pool.query("SELECT id, status FROM medicines WHERE id = $1", [medicine_id]);
    if (!med.length || med[0].status !== "approved") {
      return res.status(400).json({ message: "Medicine is not available" });
    }

    const { rows } = await pool.query(
      `INSERT INTO orders (order_code, pharmacist_id, distributor_id, medicine_id, quantity, note, status)
       VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
      [genCode("ORD"), req.user.id, distributor_id, medicine_id, quantity, note || null]
    );
    res.status(201).json({ message: "Order placed", order: rows[0] });
  })
);

// Distributor accepts an order
router.post(
  "/:id/accept",
  requireRole("distributor"),
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `UPDATE orders SET status = 'accepted', updated_at = now()
        WHERE id = $1 AND distributor_id = $2 AND status = 'pending' RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(400).json({ message: "Order cannot be accepted" });
    res.json({ message: "Order accepted", order: rows[0] });
  })
);

// Distributor rejects an order
router.post(
  "/:id/reject",
  requireRole("distributor"),
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `UPDATE orders SET status = 'rejected', note = COALESCE($3, note), updated_at = now()
        WHERE id = $1 AND distributor_id = $2 AND status IN ('pending','accepted') RETURNING *`,
      [req.params.id, req.user.id, req.body.note || null]
    );
    if (!rows.length) return res.status(400).json({ message: "Order cannot be rejected" });
    res.json({ message: "Order rejected", order: rows[0] });
  })
);

// Distributor dispatches an order from a held batch (supports partial quantities)
router.post(
  "/:id/dispatch",
  requireRole("distributor"),
  asyncH(async (req, res) => {
    const { batch_id, quantity, note } = req.body;
    const qty = Number(quantity);

    const { rows: orderRows } = await pool.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (!orderRows.length) return res.status(404).json({ message: "Order not found" });
    const order = orderRows[0];
    if (order.distributor_id !== req.user.id) return res.status(403).json({ message: "Not your order" });
    if (!["pending", "accepted"].includes(order.status)) {
      return res.status(400).json({ message: "Order is already processed" });
    }
    if (!batch_id) return res.status(400).json({ message: "Select a batch to dispatch from" });

    const { rows: batchRows } = await pool.query("SELECT * FROM batches WHERE id = $1", [batch_id]);
    if (!batchRows.length) return res.status(404).json({ message: "Batch not found" });
    const batch = batchRows[0];

    if (batch.holder_id !== req.user.id) return res.status(403).json({ message: "You do not hold this batch" });
    if (batch.medicine_id !== order.medicine_id) return res.status(400).json({ message: "Batch is for a different medicine" });
    if (qty <= 0 || qty > batch.remaining_qty) {
      return res.status(400).json({ message: `Only ${batch.remaining_qty} units available` });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const seq = Number((await client.query("SELECT COUNT(*) FROM batches WHERE batch_no = $1", [batch.batch_no])).rows[0].count) + 1;
      const childQr = await genQrId(client, batch.batch_no, seq);

      const { rows: ship } = await client.query(
        `INSERT INTO shipments
          (shipment_code, medicine_id, from_role, from_id, to_role, to_id, batch_no, quantity,
           expiry_date, status, notes, dispatched_at)
         VALUES ($1,$2,'distributor',$3,'pharmacist',$4,$5,$6,$7,'dispatched',$8, now())
         RETURNING *`,
        [genCode("SHP"), order.medicine_id, req.user.id, order.pharmacist_id, batch.batch_no, qty,
         batch.expiry_date, note || `Order ${order.order_code}`]
      );

      const { rows: child } = await client.query(
        `INSERT INTO batches
          (qr_id, medicine_id, shipment_id, batch_no, quantity, remaining_qty, expiry_date,
           holder_role, holder_id, parent_qr_id, state)
         VALUES ($1,$2,$3,$4,$5,$5,$6,'distributor',$7,$8,'in_transit') RETURNING *`,
        [childQr, order.medicine_id, ship[0].id, batch.batch_no, qty, batch.expiry_date, req.user.id, batch.qr_id]
      );

      const remaining = batch.remaining_qty - qty;
      await client.query(`UPDATE batches SET remaining_qty = $2, state = $3 WHERE id = $1`, [
        batch.id, remaining, remaining === 0 ? "sold_out" : "split",
      ]);

      await client.query(
        `UPDATE orders SET status = 'dispatched', shipment_id = $2, updated_at = now() WHERE id = $1`,
        [order.id, ship[0].id]
      );

      await client.query(
        `INSERT INTO shipment_events (shipment_id, status, note, actor_role, actor_id)
         VALUES ($1,'dispatched',$2,'distributor',$3)`,
        [ship[0].id, `Dispatched for order ${order.order_code}`, req.user.id]
      );

      await appendLedger(client, {
        qr_id: batch.qr_id, batch_id: batch.id, medicine_id: order.medicine_id, event: "SPLIT",
        actor_role: "distributor", actor_id: req.user.id, actor_name: req.user.name, location: req.user.name,
        details: { order: order.order_code, original_qty: batch.quantity, dispatched: qty, remaining },
      });
      await appendLedger(client, {
        qr_id: childQr, batch_id: child[0].id, medicine_id: order.medicine_id, shipment_id: ship[0].id,
        event: "DISPATCHED", actor_role: "distributor", actor_id: req.user.id, actor_name: req.user.name,
        location: req.user.name, details: { order: order.order_code, quantity: qty },
      });

      await client.query("COMMIT");
      res.json({ message: "Order dispatched", shipment: ship[0], batch: child[0] });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  })
);

module.exports = router;
