-- Explicit no-action / informational flag for health scoring.
-- Open incidents with no_action = true do not deduct from the open-incidents budget.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'no_action'
  ) THEN
    ALTER TABLE incidents ADD COLUMN no_action BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS incidents_open_scoring
  ON incidents (project_id, status, no_action)
  WHERE COALESCE(status, 'open') = 'open' AND no_action = false;
