DROP INDEX IF EXISTS idx_support_ticket_categories_parent;
ALTER TABLE support_ticket_categories DROP COLUMN IF EXISTS parent_id;
