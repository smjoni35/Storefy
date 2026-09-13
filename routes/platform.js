const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

// This is YOU (the platform owner), not a shop owner — it creates new shops
// and each shop's first admin login. Protected by a single shared secret
// (PLATFORM_KEY in .env) rather than a full login system, since there's
// only ever one person using this. Set PLATFORM_KEY in your .env before
// using this route, and never share that URL/key with shop owners.
function requirePlatformKey(req, res, next) {
    const key = req.query.key || req.body.key;
    if (!process.env.PLATFORM_KEY || key !== process.env.PLATFORM_KEY) {
        return res.status(403).send('ভুল বা অনুপস্থিত platform key। ?key=... দিয়ে আবার চেষ্টা করুন।');
    }
    next();
}

router.use(requirePlatformKey);

// Small helper: escape user-entered text before it goes into raw HTML
// (shop name/slug come from the owner via this same form, but escaping
// costs nothing and avoids a broken page if a name ever contains < or &).
function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

router.get('/shops', async (req, res) => {
    const { rows: shops } = await pool.query('SELECT * FROM shops ORDER BY id ASC');
    const key = req.query.key;

    const entriesHtml = shops.length ? shops.map(s => `
        <div class="entry">
            <span class="entry-id">#${s.id}</span>
            <div class="entry-body">
                <div class="entry-name">${esc(s.name)}</div>
                <div class="entry-meta">
                    <span class="entry-slug">${esc(s.slug)}</span>
                    <span class="status ${s.active ? 'is-active' : 'is-inactive'}">${s.active ? 'সচল' : 'বন্ধ'}</span>
                </div>
            </div>
            <a class="entry-link" href="${s.slug === 'default' ? '/' : '/shop/' + s.slug}" target="_blank">দেখুন</a>
        </div>
    `).join('') : `<p class="empty">এখনও কোনো শপ নিবন্ধিত হয়নি — নিচের ফর্ম দিয়ে প্রথমটি যোগ করুন।</p>`;

    res.send(`
        <!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Storefy — শপ রেজিস্ট্রি</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
        <style>
            :root {
                --paper: #F7F5EF;
                --ink: #1C1B18;
                --muted: #8B8477;
                --line: #DDD7C7;
                --accent: #1F5D50;
                --accent-soft: #E3EEE8;
                --danger: #B14434;
            }
            * { box-sizing: border-box; }
            body {
                font-family: 'Hind Siliguri', sans-serif;
                background: var(--paper);
                color: var(--ink);
                max-width: 480px;
                margin: 0 auto;
                padding: 28px 20px 60px;
                line-height: 1.5;
            }
            .brand { display: flex; align-items: baseline; gap: 10px; margin-bottom: 2px; }
            .brand-mark { font-weight: 700; font-size: 1.5rem; letter-spacing: -0.01em; }
            .brand-tag { font-size: 0.8rem; color: var(--muted); }
            .lede { font-size: 0.88rem; color: var(--muted); margin: 0 0 28px; }

            h2 {
                font-size: 1.05rem;
                font-weight: 600;
                margin: 0 0 14px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--line);
            }
            section { margin-bottom: 36px; }

            .entry { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--line); }
            .entry:last-child { border-bottom: none; }
            .entry-id { font-family: 'IBM Plex Mono', monospace; font-size: 0.78rem; color: var(--muted); flex: 0 0 auto; }
            .entry-body { flex: 1 1 auto; min-width: 0; }
            .entry-name { font-weight: 600; font-size: 0.95rem; }
            .entry-meta { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
            .entry-slug { font-family: 'IBM Plex Mono', monospace; font-size: 0.76rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .status { font-size: 0.74rem; padding: 1px 8px; border-radius: 3px; }
            .status.is-active { background: var(--accent-soft); color: var(--accent); }
            .status.is-inactive { background: #F3E4E1; color: var(--danger); }
            .entry-link { flex: 0 0 auto; font-size: 0.85rem; color: var(--accent); text-decoration: underline; text-underline-offset: 2px; }
            .empty { color: var(--muted); font-size: 0.9rem; padding: 8px 0; }

            fieldset { border: none; padding: 0; margin: 0 0 24px; }
            .field-group-label { font-weight: 600; font-size: 0.88rem; margin: 0 0 12px; }
            label { display: block; font-size: 0.82rem; color: var(--muted); margin-bottom: 4px; }
            .field { margin-bottom: 16px; }
            input {
                width: 100%;
                font-family: inherit;
                font-size: 0.95rem;
                color: var(--ink);
                background: transparent;
                border: none;
                border-bottom: 1px solid var(--line);
                padding: 6px 2px;
                outline: none;
            }
            input:focus { border-bottom: 1.5px solid var(--accent); }
            input::placeholder { color: #B7B0A0; }
            .row-2 { display: flex; gap: 16px; }
            .row-2 .field { flex: 1; }

            button {
                width: 100%;
                font-family: inherit;
                font-size: 0.98rem;
                font-weight: 600;
                background: var(--accent);
                color: var(--paper);
                border: none;
                border-radius: 4px;
                padding: 13px;
                margin-top: 8px;
                cursor: pointer;
            }
            button:hover { background: #17473d; }
            button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        </style></head><body>

        <div class="brand"><span class="brand-mark">Storefy</span><span class="brand-tag">শপ রেজিস্ট্রি</span></div>
        <p class="lede">আপনার প্ল্যাটফর্মের অধীনে থাকা সব শপ এখানে দেখুন এবং নতুন শপ নিবন্ধন করুন।</p>

        <section>
            <h2>নিবন্ধিত শপ</h2>
            ${entriesHtml}
        </section>

        <section>
            <h2>নতুন শপ নিবন্ধন</h2>
            <form method="POST" action="/platform/shops?key=${esc(key)}">
                <input type="hidden" name="key" value="${esc(key)}">
                <input type="hidden" name="_csrf" value="${esc(req.session.csrfToken)}">

                <fieldset>
                    <p class="field-group-label">শপের তথ্য</p>
                    <div class="field">
                        <label>Slug — URL-এ ব্যবহার হবে, শুধু ইংরেজি/সংখ্যা/হাইফেন</label>
                        <input name="slug" placeholder="e.g. rahim-electronics" required pattern="[a-z0-9-]+">
                    </div>
                    <div class="field">
                        <label>শপের নাম</label>
                        <input name="name" placeholder="e.g. Rahim Electronics" required>
                    </div>
                    <div class="field">
                        <label>ঠিকানা (ঐচ্ছিক)</label>
                        <input name="address" placeholder="ঠিকানা">
                    </div>
                    <div class="row-2">
                        <div class="field">
                            <label>ফোন (ঐচ্ছিক)</label>
                            <input name="phone" placeholder="ফোন">
                        </div>
                        <div class="field">
                            <label>ইমেইল (ঐচ্ছিক)</label>
                            <input name="email" placeholder="ইমেইল">
                        </div>
                    </div>
                </fieldset>

                <fieldset>
                    <p class="field-group-label">ডেলিভারি চার্জ</p>
                    <div class="row-2">
                        <div class="field">
                            <label>ঢাকার মধ্যে</label>
                            <input name="delivery_charge_dhaka" type="number" placeholder="70">
                        </div>
                        <div class="field">
                            <label>ঢাকার বাইরে</label>
                            <input name="delivery_charge_outside" type="number" placeholder="130">
                        </div>
                    </div>
                </fieldset>

                <fieldset>
                    <p class="field-group-label">এই শপের প্রথম অ্যাডমিন</p>
                    <div class="field">
                        <label>Username</label>
                        <input name="admin_username" placeholder="e.g. rahim" required>
                    </div>
                    <div class="field">
                        <label>Password</label>
                        <input name="admin_password" type="text" placeholder="একটা শক্ত পাসওয়ার্ড দিন" required>
                    </div>
                </fieldset>

                <button type="submit">শপ নিবন্ধন করুন</button>
            </form>
        </section>
    </body></html>`);
});

router.post('/shops', async (req, res) => {
    const { slug, name, address, phone, email, admin_username, admin_password } = req.body;
    const deliveryDhaka = parseFloat(req.body.delivery_charge_dhaka) || 0;
    const deliveryOutside = parseFloat(req.body.delivery_charge_outside) || 0;
    const key = req.query.key || req.body.key;

    if (!slug || !/^[a-z0-9-]+$/.test(slug) || slug === 'default') {
        return res.status(400).send('Slug আবশ্যক, শুধু ছোট হাতের ইংরেজি/সংখ্যা/হাইফেন, এবং "default" ব্যবহার করা যাবে না।');
    }
    if (!name || !admin_username || !admin_password) {
        return res.status(400).send('নাম, admin username ও password আবশ্যক।');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const shopResult = await client.query(
            `INSERT INTO shops (slug, name, address, phone, email, delivery_charge_dhaka, delivery_charge_outside)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [slug, name, address || null, phone || null, email || null, deliveryDhaka, deliveryOutside]
        );
        const shopId = shopResult.rows[0].id;

        const hash = await bcrypt.hash(admin_password, 10);
        await client.query(
            'INSERT INTO admins (username, password_hash, role, shop_id) VALUES ($1, $2, $3, $4)',
            [admin_username, hash, 'admin', shopId]
        );

        await client.query('COMMIT');
        res.redirect(`/platform/shops?key=${key}`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create shop failed:', err);
        if (err.code === '23505') {
            return res.status(400).send('এই slug বা admin username ইতিমধ্যে ব্যবহৃত হয়েছে।');
        }
        res.status(500).send('শপ তৈরি করা যায়নি, আবার চেষ্টা করুন।');
    } finally {
        client.release();
    }
});

module.exports = router;
