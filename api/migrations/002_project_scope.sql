-- Scope incidents per Zerops project
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE incidents ADD COLUMN project_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'incidents' AND column_name = 'project_name'
  ) THEN
    ALTER TABLE incidents ADD COLUMN project_name TEXT;
  END IF;
END $$;

-- Existing rows without project → sandbox (local-only bucket)
UPDATE incidents
SET project_id = 'sandbox', project_name = 'Local sandbox'
WHERE project_id IS NULL;

CREATE INDEX IF NOT EXISTS incidents_project_created
  ON incidents (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS incidents_project_status
  ON incidents (project_id, status, created_at DESC);
