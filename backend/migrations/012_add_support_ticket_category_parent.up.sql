ALTER TABLE support_ticket_categories
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES support_ticket_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_support_ticket_categories_parent ON support_ticket_categories(parent_id);
