ALTER TABLE product_versions
    DROP COLUMN IF EXISTS download_count,
    DROP COLUMN IF EXISTS is_update_posted;
