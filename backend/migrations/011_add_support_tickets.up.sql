CREATE TABLE IF NOT EXISTS support_ticket_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    allow_customer_open BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_ticket_statuses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(80) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    status_on_customer_reply VARCHAR(80),
    status_on_staff_reply VARCHAR(80),
    include_in_counts BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_ticket_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(80) UNIQUE NOT NULL,
    name VARCHAR(120) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_ref VARCHAR(24) UNIQUE NOT NULL,
    title VARCHAR(220) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category_id UUID REFERENCES support_ticket_categories(id) ON DELETE SET NULL,
    status_id UUID REFERENCES support_ticket_statuses(id) ON DELETE SET NULL,
    priority_id UUID REFERENCES support_ticket_priorities(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    is_locked BOOLEAN DEFAULT FALSE,
    first_message_id UUID,
    last_message_id UUID,
    last_message_at TIMESTAMPTZ DEFAULT now(),
    last_message_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    reply_count INTEGER DEFAULT 0,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_ticket_participants (
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'participant',
    is_unread BOOLEAN DEFAULT TRUE,
    last_read_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (ticket_id, user_id)
);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

INSERT INTO support_ticket_categories (name, slug, description, sort_order)
VALUES
    ('Marketplace support', 'marketplace-support', 'Account, checkout, download, license, and marketplace issues.', 10),
    ('Product support', 'product-support', 'Questions or problems about a purchased product.', 20),
    ('Seller support', 'seller-support', 'Creator onboarding, listings, orders, payouts, and seller tools.', 30)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO support_ticket_statuses (slug, name, is_closed, status_on_customer_reply, status_on_staff_reply, include_in_counts, sort_order)
VALUES
    ('open', 'Open', FALSE, 'waiting_on_staff', 'waiting_on_customer', TRUE, 10),
    ('waiting_on_staff', 'Waiting on staff', FALSE, 'waiting_on_staff', 'waiting_on_customer', TRUE, 20),
    ('waiting_on_customer', 'Waiting on customer', FALSE, 'waiting_on_staff', 'waiting_on_customer', TRUE, 30),
    ('resolved', 'Resolved', TRUE, 'waiting_on_staff', NULL, FALSE, 40),
    ('closed', 'Closed', TRUE, NULL, NULL, FALSE, 50)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO support_ticket_priorities (slug, name, sort_order)
VALUES
    ('low', 'Low', 10),
    ('normal', 'Normal', 20),
    ('high', 'High', 30),
    ('urgent', 'Urgent', 40)
ON CONFLICT (slug) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assignee ON support_tickets(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_product ON support_tickets(product_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_participants_user ON support_ticket_participants(user_id, is_unread);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at);
