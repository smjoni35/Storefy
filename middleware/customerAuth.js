// Guards routes that require a logged-in customer (separate from admin/staff auth).
// Also checks the session belongs to THIS shop — a customer account created
// under one shop shouldn't appear "logged in" when browsing a different shop.
function requireCustomer(req, res, next) {
    if (req.session && req.session.customerId && req.session.customerShopId === req.shop.id) {
        return next();
    }
    return res.redirect(`${req.shopPath}/account/login?next=` + encodeURIComponent(req.originalUrl));
}

module.exports = { requireCustomer };
