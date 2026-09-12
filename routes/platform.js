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

router.get('/shops', async (req, res) => {
    const { rows: shops } = await pool.query('SELECT * FROM shops ORDER BY id ASC');
    const key = req.query.key;
    const rowsHtml = shops.map(s => `
        <tr>
            <td>${s.id}</td>
            <td>${s.slug}</td>
            <td>${s.name}</td>
            <td>${s.active ? '✅' : '❌'}</td>
            <td><a href="${s.slug === 'default' ? '/' : '/shop/' + s.slug}" target="_blank">দেখুন</a></td>
        </tr>
    `).join('');

    res.send(`
        <!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>শপ ম্যানেজমেন্ট</title>
        <style>
            body { font-family: sans-serif; max-width: 560px; margin: 20px auto; padding: 0 12px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            td, th { border: 1px solid #ccc; padding: 6px 8px; text-align: left; font-size: 14px; }
            input, button { width: 100%; padding: 10px; margin: 6px 0; box-sizing: border-box; font-size: 15px; }
            button { background: #16a34a; color: white; border: none; border-radius: 6px; }
            fieldset { border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
        </style></head><body>
        <h2>শপ তালিকা</h2>
        <table><tr><th>ID</th><th>Slug</th><th>নাম</th><th>Active</th><th></th></tr>${rowsHtml}</table>

        <h2>নতুন শপ তৈরি করুন</h2>
        <form method="POST" action="/platform/shops?key=${key}">
            <input type="hidden" name="key" value="${key}">
            <fieldset>
                <label>Slug (URL-এ ব্যবহার হবে, শুধু ইংরেজি/সংখ্যা/হাইফেন)</label>
                <input name="slug" placeholder="e.g. rahim-electronics" required pattern="[a-z0-9-]+">
                <label>শপের নাম</label>
                <input name="name" placeholder="e.g. Rahim Electronics" required>
                <label>ঠিকানা</label>
                <input name="address" placeholder="ঠিকানা (ঐচ্ছিক)">
                <label>ফোন</label>
                <input name="phone" placeholder="ফোন (ঐচ্ছিক)">
                <label>ইমেইল</label>
                <input name="email" placeholder="ইমেইল (ঐচ্ছিক)">
                <label>ঢাকার মধ্যে ডেলিভারি চার্জ</label>
                <input name="delivery_charge_dhaka" type="number" placeholder="70">
                <label>ঢাকার বাইরে ডেলিভারি চার্জ</label>
                <input name="delivery_charge_outside" type="number" placeholder="130">
                <hr>
                <label>এই শপের প্রথম অ্যাডমিন — Username</label>
                <input name="admin_username" placeholder="e.g. rahim" required>
                <label>এই শপের প্রথম অ্যাডমিন — Password</label>
                <input name="admin_password" type="text" placeholder="একটা শক্ত পাসওয়ার্ড দিন" required>
                <button type="submit">শপ তৈরি করুন</button>
            </fieldset>
        </form>
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
