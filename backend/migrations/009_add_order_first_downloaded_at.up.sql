ALTER TABLE orders
ADD COLUMN IF NOT EXISTS first_downloaded_at TIMESTAMPTZ;

UPDATE orders o
SET first_downloaded_at = downloaded.first_downloaded_at
FROM (
    SELECT order_id, MIN(created_at) AS first_downloaded_at
    FROM download_tokens
    WHERE used = true
    GROUP BY order_id
) downloaded
WHERE o.id = downloaded.order_id
  AND o.first_downloaded_at IS NULL;
