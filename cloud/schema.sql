-- NauticShield cloud schema — run in Supabase SQL editor

-- ──────────────────────────────────────────────
-- VESSELS
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vessels (
  id              TEXT        PRIMARY KEY,          -- e.g. "MY_AURORA"
  org_id          TEXT        NOT NULL,             -- Clerk organisation ID
  name            TEXT,                             -- human-readable display name
  api_key_hash    TEXT        NOT NULL,             -- SHA-256 of the vessel API key
  last_synced_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

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
-- ROW-LEVEL SECURITY  (service-role key bypasses all of these)
-- ──────────────────────────────────────────────
ALTER TABLE vessels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessel_snapshots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE voyage_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE cyber_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cyber_findings    ENABLE ROW LEVEL SECURITY;

-- No anon/authenticated policies — the cloud API uses the service-role key only.
-- If you add direct frontend access later, create policies here that check
-- a custom JWT claim against the org_id column.
