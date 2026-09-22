/** Generate a short unique human-readable code, e.g. SHP-LK3A-9F2C. */
function genCode(prefix) {
  const stamp = Date.now().toString(36).toUpperCase().slice(-5);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
}

/** Build a QR identifier for a medicine batch, e.g. MED-PCM20260901-001. */
async function genQrId(client, batchNo, seq) {
  const padded = String(seq).padStart(3, "0");
  let candidate = `MED-${batchNo}-${padded}`;
  let n = seq;
  // Guarantee uniqueness even for repeated batch numbers.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await client.query("SELECT 1 FROM batches WHERE qr_id = $1", [candidate]);
    if (!existing.rows.length) return candidate;
    n += 1;
    candidate = `MED-${batchNo}-${String(n).padStart(3, "0")}`;
  }
}

/** Wrap an async route handler so rejected promises reach the error middleware. */
function asyncH(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** Walk parent_qr_id links to build the full lineage (oldest first). */
async function getBatchLineage(client, qrId) {
  const lineage = [];
  let current = qrId;
  while (current) {
    lineage.unshift(current);
    const { rows } = await client.query("SELECT parent_qr_id FROM batches WHERE qr_id = $1", [current]);
    current = rows.length ? rows[0].parent_qr_id : null;
  }
  return lineage;
}

/** Determine which supply-chain stages a batch has passed through. */
async function getChainStages(client, qrId) {
  const lineage = await getBatchLineage(client, qrId);
  const { rows } = await client.query(
    `SELECT DISTINCT actor_role FROM trace_ledger WHERE qr_id = ANY($1::text[])`,
    [lineage]
  );
  const roles = rows.map((r) => r.actor_role);
  const stages = {
    manufacturer: roles.includes("manufacturer"),
    distributor: roles.includes("distributor"),
    pharmacist: roles.includes("pharmacist"),
    customer: roles.includes("customer"),
  };
  stages.complete = stages.manufacturer && stages.distributor && stages.pharmacist;
  return { lineage, stages };
}

module.exports = { genCode, genQrId, asyncH, getBatchLineage, getChainStages };
