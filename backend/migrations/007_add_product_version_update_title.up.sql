ALTER TABLE product_versions
    ADD COLUMN IF NOT EXISTS update_title VARCHAR(100);
