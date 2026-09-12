const pool = require('../db/pool');

// Resolves which shop the current request belongs to, using a URL path
// prefix — no domain purchase needed:
//
//   /                         -> the original/default shop (old links keep working)
//   /shop/:slug/...           -> that shop's storefront
//   /shop/:slug/admin/...     -> that shop's admin panel
//
// Attaches req.shop (full row from the `shops` table) and strips the
// "/shop/:slug" prefix from req.url so every existing route in
// routes/shop.js, routes/admin.js, routes/customer.js keeps working
// completely unchanged — they never need to know a prefix existed.
async function resolveShop(req, res, next) {
    const match = req.url.match(/^\/shop\/([a-z0-9-]+)(\/.*|$)/i);

    let slug = 'default';
    let rest = req.url;

    if (match) {
        slug = match[1];
        rest = match[2] || '/';
    }

    try {
        const { rows } = await pool.query(
            'SELECT * FROM shops WHERE slug = $1 AND active = TRUE',
            [slug]
        );

        if (rows.length === 0) {
            return res.status(404).render('404');
        }

        req.shop = rows[0];
        // shopPath: helper for building links that stay inside this shop
        // (e.g. `${req.shopPath}/product/${id}` instead of a hardcoded `/product/${id}`)
        req.shopPath = slug === 'default' ? '' : `/shop/${slug}`;

        if (match) {
            req.url = rest;
        }

        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { resolveShop };
