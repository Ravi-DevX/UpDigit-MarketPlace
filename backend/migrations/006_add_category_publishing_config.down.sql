ALTER TABLE categories
    DROP COLUMN IF EXISTS publishing_config,
    DROP COLUMN IF EXISTS minimum_price;
