CREATE TABLE IF NOT EXISTS support_ticket_feature_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_type TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    body TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (feature_type, slug)
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_feature_configs_type ON support_ticket_feature_configs(feature_type, sort_order, title);
