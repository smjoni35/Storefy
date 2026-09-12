// Roles, from most to least powerful: admin > manager > moderator
const ROLE_LABELS = {
    admin: 'Admin',
    manager: 'Manager',
    moderator: 'Moderator'
};

// Any logged-in staff member (admin, manager, or moderator) — and, in a
// multi-shop deployment, only for the shop they actually logged into.
// Without the shop_id check, a staff session for Shop A's /admin would
// also work if the same browser opened Shop B's /shop/b/admin URL.
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin && req.session.adminShopId === req.shop.id) {
        return next();
    }
    res.redirect(`${req.shopPath}/admin/login`);
}

// Restrict a route to specific roles, e.g. requireRole('admin', 'manager')
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.session || !req.session.isAdmin || req.session.adminShopId !== req.shop.id) {
            return res.redirect(`${req.shopPath}/admin/login`);
        }
        if (!roles.includes(req.session.adminRole)) {
            return res.status(403).render('admin/forbidden', {
                message: 'এই কাজটি করার অনুমতি আপনার নেই।'
            });
        }
        next();
    };
}

module.exports = { requireAdmin, requireRole, ROLE_LABELS };
