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

-- Self-service shop content: each shop's own owner edits these from
-- /admin/settings instead of asking the platform owner to change them.
-- DEFAULT here backfills every existing shop with today's static copy
-- (nothing visibly changes until an owner edits it), and new shops get
-- the same starting point automatically.
ALTER TABLE shops ADD COLUMN IF NOT EXISTS return_policy TEXT DEFAULT
'পণ্য হাতে পাওয়ার ৭ দিনের মধ্যে রিটার্ন বা এক্সচেঞ্জের জন্য আবেদন করতে হবে। এই সময়ের পরে করা কোনো অনুরোধ গ্রহণযোগ্য নয়।

যেসব ক্ষেত্রে রিটার্ন/এক্সচেঞ্জ গ্রহণযোগ্য: পণ্যটি ত্রুটিপূর্ণ বা ড্যামেজড অবস্থায় পৌঁছালে, অর্ডার করা পণ্যের বদলে ভুল পণ্য পাঠানো হলে, অথবা পণ্যের বর্ণনার সাথে বাস্তব পণ্যের উল্লেখযোগ্য অমিল থাকলে।

শর্তাবলী: পণ্যটি অবশ্যই অব্যবহৃত, অক্ষত এবং মূল প্যাকেজিং/বক্সসহ ফেরত দিতে হবে। সাথে অরিজিনাল ইনভয়েস বা অর্ডার আইডি থাকতে হবে। ব্যবহারজনিত ক্ষতি বা নিজে থেকে খোলা/মেরামত করা পণ্য রিটার্নযোগ্য নয়।

রিফান্ড: রিটার্ন করা পণ্য যাচাইয়ের পর ৩-৫ কার্যদিবসের মধ্যে রিফান্ড প্রসেস করা হয় (ক্যাশ অন ডেলিভারি অর্ডারের ক্ষেত্রে বিকাশ/নগদ বা ব্যাংক অ্যাকাউন্টে)। এক্সচেঞ্জের ক্ষেত্রে নতুন পণ্য স্টক সাপেক্ষে পাঠানো হবে।';

ALTER TABLE shops ADD COLUMN IF NOT EXISTS faq JSONB DEFAULT
'[
  {"question": "অর্ডার করতে কি অ্যাকাউন্ট খুলতে হবে?", "answer": "না, আমাদের সাইটে কোনো অ্যাকাউন্ট বা রেজিস্ট্রেশন ছাড়াই অর্ডার করা যায়। শুধু নাম, ফোন নম্বর ও ঠিকানা দিলেই অর্ডার সম্পন্ন হয়ে যাবে।"},
  {"question": "পেমেন্ট কীভাবে করব?", "answer": "আমরা ক্যাশ অন ডেলিভারি সুবিধা দিচ্ছি — পণ্য হাতে পাওয়ার পর টাকা পরিশোধ করতে পারবেন। এখনই অগ্রিম কোনো টাকা দিতে হয় না।"},
  {"question": "ডেলিভারি পেতে কত সময় লাগে?", "answer": "সাধারণত ঢাকার ভিতরে ২-৩ দিনের মধ্যে ডেলিভারি সম্পন্ন হয়। ঢাকার বাইরে একটু বেশি সময় লাগতে পারে।"},
  {"question": "ডেলিভারি চার্জ কত?", "answer": "ডেলিভারি চার্জ চেকআউট পেজে অর্ডার কনফার্ম করার আগেই স্পষ্টভাবে দেখানো হয়, যাতে কোনো লুকানো খরচ না থাকে।"},
  {"question": "আমার অর্ডার কীভাবে ট্র্যাক করব?", "answer": "যে ফোন নম্বর দিয়ে অর্ডার করেছিলেন, সেটি দিয়ে অর্ডার ট্র্যাকিং পেজে গিয়ে বর্তমান স্ট্যাটাস দেখতে পারবেন — কোনো অ্যাকাউন্টের দরকার নেই।"},
  {"question": "পণ্য পছন্দ না হলে রিটার্ন করা যাবে?", "answer": "হ্যাঁ, পণ্য হাতে পাওয়ার ৭ দিনের মধ্যে নির্দিষ্ট শর্তসাপেক্ষে রিটার্ন বা এক্সচেঞ্জ করা যায়। বিস্তারিত জানতে আমাদের রিটার্ন ও এক্সচেঞ্জ পলিসি পড়ুন।"},
  {"question": "পণ্যগুলো কি অরিজিনাল?", "answer": "হ্যাঁ, আমরা ১০০% অরিজিনাল ও যাচাইকৃত পণ্য বিক্রি করি। কোনো নকল বা রিফার্বিশড পণ্য বিক্রি করা হয় না।"},
  {"question": "প্রোডাক্ট স্টকে না থাকলে কী করব?", "answer": "স্টক শেষ হয়ে যাওয়া প্রোডাক্টের পেজে \"স্টক এলে জানান\" ফর্মে আপনার ফোন নম্বর দিয়ে রাখতে পারেন — স্টক আসলে আমরা আপনাকে জানানোর চেষ্টা করব।"}
]'::jsonb;

-- A phone number can now repeat across different shops (each shop has its
-- own customer list), so the old single-column UNIQUE(phone) becomes
-- UNIQUE(shop_id, phone) instead.
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_phone_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_shop_phone ON customers(shop_id, phone);
