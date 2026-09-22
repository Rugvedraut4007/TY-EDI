const express = require("express");
const pool = require("../db");
const { auth, requireRole } = require("../middleware/auth");
const { asyncH, genCode } = require("../lib/helpers");
const { appendLedger, sha256 } = require("../lib/ledger");

const router = express.Router();
router.use(auth);

const VERIFY_SALT = process.env.BILL_SALT || "medsure-bill-secret";

function billHash(bill) {
  return sha256(
    `${bill.bill_no}|${bill.pharmacist_id}|${Number(bill.total_amount).toFixed(2)}|${new Date(bill.created_at).toISOString()}|${VERIFY_SALT}`
  );
}

function qrPayload(bill) {
  const base = process.env.CLIENT_URL || "http://localhost:3000";
  return `${base}/verify-bill?bill=${bill.bill_no}&h=${bill.verification_hash}`;
}

// Create a bill (official price always taken from the database)
router.post(
  "/",
  requireRole("pharmacist"),
  asyncH(async (req, res) => {
    const { customer_name, customer_phone, payment_method, items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Add at least one medicine to the bill" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const lines = [];
      for (const item of items) {
        const qty = Number(item.quantity);
        if (!item.medicine_id || !qty || qty <= 0) {
          throw Object.assign(new Error("Invalid bill item"), { status: 400 });
        }

        const { rows: meds } = await client.query(
          "SELECT id, name, official_price, status FROM medicines WHERE id = $1",
          [item.medicine_id]
        );
        if (!meds.length || meds[0].status !== "approved") {
          throw Object.assign(new Error("Medicine is not available"), { status: 400 });
        }
        const medicine = meds[0];
        if (medicine.official_price == null) {
          throw Object.assign(new Error(`${medicine.name} has no official price set`), { status: 400 });
        }
        const unitPrice = Number(medicine.official_price);

        // Pull stock from the pharmacist's own batches (explicit batch or FIFO by expiry)
        const { rows: batches } = await client.query(
          `SELECT id, qr_id, batch_no, remaining_qty FROM batches
            WHERE medicine_id = $1 AND holder_id = $2 AND holder_role = 'pharmacist'
              AND remaining_qty > 0 AND state IN ('in_stock','split')
              ${item.batch_id ? "AND id = $3" : ""}
            ORDER BY expiry_date ASC NULLS LAST`,
          item.batch_id ? [item.medicine_id, req.user.id, item.batch_id] : [item.medicine_id, req.user.id]
        );

        const available = batches.reduce((sum, b) => sum + b.remaining_qty, 0);
        if (available < qty) {
          throw Object.assign(new Error(`Insufficient stock for ${medicine.name} (available ${available})`), { status: 400 });
        }

        let left = qty;
        const usedBatches = [];
        for (const batch of batches) {
          if (left <= 0) break;
          const take = Math.min(left, batch.remaining_qty);
          const remaining = batch.remaining_qty - take;
          await client.query("UPDATE batches SET remaining_qty = $2, state = $3 WHERE id = $1", [
            batch.id, remaining, remaining === 0 ? "sold_out" : "split",
          ]);
          await appendLedger(client, {
            qr_id: batch.qr_id, batch_id: batch.id, medicine_id: medicine.id, event: "BILLED",
            actor_role: "pharmacist", actor_id: req.user.id, actor_name: req.user.name,
            location: req.user.name, details: { quantity: take, bill_item: medicine.name },
          });
          usedBatches.push(batch.batch_no);
          left -= take;
        }

        lines.push({
          medicine_id: medicine.id,
          medicine_name: medicine.name,
          batch_no: [...new Set(usedBatches)].join(", "),
          quantity: qty,
          unit_price: unitPrice,
          line_total: +(unitPrice * qty).toFixed(2),
        });
      }

      const subtotal = +lines.reduce((sum, l) => sum + l.line_total, 0).toFixed(2);
      const billNoValue = genCode("BILL");
      const stamp = new Date();

      const { rows: bills } = await client.query(
        `INSERT INTO bills
          (bill_no, pharmacist_id, customer_name, customer_phone, subtotal, total_amount,
           payment_method, verification_hash, qr_payload, created_at)
         VALUES ($1,$2,$3,$4,$5,$5,$6,'PENDING','PENDING',$7) RETURNING *`,
        [billNoValue, req.user.id, customer_name || "Walk-in Customer", customer_phone || null,
         subtotal, payment_method || "cash", stamp]
      );
      const bill = bills[0];

      const hash = billHash(bill);
      const { rows: finalBills } = await client.query(
        `UPDATE bills SET verification_hash = $2 WHERE id = $1 RETURNING *`,
        [bill.id, hash]
      );
      const finalBill = finalBills[0];
      const payload = qrPayload(finalBill);
      await client.query(`UPDATE bills SET qr_payload = $2 WHERE id = $1`, [finalBill.id, payload]);
      finalBill.qr_payload = payload;

      const savedItems = [];
      for (const line of lines) {
        const { rows } = await client.query(
          `INSERT INTO bill_items (bill_id, medicine_id, medicine_name, batch_no, quantity, unit_price, line_total)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [finalBill.id, line.medicine_id, line.medicine_name, line.batch_no, line.quantity, line.unit_price, line.line_total]
        );
        savedItems.push(rows[0]);
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Bill generated", bill: finalBill, items: savedItems });
    } catch (err) {
      await client.query("ROLLBACK");
      if (err.status) return res.status(err.status).json({ message: err.message });
      throw err;
    } finally {
      client.release();
    }
  })
);

// List bills (pharmacist: own, admin: all)
router.get(
  "/",
  asyncH(async (req, res) => {
    const params = [];
    let where = "WHERE 1 = 1";
    if (req.user.role === "pharmacist") {
      params.push(req.user.id);
      where += ` AND b.pharmacist_id = $1`;
    } else if (req.user.role !== "admin") {
      return res.json({ bills: [] });
    }

    const { rows } = await pool.query(
      `SELECT b.*, u.name AS pharmacist_name, u.org_name AS pharmacist_org
         FROM bills b JOIN users u ON u.id = b.pharmacist_id
         ${where} ORDER BY b.created_at DESC`,
      params
    );
    res.json({ bills: rows });
  })
);

// Bill detail
router.get(
  "/:id",
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT b.*, u.name AS pharmacist_name, u.org_name AS pharmacist_org,
              u.address AS pharmacist_address, u.phone AS pharmacist_phone, u.license_no AS pharmacist_license
         FROM bills b JOIN users u ON u.id = b.pharmacist_id WHERE b.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Bill not found" });
    const bill = rows[0];
    if (req.user.role !== "admin" && bill.pharmacist_id !== req.user.id) {
      return res.status(403).json({ message: "Not your bill" });
    }
    const { rows: items } = await pool.query("SELECT * FROM bill_items WHERE bill_id = $1 ORDER BY id", [req.params.id]);
    res.json({ bill, items });
  })
);

module.exports = router;
