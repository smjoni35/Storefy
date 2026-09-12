-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    category VARCHAR(100),
    image_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Ensures the discount column exists even on databases created before this feature
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent INTEGER NOT NULL DEFAULT 0;

-- Warranty text shown as a badge (e.g. "৬ মাস অফিসিয়াল ওয়ারেন্টি")
ALTER TABLE products ADD COLUMN IF NOT EXISTS warranty VARCHAR(255);

-- Structured spec sheet: JSON array of {"label": "...", "value": "..."} pairs, in display order
ALTER TABLE products ADD COLUMN IF NOT EXISTS specs JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100),
    total NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    payment_method VARCHAR(50) DEFAULT 'cod',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL
);

-- Extra product photos (a product can have several; products.image_url stays the main/cover photo)
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);

-- Customer reviews (no login required — name + star rating + comment)
CREATE TABLE IF NOT EXISTS product_reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);

-- Ensures verified-purchase columns exist even on databases created before this feature
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS verified_purchase BOOLEAN NOT NULL DEFAULT FALSE;

-- "Notify me when back in stock" requests — phone numbers left against an out-of-stock product.
-- No automatic SMS/WhatsApp sending is wired up (that needs a paid provider); the admin panel
-- lists these so staff can message people manually via WhatsApp once restocked.
CREATE TABLE IF NOT EXISTS stock_notify_requests (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    notified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_notify_product_id ON stock_notify_requests(product_id);

-- ==========================================================================
-- Customer accounts — phone + password login, separate from admin/staff.
-- Guest checkout still works (orders.customer_id stays NULL for guests).
-- ==========================================================================
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Link an order to the logged-in customer who placed it (NULL = guest order)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- Order money breakdown, needed for the invoice and for coupon bookkeeping
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10, 2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50);

-- ==========================================================================
-- Courier (Steadfast) integration — tracks the consignment created for an
-- order and the delivery status Steadfast reports back via webhook.
-- ==========================================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_provider VARCHAR(30);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_consignment_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_tracking_code VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_status VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_orders_courier_consignment_id ON orders(courier_consignment_id);

-- ==========================================================================
-- Product variants — Color / Storage / Size-Model combinations, each with
-- its own stock. A product with zero rows here has no variant picker and is
-- just sold at the product's own price/stock, exactly like before.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    color VARCHAR(100),
    storage VARCHAR(100),
    size_model VARCHAR(100),
    price_override NUMERIC(10, 2),
    stock INTEGER NOT NULL DEFAULT 0,
    sku VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- Which variant (if any) was ordered — variant_label is frozen at order time
-- so the invoice still reads correctly even if the variant is later edited/deleted.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_label VARCHAR(255);

-- ==========================================================================
-- Coupons / promo codes — fully self-hosted, no external/paid service.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS coupons (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('percent', 'fixed')),
    value NUMERIC(10, 2) NOT NULL,
    min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    max_discount_amount NUMERIC(10, 2),
    usage_limit INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Admin / staff table (admin, manager, moderator roles)
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'admin'
);

-- Ensures the role column exists even on databases created before this feature
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'admin';

-- Session table (used by connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL COLLATE "default" PRIMARY KEY,
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Activity log — one row per meaningful staff action (order status changes,
-- product/coupon/staff create-edit-delete). staff_username is stored as plain
-- text (not a foreign key) so the log still reads correctly even after that
-- staff account is later deleted.
CREATE TABLE IF NOT EXISTS activity_log (
    id SERIAL PRIMARY KEY,
    staff_username VARCHAR(100) NOT NULL,
    staff_role VARCHAR(20),
    action VARCHAR(255) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at DESC);

-- ==========================================================================
-- MULTI-SHOP (Phase 1) — one system running several independent shops.
-- Everything below is additive: existing single-shop deployments keep
-- working untouched because every new shop_id column defaults to the
-- "default" shop (id = 1), which is created here if it doesn't exist yet.
-- ==========================================================================
CREATE TABLE IF NOT EXISTS shops (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(100) UNIQUE NOT NULL,       -- URL segment, e.g. /shop/jm-gadget-zone
    name VARCHAR(255) NOT NULL,
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    delivery_charge_dhaka NUMERIC(10, 2) NOT NULL DEFAULT 0,
    delivery_charge_outside NUMERIC(10, 2) NOT NULL DEFAULT 0,
    telegram_chat_id VARCHAR(100),
    whatsapp_number VARCHAR(50),
    r2_prefix VARCHAR(100),                  -- image folder prefix inside the shared R2 bucket
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- The original site becomes shop #1 so nothing existing breaks. Values come
-- from the same env vars the app already used, so this matches the live site.
INSERT INTO shops (slug, name, address, phone, email, delivery_charge_dhaka, delivery_charge_outside)
SELECT 'default',
    COALESCE(NULLIF(current_setting('app.store_name', true), ''), 'JM Gadget Zone'),
    COALESCE(NULLIF(current_setting('app.store_address', true), ''), 'সম্পূর্ণ অনলাইন ভিত্তিক শপ — সারাদেশে ডেলিভারি'),
    COALESCE(NULLIF(current_setting('app.store_phone', true), ''), '01735698806'),
    NULLIF(current_setting('app.store_email', true), ''),
    0, 0
WHERE NOT EXISTS (SELECT 1 FROM shops WHERE slug = 'default');

ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_id INTEGER NOT NULL DEFAULT 1 REFERENCES shops(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shop_id INTEGER NOT NULL DEFAULT 1 REFERENCES shops(id);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS shop_id INTEGER NOT NULL DEFAULT 1 REFERENCES shops(id);
ALTER TABLE admins ADD COLUMN IF NOT EXISTS shop_id INTEGER NOT NULL DEFAULT 1 REFERENCES shops(id);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS shop_id INTEGER NOT NULL DEFAULT 1 REFERENCES shops(id);
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS shop_id INTEGER NOT NULL DEFAULT 1 REFERENCES shops(id);

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_admins_shop_id ON admins(shop_id);

-- A phone number can now repeat across different shops (each shop has its
-- own customer list), so the old single-column UNIQUE(phone) becomes
-- UNIQUE(shop_id, phone) instead.
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_shop_phone ON customers(shop_id, phone);
