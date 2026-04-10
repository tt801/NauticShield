-- NauticShield cloud schema — run in Supabase SQL editor

-- ──────────────────────────────────────────────
-- VESSELS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vessels (
  id                       TEXT        PRIMARY KEY,          -- e.g. "MY_AURORA"
  org_id                   TEXT        NOT NULL,             -- Clerk organisation ID
  name                     TEXT,                             -- human-readable display name
  api_key_hash             TEXT        NOT NULL,             -- SHA-256 of the vessel API key
  last_synced_at           TIMESTAMPTZ,
  -- Stripe billing
  stripe_customer_id       TEXT,                             -- cus_xxx
  stripe_subscription_id   TEXT,                             -- sub_xxx
  plan                     TEXT        DEFAULT 'trial',      -- 'trial' | 'starter' | 'professional' | 'enterprise'
  subscription_status      TEXT        DEFAULT 'trialing',   -- Stripe status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'suspended'
  trial_ends_at            TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vessels_stripe_customer ON vessels (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_vessels_stripe_sub      ON vessels (stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_vessels_org ON vessels (org_id);

-- ──────────────────────────────────────────────
-- VESSEL SNAPSHOTS  (one row per vessel, upserted on every sync)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vessel_snapshots (
  vessel_id       TEXT        PRIMARY KEY REFERENCES vessels(id) ON DELETE CASCADE,
  synced_at       TIMESTAMPTZ NOT NULL,
  devices         JSONB       DEFAULT '[]',
  alerts          JSONB       DEFAULT '[]',
  internet_status JSONB,
  network_health  JSONB,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ──────────────────────────────────────────────
-- VOYAGE LOG  (append-only, de-duped by id+vessel_id)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voyage_log (
  id          TEXT,
  vessel_id   TEXT        REFERENCES vessels(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,
  synced_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, vessel_id)
);

CREATE INDEX IF NOT EXISTS idx_voyage_vessel ON voyage_log (vessel_id, synced_at DESC);

-- ──────────────────────────────────────────────
-- CYBER ASSESSMENTS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cyber_assessments (
  id          TEXT,
  vessel_id   TEXT        REFERENCES vessels(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,
  synced_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, vessel_id)
);

CREATE INDEX IF NOT EXISTS idx_cyber_assess_vessel ON cyber_assessments (vessel_id, synced_at DESC);

-- ──────────────────────────────────────────────
-- CYBER FINDINGS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cyber_findings (
  id          TEXT,
  vessel_id   TEXT        REFERENCES vessels(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,
  synced_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, vessel_id)
);

CREATE INDEX IF NOT EXISTS idx_cyber_findings_vessel ON cyber_findings (vessel_id, synced_at DESC);

-- ──────────────────────────────────────────────
-- AUDIT LOG  (append-only, never updated or deleted)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGSERIAL   PRIMARY KEY,
  org_id      TEXT,                                 -- Clerk org or user ID
  actor       TEXT        NOT NULL,                 -- user ID or 'system' or 'agent'
  action      TEXT        NOT NULL,                 -- e.g. 'vessel.register', 'sync.push', 'subscription.updated'
  resource    TEXT,                                 -- e.g. vessel ID or subscription ID
  metadata    JSONB       DEFAULT '{}',
  ip          TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_org      ON audit_log (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_log (actor, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action   ON audit_log (action, created_at DESC);

-- ──────────────────────────────────────────────
-- ROW-LEVEL SECURITY  (service-role key bypasses all of these)
-- ──────────────────────────────────────────────
ALTER TABLE vessels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessel_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE voyage_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cyber_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cyber_findings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log         ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies — the cloud API uses the service-role key only.
-- If you add direct frontend access later, create policies here that check
-- a custom JWT claim against the org_id column.

-- Deny all direct access to audit_log (only service-role key may write/read)
CREATE POLICY "audit_log_deny_all" ON audit_log
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false);
