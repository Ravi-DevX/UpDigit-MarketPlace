DROP TRIGGER IF EXISTS product_public_id_immutable ON products;
DROP FUNCTION IF EXISTS prevent_product_public_id_change();
DROP INDEX IF EXISTS products_public_id_key;
DROP TABLE IF EXISTS product_slug_aliases;
ALTER TABLE products DROP COLUMN IF EXISTS public_id;
DROP SEQUENCE IF EXISTS product_public_id_seq;
