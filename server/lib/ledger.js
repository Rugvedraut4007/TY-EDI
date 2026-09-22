const crypto = require("crypto");

const GENESIS = "MEDSURE-GENESIS";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

/**
 * Deterministic JSON stringify with sorted keys.
 * PostgreSQL jsonb does not preserve key order, so hashing a re-serialised
 * object would produce a different digest unless we canonicalise first.
 */
function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
}

/**
 * Append an event to the tamper-evident ledger.
 * Each block stores the previous block hash, so altering history breaks the chain.
 */
async function appendLedger(client, entry) {
  const last = await client.query(
    "SELECT hash FROM trace_ledger ORDER BY id DESC LIMIT 1"
  );
  const previous_hash = last.rows.length ? last.rows[0].hash : GENESIS;

  const payload = canonical({
    qr_id: entry.qr_id || null,
    event: entry.event,
    actor_role: entry.actor_role || null,
    actor_id: entry.actor_id || null,
    details: entry.details || null,
    previous_hash,
  });

  const hash = sha256(payload);

  const result = await client.query(
    `INSERT INTO trace_ledger
       (qr_id, batch_id, medicine_id, shipment_id, event, actor_role, actor_id,
        actor_name, location, details, previous_hash, hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      entry.qr_id || null,
      entry.batch_id || null,
      entry.medicine_id || null,
      entry.shipment_id || null,
      entry.event,
      entry.actor_role || null,
      entry.actor_id || null,
      entry.actor_name || null,
      entry.location || null,
      entry.details ? JSON.stringify(entry.details) : null,
      previous_hash,
      hash,
    ]
  );

  return result.rows[0];
}

/** Verify that the stored hash chain is intact. Returns true/false. */
async function verifyChain(client) {
  const { rows } = await client.query("SELECT * FROM trace_ledger ORDER BY id ASC");
  let previous = GENESIS;
  for (const row of rows) {
    const payload = canonical({
      qr_id: row.qr_id,
      event: row.event,
      actor_role: row.actor_role,
      actor_id: row.actor_id,
      details: row.details,
      previous_hash: row.previous_hash,
    });
    if (row.previous_hash !== previous) return false;
    if (sha256(payload) !== row.hash) return false;
    previous = row.hash;
  }
  return true;
}

module.exports = { sha256, canonical, appendLedger, verifyChain, GENESIS };
