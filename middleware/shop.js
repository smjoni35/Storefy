const pool = require('../db/pool');

// Resolves which shop the current request belongs to, using a URL path
// prefix — no domain purchase needed:
//
//   /shop/:slug/...           -> that shop's storefront
//   /shop/:slug/admin/...     -> that shop's admin panel
//
// Root (/) is no longer a shop at all — it's the Storefy brand/marketing
// site (routes/brand.js), mounted before this middleware in server.js so it
// never even reaches here. Anything else that doesn't have a /shop/:slug
// prefix is an old bare-URL link from before that change (product pages,
// /cart, /admin, WhatsApp order confirmations already sent to customers,
// etc. from when the first shop lived at root) — redirect those to their
// new home instead of breaking them.
//
// Attaches req.shop (full row from the `shops` table) and strips the
// "/shop/:slug" prefix from req.url so every existing route in
// routes/shop.js, routes/admin.js, routes/customer.js keeps working
// completely unchanged — they never need to know a prefix existed.
const LEGACY_SHOP_SLUG = 'jm-gadget-zone';

async function resolveShop(req, res, next) {
    const match = req.url.match(/^\/shop\/([a-z0-9-]+)(\/.*|$)/i);

    if (!match) {
        return res.redirect(301, `/shop/${LEGACY_SHOP_SLUG}${req.url}`);
    }

    const slug = match[1];
    const rest = match[2] || '/';

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
        req.shopPath = `/shop/${slug}`;
        req.url = rest;

        next();
    } catch (err) {
        next(err);
    }
}

module.exports = { resolveShop };
