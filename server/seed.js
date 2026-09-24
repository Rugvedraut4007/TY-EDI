/*  MedSure seed script
 *  Creates all tables (schema.sql) then inserts demo accounts, medicines,
 *  shipments, batches, a hash-chained traceability ledger, a bill and a complaint.
 *
 *  Run:  npm run seed
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const pool = require("./db");
const { appendLedger } = require("./lib/ledger");
const { sha256 } = require("./lib/ledger");

const VERIFY_SALT = process.env.BILL_SALT || "medsure-bill-secret";

async function makeUser(name, email, password, role, extra = {}) {
  const hashed = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password, role, phone, address, org_name, license_no)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [name, email, hashed, role, extra.phone || null, extra.address || null, extra.org_name || null, extra.license_no || null]
  );
  return rows[0];
}

async function makeMedicine(manufacturer, data) {
  const { rows } = await pool.query(
    `INSERT INTO medicines
       (manufacturer_id, name, generic_name, strength, dosage_form, description, manufacturer_info,
        manufacturing_info, submitted_price, official_price, status, rejection_reason,
        approval_document_name, approved_by, approved_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
    [
      manufacturer.id, data.name, data.generic_name, data.strength, data.dosage_form, data.description,
      data.manufacturer_info, data.manufacturing_info, data.submitted_price, data.official_price ?? null,
      data.status, data.rejection_reason || null, data.approval_document_name || "gov-approval.pdf",
      data.status === "pending" ? null : data.approved_by || null,
      data.status === "pending" ? null : new Date(), data.created_at || new Date(),
    ]
  );
  return rows[0];
}

/** Create a shipment + batch + ledger events for a single hop. */
async function makeHop({ code, medicine, from, fromRole, to, toRole, qr, batchNo, qty, expiry, complete, parentQr }) {
  const { rows: shipRows } = await pool.query(
    `INSERT INTO shipments
       (shipment_code, medicine_id, from_role, from_id, to_role, to_id, batch_no, quantity,
        expiry_date, status, dispatched_at, delivered_at, received_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$11) RETURNING *`,
    [code, medicine.id, fromRole, from.id, toRole, to.id, batchNo, qty, expiry,
     complete ? "received" : "dispatched", new Date()]
  );
  const shipment = shipRows[0];

  const { rows: batchRows } = await pool.query(
    `INSERT INTO batches
       (qr_id, medicine_id, shipment_id, batch_no, quantity, remaining_qty, expiry_date,
        holder_role, holder_id, parent_qr_id, state)
     VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [qr, medicine.id, shipment.id, batchNo, qty, expiry, complete ? toRole : fromRole, complete ? to.id : from.id,
     parentQr || null, complete ? "in_stock" : "in_transit"]
  );
  const batch = batchRows[0];

  await pool.query(
    `INSERT INTO shipment_events (shipment_id, status, note, actor_role, actor_id)
     VALUES ($1,'dispatched',$2,$3,$4)`,
    [shipment.id, `Dispatched to ${to.name}`, fromRole, from.id]
  );
  await appendLedger(pool, {
    qr_id: qr, batch_id: batch.id, medicine_id: medicine.id, shipment_id: shipment.id,
    event: "DISPATCHED", actor_role: fromRole, actor_id: from.id, actor_name: from.name,
    location: from.org_name || from.name, details: { to: to.name, quantity: qty, batch_no: batchNo },
  });

  if (complete) {
    await pool.query(
      `INSERT INTO shipment_events (shipment_id, status, note, actor_role, actor_id)
       VALUES ($1,'received',$2,$3,$4)`,
      [shipment.id, `Received via QR scan (${qr})`, toRole, to.id]
    );
    await appendLedger(pool, {
      qr_id: qr, batch_id: batch.id, medicine_id: medicine.id, shipment_id: shipment.id,
      event: "RECEIVED", actor_role: toRole, actor_id: to.id, actor_name: to.name,
      location: to.org_name || to.name, details: { quantity: qty, batch_no: batchNo },
    });
  }
  return { shipment, batch };
}

async function main() {
  console.log("Resetting schema ...");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);

  console.log("Creating demo accounts ...");
  const admin = await makeUser("System Admin", "admin@medsure.in", "Admin@123", "admin", { org_name: "MedSure Authority" });
  const mfr1 = await makeUser("Rahul Sharma", "manufacturer@medsure.in", "Password@123", "manufacturer", {
    org_name: "Cipla Pharmaceuticals", license_no: "MFG-2024-001", address: "Mumbai, Maharashtra", phone: "9876500011",
  });
  const mfr2 = await makeUser("Anita Verma", "sunpharma@medsure.in", "Password@123", "manufacturer", {
    org_name: "Sun Pharma", license_no: "MFG-2024-002", address: "Vadodara, Gujarat",
  });
  const dist1 = await makeUser("Vikram Rao", "distributor@medsure.in", "Password@123", "distributor", {
    org_name: "MediTrans Distribution", license_no: "DST-2024-011", address: "Pune, Maharashtra", phone: "9876500022",
  });
  const dist2 = await makeUser("Farah Khan", "medplus-dist@medsure.in", "Password@123", "distributor", {
    org_name: "MedPlus Logistics", license_no: "DST-2024-012", address: "Hyderabad, Telangana",
  });
  const pharm1 = await makeUser("Dr. Neha Kapoor", "pharmacist@medsure.in", "Password@123", "pharmacist", {
    org_name: "WellCare Pharmacy", license_no: "PHM-2024-101", address: "Kothrud, Pune", phone: "9876500033",
  });
  const pharm2 = await makeUser("Imran Sheikh", "citypharma@medsure.in", "Password@123", "pharmacist", {
    org_name: "City Pharma Store", license_no: "PHM-2024-102", address: "Banjara Hills, Hyderabad",
  });
  const cust = await makeUser("Priya Nair", "customer@medsure.in", "Password@123", "customer", {
    phone: "9876500044", address: "Andheri, Mumbai",
  });
  await makeUser("Arjun Mehta", "customer2@medsure.in", "Password@123", "customer", { phone: "9876500045" });

  console.log("Creating medicines ...");
  const para = await makeMedicine(mfr1, {
    name: "Paracetamol", generic_name: "Acetaminophen", strength: "500 mg", dosage_form: "Tablet",
    description: "Used to treat mild to moderate pain and fever.",
    manufacturer_info: "Cipla Pharmaceuticals, Mumbai", manufacturing_info: "Batch manufactured 09/2026 under Schedule M.",
    submitted_price: 25, official_price: 25, status: "approved", approved_by: admin.id,
  });
  const amox = await makeMedicine(mfr1, {
    name: "Amoxicillin", generic_name: "Amoxicillin Trihydrate", strength: "500 mg", dosage_form: "Capsule",
    description: "Broad-spectrum antibiotic for bacterial infections.",
    manufacturer_info: "Cipla Pharmaceuticals, Mumbai", manufacturing_info: "Sterile manufacturing line 3.",
    submitted_price: 85, official_price: 85, status: "approved", approved_by: admin.id,
  });
  const azithro = await makeMedicine(mfr2, {
    name: "Azithromycin", generic_name: "Azithromycin Dihydrate", strength: "250 mg", dosage_form: "Tablet",
    description: "Macrolide antibiotic used for respiratory infections.",
    manufacturer_info: "Sun Pharma, Vadodara", manufacturing_info: "WHO-GMP certified facility.",
    submitted_price: 60, official_price: 60, status: "approved", approved_by: admin.id,
  });
  const ibu = await makeMedicine(mfr1, {
    name: "Ibuprofen", generic_name: "Ibuprofen", strength: "400 mg", dosage_form: "Tablet",
    description: "Nonsteroidal anti-inflammatory drug for pain and inflammation.",
    manufacturer_info: "Cipla Pharmaceuticals, Mumbai", manufacturing_info: "Batch pending validation.",
    submitted_price: 35, status: "pending",
  });
  await makeMedicine(mfr2, {
    name: "Cetirizine", generic_name: "Cetirizine Hydrochloride", strength: "10 mg", dosage_form: "Tablet",
    description: "Antihistamine for allergy relief.",
    manufacturer_info: "Sun Pharma, Vadodara", manufacturing_info: "Packaging deviation noted.",
    submitted_price: 18, status: "rejected",
    rejection_reason: "Packaging information does not match the submitted government approval document.",
  });

  console.log("Creating supply-chain records ...");
  const expiry = "2028-09-30";

  // Complete chain: manufacturer -> distributor (Paracetamol)
  const paraDist = await makeHop({
    code: "SHP-PARA-001", medicine: para, from: mfr1, fromRole: "manufacturer", to: dist1, toRole: "distributor",
    qr: "MED-PCM20260901-001", batchNo: "PCM20260901", qty: 100, expiry, complete: true,
  });

  // Partial dispatch: distributor sends 80 of 100 to pharmacist, keeps 20
  const childQty = 80;
  const { rows: childShipRows } = await pool.query(
    `INSERT INTO shipments
       (shipment_code, medicine_id, from_role, from_id, to_role, to_id, batch_no, quantity, expiry_date, status, notes,
        dispatched_at, delivered_at, received_at)
     VALUES ($1,$2,'distributor',$3,'pharmacist',$4,$5,$6,$7,'received',$8, now(), now(), now()) RETURNING *`,
    ["SHP-PARA-002", para.id, dist1.id, pharm1.id, "PCM20260901", childQty, expiry, "Split from MED-PCM20260901-001"]
  );
  const { rows: childBatchRows } = await pool.query(
    `INSERT INTO batches
       (qr_id, medicine_id, shipment_id, batch_no, quantity, remaining_qty, expiry_date,
        holder_role, holder_id, parent_qr_id, state)
     VALUES ($1,$2,$3,$4,$5,$5,$6,'pharmacist',$7,$8,'in_stock') RETURNING *`,
    ["MED-PCM20260901-002", para.id, childShipRows[0].id, "PCM20260901", childQty, expiry, pharm1.id, "MED-PCM20260901-001"]
  );
  await pool.query(`UPDATE shipments SET status = 'received' WHERE id = $1`, [paraDist.shipment.id]);
  await pool.query(
    `UPDATE batches SET remaining_qty = 20, state = 'split' WHERE id = $1`,
    [paraDist.batch.id]
  );
  await appendLedger(pool, {
    qr_id: "MED-PCM20260901-001", batch_id: paraDist.batch.id, medicine_id: para.id,
    event: "SPLIT", actor_role: "distributor", actor_id: dist1.id, actor_name: dist1.name,
    location: dist1.org_name, details: { original_qty: 100, dispatched: 80, remaining: 20, child_qr: "MED-PCM20260901-002" },
  });
  await appendLedger(pool, {
    qr_id: "MED-PCM20260901-002", batch_id: childBatchRows[0].id, medicine_id: para.id,
    shipment_id: childShipRows[0].id, event: "DISPATCHED", actor_role: "distributor", actor_id: dist1.id,
    actor_name: dist1.name, location: dist1.org_name, details: { to: pharm1.name, quantity: 80 },
  });
  await appendLedger(pool, {
    qr_id: "MED-PCM20260901-002", batch_id: childBatchRows[0].id, medicine_id: para.id,
    shipment_id: childShipRows[0].id, event: "RECEIVED", actor_role: "pharmacist", actor_id: pharm1.id,
    actor_name: pharm1.name, location: pharm1.org_name, details: { quantity: 80 },
  });

  // Incomplete chain: Amoxicillin reached the distributor but no pharmacist yet
  await makeHop({
    code: "SHP-AMOX-001", medicine: amox, from: mfr1, fromRole: "manufacturer", to: dist1, toRole: "distributor",
    qr: "MED-AMX20260815-001", batchNo: "AMX20260815", qty: 200, expiry, complete: true,
  });

  // Complete chain through a second distributor/pharmacist (Azithromycin)
  await makeHop({
    code: "SHP-AZI-001", medicine: azithro, from: mfr2, fromRole: "manufacturer", to: dist2, toRole: "distributor",
    qr: "MED-AZI20260720-001", batchNo: "AZI20260720", qty: 150, expiry, complete: true,
  });
  await makeHop({
    code: "SHP-AZI-002", medicine: azithro, from: dist2, fromRole: "distributor", to: pharm2, toRole: "pharmacist",
    qr: "MED-AZI20260720-002", batchNo: "AZI20260720", qty: 150, expiry, complete: true,
    parentQr: "MED-AZI20260720-001",
  });
  await pool.query(`UPDATE batches SET remaining_qty = 0, state = 'sold_out' WHERE qr_id = 'MED-AZI20260720-001'`);

  // A second Azithromycin batch so that the pending order below is dispatchable
  // right after seeding (dist1 must hold the ordered medicine to fulfil it).
  await makeHop({
    code: "SHP-AZI-003", medicine: azithro, from: mfr2, fromRole: "manufacturer", to: dist1, toRole: "distributor",
    qr: "MED-AZI20260720-003", batchNo: "AZI20260720", qty: 60, expiry, complete: true,
  });

  // An order waiting for the distributor
  await pool.query(
    `INSERT INTO orders (order_code, pharmacist_id, distributor_id, medicine_id, quantity, note, status)
     VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
    ["ORD-AZITHRO-001", pharm1.id, dist1.id, azithro.id, 40, "Need 40 units of Azithromycin"]
  );

  console.log("Creating a demo bill ...");
  const subtotal = 50;
  const { rows: billRows } = await pool.query(
    `INSERT INTO bills (bill_no, pharmacist_id, customer_name, customer_phone, subtotal, total_amount,
                        payment_method, verification_hash, qr_payload)
     VALUES ($1,$2,$3,$4,$5,$5,'cash','PENDING','PENDING') RETURNING *`,
    ["BILL-DEMO-0001", pharm1.id, "Priya Nair", cust.phone, subtotal]
  );
  const bill = billRows[0];
  const hash = sha256(
    `${bill.bill_no}|${bill.pharmacist_id}|${Number(bill.total_amount).toFixed(2)}|${new Date(bill.created_at).toISOString()}|${VERIFY_SALT}`
  );
  await pool.query(`UPDATE bills SET verification_hash = $2, qr_payload = $3 WHERE id = $1`, [
    bill.id, hash, `http://localhost:3000/verify-bill?bill=${bill.bill_no}&h=${hash}`,
  ]);
  await pool.query(
    `INSERT INTO bill_items (bill_id, medicine_id, medicine_name, batch_no, quantity, unit_price, line_total)
     VALUES ($1,$2,'Paracetamol','PCM20260901',2,25,50)`,
    [bill.id, para.id]
  );

  console.log("Creating a demo complaint ...");
  await pool.query(
    `INSERT INTO complaints (complaint_code, customer_id, category, medicine_id, pharmacist_id, description, status)
     VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
    ["CMP-DEMO-0001", cust.id, "medicine_quality", para.id, pharm1.id,
     "The blister pack of Paracetamol appeared slightly damaged when purchased."]
  );

  console.log("\nSeed complete.\n");
  console.log("Login accounts (password in brackets):");
  console.log("  Admin        admin@medsure.in         (Admin@123)");
  console.log("  Manufacturer manufacturer@medsure.in  (Password@123)");
  console.log("  Distributor  distributor@medsure.in   (Password@123)");
  console.log("  Pharmacist   pharmacist@medsure.in    (Password@123)");
  console.log("  Customer     customer@medsure.in      (Password@123)");

  await pool.end();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await pool.end();
  process.exit(1);
});
