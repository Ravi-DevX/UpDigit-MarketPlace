ALTER TABLE product_versions
    ADD COLUMN IF NOT EXISTS is_update_posted BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS download_count BIGINT NOT NULL DEFAULT 0;

UPDATE product_versions
SET is_update_posted = FALSE
WHERE update_title IS NULL
  AND COALESCE(BTRIM(changelog), '') = '';
