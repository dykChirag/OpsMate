-- OpsMate schema — safe for fresh DBs and upgrades from earlier incident layouts

-- 1) Base table (old shape OK if already exists)
CREATE TABLE IF NOT EXISTS incidents (
  id            SERIAL PRIMARY KEY,
  service_name  TEXT        NOT NULL,
  severity      TEXT        NOT NULL,
  raw_context   TEXT,
  explanation   TEXT,
  suggested_fix TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2) Soft-upgrade columns BEFORE any index that references them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'title'
  ) THEN
    ALTER TABLE incidents ADD COLUMN title TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'status'
  ) THEN
    ALTER TABLE incidents ADD COLUMN status TEXT NOT NULL DEFAULT 'open';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'source'
  ) THEN
    ALTER TABLE incidents ADD COLUMN source TEXT DEFAULT 'log';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'fingerprint'
  ) THEN
    ALTER TABLE incidents ADD COLUMN fingerprint TEXT;
  END IF;

  -- Allow critical severity (drop/recreate check if present)
  BEGIN
    ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_severity_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER TABLE incidents ADD CONSTRAINT incidents_severity_check
      CHECK (severity IN ('low', 'medium', 'high', 'critical'));
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  WHEN OTHERS THEN
    NULL;
  END;
END $$;

-- 3) Indexes after columns exist
CREATE INDEX IF NOT EXISTS incidents_service_created
  ON incidents (service_name, created_at DESC);

CREATE INDEX IF NOT EXISTS incidents_status_created
  ON incidents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS incidents_fingerprint_created
  ON incidents (fingerprint, created_at DESC);

CREATE TABLE IF NOT EXISTS health_snapshots (
  id         SERIAL PRIMARY KEY,
  score      INT         NOT NULL,
  checks     JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS architecture_reviews (
  id           SERIAL PRIMARY KEY,
  score        INT,
  summary      TEXT,
  findings     JSONB NOT NULL DEFAULT '[]',
  zerops_yaml  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_actions (
  id           SERIAL PRIMARY KEY,
  incident_id  INT,
  action_type  TEXT NOT NULL,
  service_name TEXT,
  payload      JSONB,
  result       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Optional FK (ignore if incidents empty / type mismatch)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'agent_actions_incident_id_fkey'
  ) THEN
    BEGIN
      ALTER TABLE agent_actions
        ADD CONSTRAINT agent_actions_incident_id_fkey
        FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
END $$;
