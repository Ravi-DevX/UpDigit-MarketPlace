CREATE SEQUENCE IF NOT EXISTS product_public_id_seq START WITH 290682;

ALTER TABLE products ADD COLUMN IF NOT EXISTS public_id BIGINT;

CREATE TABLE IF NOT EXISTS product_slug_aliases (
    slug VARCHAR(200) PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO product_slug_aliases (slug, product_id)
SELECT slug, id FROM products
ON CONFLICT (slug) DO NOTHING;

WITH candidates AS (
    SELECT
        id,
        substring(slug FROM '^([0-9]{6,})-')::BIGINT AS candidate,
        row_number() OVER (
            PARTITION BY substring(slug FROM '^([0-9]{6,})-')
            ORDER BY created_at, id
        ) AS candidate_rank
    FROM products
    WHERE slug ~ '^[0-9]{6,}-'
)
UPDATE products AS product
SET public_id = candidates.candidate
FROM candidates
WHERE product.id = candidates.id
  AND candidates.candidate_rank = 1
  AND product.public_id IS NULL;

SELECT setval(
    'product_public_id_seq',
    COALESCE((SELECT MAX(public_id) FROM products), 290682),
    EXISTS(SELECT 1 FROM products WHERE public_id IS NOT NULL)
);

UPDATE products
SET public_id = nextval('product_public_id_seq')
WHERE public_id IS NULL;

SELECT setval('product_public_id_seq', (SELECT MAX(public_id) FROM products), true);

WITH slug_bases AS (
    SELECT
        id,
        COALESCE(
            NULLIF(
                trim(BOTH '-' FROM regexp_replace(
                    regexp_replace(
                        regexp_replace(slug, '^[0-9]{6,}-', ''),
                        '-' || public_id::text || '$',
                        ''
                    ),
                    '-+',
                    '-',
                    'g'
                )),
                ''
            ),
            'product'
        ) AS slug_base
    FROM products
)
UPDATE products AS product
SET slug = left(slug_bases.slug_base, 64) || '-' || product.public_id
FROM slug_bases
WHERE product.id = slug_bases.id;

ALTER SEQUENCE product_public_id_seq OWNED BY products.public_id;
ALTER TABLE products ALTER COLUMN public_id SET DEFAULT nextval('product_public_id_seq');
ALTER TABLE products ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS products_public_id_key ON products(public_id);

CREATE OR REPLACE FUNCTION prevent_product_public_id_change()
RETURNS trigger AS $$
BEGIN
    IF NEW.public_id IS DISTINCT FROM OLD.public_id THEN
        RAISE EXCEPTION 'product public_id is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_public_id_immutable ON products;
CREATE TRIGGER product_public_id_immutable
BEFORE UPDATE OF public_id ON products
FOR EACH ROW EXECUTE FUNCTION prevent_product_public_id_change();
