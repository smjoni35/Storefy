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
    `).join('') : `<p class="empty">এখনও কোনো শপ যোগ করা হয়নি — নিচের ফর্ম দিয়ে প্রথমটি যোগ করুন।</p>`;

    res.send(`
        <!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Storefy — শপ ম্যানেজার</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Poppins:wght@600;700&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
        <style>
            :root {
                --bg: #FFFFFF;
                --surface: #F8F9FC;
                --ink: #0F172A;
                --muted: #64748B;
                --line: #E4E7EC;
                --blue: #2F80ED;
                --purple: #7B2FF7;
                --gradient: linear-gradient(90deg, var(--blue), var(--purple));
                --accent-soft: #EEF1FF;
                --danger: #DC3B5D;
                --danger-soft: #FCEAEF;
            }
            * { box-sizing: border-box; }
            body {
                font-family: 'Hind Siliguri', sans-serif;
                background: var(--bg);
                color: var(--ink);
                max-width: 480px;
                margin: 0 auto;
                padding: 28px 20px 60px;
                line-height: 1.5;
            }
            .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
            .brand-icon { flex: 0 0 auto; }
            .brand-mark { font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 1.4rem; letter-spacing: -0.01em; color: var(--ink); }
            .brand-mark .fy { background: var(--gradient); -webkit-background-clip: text; background-clip: text; color: transparent; }
            .lede { font-size: 0.86rem; color: var(--muted); margin: 0 0 28px; }

            h2 {
                font-family: 'Poppins', sans-serif;
                font-size: 0.98rem;
                font-weight: 600;
                margin: 0 0 14px;
                padding-bottom: 10px;
                border-bottom: 1px solid var(--line);
            }
            section { margin-bottom: 36px; }

            .entry { display: flex; align-items: center; gap: 12px; padding: 12px 10px; border-radius: 10px; }
            .entry + .entry { margin-top: 2px; }
            .entry:nth-child(odd) { background: var(--surface); }
            .entry-id { font-family: 'IBM Plex Mono', monospace; font-size: 0.76rem; color: var(--muted); flex: 0 0 auto; }
            .entry-body { flex: 1 1 auto; min-width: 0; }
            .entry-name { font-weight: 600; font-size: 0.95rem; }
            .entry-meta { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
            .entry-slug { font-family: 'IBM Plex Mono', monospace; font-size: 0.75rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .status { font-size: 0.72rem; font-weight: 600; padding: 1px 8px; border-radius: 20px; }
            .status.is-active { background: var(--accent-soft); color: var(--purple); }
            .status.is-inactive { background: var(--danger-soft); color: var(--danger); }
            .entry-link { flex: 0 0 auto; font-size: 0.84rem; font-weight: 600; color: var(--blue); text-decoration: none; }
            .empty { color: var(--muted); font-size: 0.9rem; padding: 8px 0; }

            fieldset { border: none; padding: 0; margin: 0 0 24px; }
            .field-group-label { font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 0.84rem; margin: 0 0 12px; }
            label { display: block; font-size: 0.82rem; color: var(--muted); margin-bottom: 4px; }
            .field { margin-bottom: 16px; }
            input {
                width: 100%;
                font-family: inherit;
                font-size: 0.95rem;
                color: var(--ink);
                background: var(--surface);
                border: 1px solid var(--line);
                border-radius: 8px;
                padding: 10px 12px;
                outline: none;
            }
            input:focus { border-color: var(--blue); box-shadow: 0 0 0 3px var(--accent-soft); }
            input::placeholder { color: #A3ADBD; }
            .row-2 { display: flex; gap: 12px; }
            .row-2 .field { flex: 1; }

            button {
                width: 100%;
                font-family: 'Poppins', sans-serif;
                font-size: 0.96rem;
                font-weight: 600;
                background: var(--gradient);
                color: #fff;
                border: none;
                border-radius: 8px;
                padding: 13px;
                margin-top: 8px;
                cursor: pointer;
            }
            button:hover { opacity: 0.92; }
            button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
        </style></head><body>

        <div class="brand">
            <svg class="brand-icon" width="26" height="26" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#2F80ED"/><stop offset="100%" stop-color="#7B2FF7"/>
                </linearGradient></defs>
                <path d="M50 6 L92 27 V73 L50 94 L8 73 V27 Z" fill="url(#g1)"/>
                <path d="M20 34 L80 34 L50 50 Z" fill="#FFFFFF" opacity="0.9"/>
                <path d="M20 66 L80 66 L50 50 Z" fill="#FFFFFF" opacity="0.55"/>
            </svg>
            <span class="brand-mark">Store<span class="fy">fy</span></span>
        </div>
        <p class="lede">আপনার প্ল্যাটফর্মের অধীনে থাকা সব শপ এখানে দেখুন এবং নতুন শপ যোগ করুন।</p>

        <section>
            <h2>আপনার শপসমূহ</h2>
            ${entriesHtml}
        </section>

        <section>
            <h2>নতুন শপ যোগ করুন</h2>
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

                <button type="submit">শপ তৈরি করুন</button>
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
