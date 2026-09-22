-- ============================================================
--  MedSure - Central Medicine Tracking & Management System
--  PostgreSQL schema
--  Run:  psql -U postgres -d medsure -f schema.sql
-- ============================================================

DROP TABLE IF EXISTS bill_items CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS complaints CASCADE;
DROP TABLE IF EXISTS trace_ledger CASCADE;
DROP TABLE IF EXISTS shipment_events CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS medicines CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ------------------------------------------------------------
-- Users: admin, manufacturer, distributor, pharmacist, customer
-- ------------------------------------------------------------
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('admin','manufacturer','distributor','pharmacist','customer')),
  phone       TEXT,
  address     TEXT,
  org_name    TEXT,
  license_no  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Medicines submitted by manufacturers, approved by admin
-- ------------------------------------------------------------
CREATE TABLE medicines (
  id                     SERIAL PRIMARY KEY,
  manufacturer_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  generic_name           TEXT,
  strength               TEXT,
  dosage_form            TEXT,
  description            TEXT,
  manufacturer_info      TEXT,
  manufacturing_info     TEXT,
  submitted_price        NUMERIC(10,2),
  official_price         NUMERIC(10,2),           -- centrally controlled by admin
  status                 TEXT NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','approved','rejected')),
  rejection_reason       TEXT,
  approval_document      TEXT,                     -- base64 data URL or file path
  approval_document_name TEXT,
  approved_by            INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Shipments move medicine between roles
-- (manufacturer -> distributor, distributor -> pharmacist)
-- ------------------------------------------------------------
CREATE TABLE shipments (
  id            SERIAL PRIMARY KEY,
  shipment_code TEXT UNIQUE NOT NULL,
  medicine_id   INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  from_role     TEXT NOT NULL,
  from_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_role       TEXT NOT NULL,
  to_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  batch_no      TEXT NOT NULL,
  quantity      INTEGER NOT NULL,
  expiry_date   DATE,
  status        TEXT NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created','dispatched','in_transit','out_for_delivery',
                                    'delivered','received','cancelled','damaged','rejected')),
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispatched_at TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  received_at   TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- Shipment status timeline
-- ------------------------------------------------------------
CREATE TABLE shipment_events (
  id          SERIAL PRIMARY KEY,
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  note        TEXT,
  actor_role  TEXT,
  actor_id    INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Batches / QR packages (supports partial dispatch / split)
-- ------------------------------------------------------------
CREATE TABLE batches (
  id           SERIAL PRIMARY KEY,
  qr_id        TEXT UNIQUE NOT NULL,
  medicine_id  INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  shipment_id  INTEGER REFERENCES shipments(id) ON DELETE SET NULL,
  batch_no     TEXT NOT NULL,
  quantity     INTEGER NOT NULL,
  remaining_qty INTEGER NOT NULL,
  expiry_date  DATE,
  holder_role  TEXT,
  holder_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  parent_qr_id TEXT,
  state        TEXT NOT NULL DEFAULT 'in_transit'
                 CHECK (state IN ('in_transit','in_stock','split','sold_out')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Tamper-evident traceability ledger (hash chained)
-- ------------------------------------------------------------
CREATE TABLE trace_ledger (
  id            SERIAL PRIMARY KEY,
  qr_id         TEXT,
  batch_id      INTEGER,
  medicine_id   INTEGER,
  shipment_id   INTEGER,
  event         TEXT NOT NULL,
  actor_role    TEXT,
  actor_id      INTEGER,
  actor_name    TEXT,
  location      TEXT,
  details       JSONB,
  previous_hash TEXT,
  hash          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Pharmacist orders to distributors
-- ------------------------------------------------------------
CREATE TABLE orders (
  id             SERIAL PRIMARY KEY,
  order_code     TEXT UNIQUE NOT NULL,
  pharmacist_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  distributor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medicine_id    INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  quantity       INTEGER NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','dispatched','completed','rejected')),
  note           TEXT,
  shipment_id    INTEGER REFERENCES shipments(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- Pharmacy bills (POS)
-- ------------------------------------------------------------
CREATE TABLE bills (
  id                SERIAL PRIMARY KEY,
  bill_no           TEXT UNIQUE NOT NULL,
  pharmacist_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_name     TEXT,
  customer_phone    TEXT,
  subtotal          NUMERIC(10,2) NOT NULL,
  total_amount      NUMERIC(10,2) NOT NULL,
  payment_method    TEXT NOT NULL DEFAULT 'cash',
  verification_hash TEXT NOT NULL,
  qr_payload        TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bill_items (
  id            SERIAL PRIMARY KEY,
  bill_id       INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  medicine_id   INTEGER REFERENCES medicines(id) ON DELETE SET NULL,
  medicine_name TEXT NOT NULL,
  batch_no      TEXT,
  quantity      INTEGER NOT NULL,
  unit_price    NUMERIC(10,2) NOT NULL,
  line_total    NUMERIC(10,2) NOT NULL
);

-- ------------------------------------------------------------
-- Customer complaints
-- ------------------------------------------------------------
CREATE TABLE complaints (
  id             SERIAL PRIMARY KEY,
  complaint_code TEXT UNIQUE NOT NULL,
  customer_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category       TEXT NOT NULL,
  medicine_id    INTEGER REFERENCES medicines(id) ON DELETE SET NULL,
  pharmacist_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  bill_id        INTEGER REFERENCES bills(id) ON DELETE SET NULL,
  description    TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','under_review','resolved','rejected')),
  admin_note     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- Indexes
-- ------------------------------------------------------------
CREATE INDEX idx_medicines_manufacturer ON medicines(manufacturer_id);
CREATE INDEX idx_medicines_status       ON medicines(status);
CREATE INDEX idx_shipments_from         ON shipments(from_id);
CREATE INDEX idx_shipments_to           ON shipments(to_id);
CREATE INDEX idx_batches_qr             ON batches(qr_id);
CREATE INDEX idx_batches_holder         ON batches(holder_id);
CREATE INDEX idx_ledger_qr              ON trace_ledger(qr_id);
CREATE INDEX idx_orders_pharmacist      ON orders(pharmacist_id);
CREATE INDEX idx_orders_distributor     ON orders(distributor_id);
CREATE INDEX idx_bills_pharmacist       ON bills(pharmacist_id);
CREATE INDEX idx_complaints_customer    ON complaints(customer_id);
