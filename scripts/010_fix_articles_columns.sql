-- Ensure all required columns exist on the articles table.
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks).

-- author_name column
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT '';

-- author_id column  
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id TEXT DEFAULT '';

-- image_url as text array (migrate from text if needed)
DO $$
BEGIN
  -- Check if image_url column exists at all
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE articles ADD COLUMN image_url TEXT[] DEFAULT ARRAY[]::TEXT[];
  ELSE
    -- It exists — check if it is already an array type
    IF (
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'articles' AND column_name = 'image_url'
    ) = 'ARRAY' THEN
      -- Already array, nothing to do
      NULL;
    ELSE
      -- It's text — convert it
      ALTER TABLE articles ALTER COLUMN image_url TYPE TEXT[] USING ARRAY[image_url]::TEXT[];
    END IF;
  END IF;
END;
$$;
