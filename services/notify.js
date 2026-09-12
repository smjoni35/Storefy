// Sends alerts to the shop owner — new orders, and low-stock warnings.
// Three channels, all free, all optional and independent of each other:
//   1. WhatsApp via the free CallMeBot API (see setup note below)
//   2. Email via Gmail SMTP (see services/email.js)
//   3. Telegram via a bot you create (see setup note below) — gets a
//      richer, formatted version since Telegram supports HTML styling
// Whichever channel(s) are configured in .env will fire; an unconfigured
// channel silently does nothing, so this never blocks checkout or a product
// save even before either is set up.
const https = require('https');
const { sendAlertEmail } = require('./email');

const WHATSAPP_TO = (process.env.WHATSAPP_TO || '+8801735698806').replace(/[^\d]/g, '');
const DIVIDER = '─────────────────────';

function money(n) {
    return '৳' + Number(n).toLocaleString('en-BD');
}

// Plain-text version — used for WhatsApp and email, neither of which
// render HTML/markdown.
function buildOrderMessage(order, items) {
    const lines = [
        `🛒 নতুন অর্ডার এসেছে! (Order #${order.id})`,
        '',
        `👤 কাস্টমার: ${order.customer_name}`,
        `📞 ফোন: ${order.phone}`,
        `📍 ঠিকানা: ${order.address}${order.city ? ', ' + order.city : ''}`,
        `💰 মোট: ${money(order.total)}`,
        `💳 পেমেন্ট: Cash on Delivery`,
        '',
        'পণ্যসমূহ:',
        ...items.map(i => `• ${i.product_name} x${i.quantity} — ${money(i.price * i.quantity)}`)
    ];
    return lines.join('\n');
}

function buildLowStockMessage(products) {
    const lines = [
        `⚠️ স্টক কমে গেছে!`,
        '',
        ...products.map(p => `• ${p.name} — বাকি আছে মাত্র ${p.stock}টা`),
        '',
        'দ্রুত রিস্টক করুন যাতে বিক্রি বন্ধ না হয়।'
    ];
    return lines.join('\n');
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// HTML-formatted version for Telegram only — bold title, then the details
// wrapped in a <blockquote>, which Telegram renders as a card with a
// colored left-edge bar (no copy button, unlike <pre>).
function buildTelegramOrderMessage(order, items) {
    const placedAt = new Date().toLocaleString('bn-BD', {
        timeZone: 'Asia/Dhaka',
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit'
    });

    const cardLines = [
        `👤 <b>${escapeHtml(order.customer_name)}</b>`,
        `📞 ${escapeHtml(order.phone)}`,
        `📍 ${escapeHtml(order.address)}${order.city ? ', ' + escapeHtml(order.city) : ''}`,
        DIVIDER,
        ...items.map(i => `🛒 ${escapeHtml(i.product_name)}\n   × ${i.quantity}  —  ${money(i.price * i.quantity)}`),
        DIVIDER
    ];

    if (order.subtotal != null) {
        cardLines.push(`সাবটোটাল      ${money(order.subtotal)}`);
    }
    if (order.discount_amount) {
        cardLines.push(`ছাড়${order.coupon_code ? ' (' + escapeHtml(order.coupon_code) + ')' : ''}       −${money(order.discount_amount)}`);
    }
    if (order.delivery_charge != null) {
        cardLines.push(`ডেলিভারি      ${money(order.delivery_charge)}`);
    }
    cardLines.push(`মোট           <b>${money(order.total)}</b>`);
    cardLines.push(DIVIDER);
    cardLines.push(`💵 Cash on Delivery`);

    const lines = [
        `🛍️ <b>নতুন অর্ডার এসেছে</b> — অর্ডার #${order.id}`,
        `🕐 ${placedAt}`,
        '',
        `<blockquote>${cardLines.join('\n')}</blockquote>`
    ];

    return lines.join('\n');
}

// Uses the free CallMeBot WhatsApp API — no paid business account needed.
// Setup: add +34 644 84 71 63 as a contact on the owner's WhatsApp, send it
// "I allow callmebot to send me messages", copy the apikey it replies with,
// and put it in CALLMEBOT_APIKEY in .env.
function sendWhatsAppMessage(text) {
    return new Promise((resolve) => {
        const apiKey = process.env.CALLMEBOT_APIKEY;
        if (!apiKey || !WHATSAPP_TO) return resolve();

        const url = `https://api.callmebot.com/whatsapp.php?phone=${WHATSAPP_TO}&text=${encodeURIComponent(text)}&apikey=${apiKey}`;

        https.get(url, (res) => {
            res.resume();
            resolve();
        }).on('error', (err) => {
            console.error('WhatsApp notify failed:', err.message);
            resolve();
        });
    });
}

// Uses a free Telegram bot — no phone number or paid account needed.
// Setup: message @BotFather on Telegram, send "/newbot", follow the
// prompts, and copy the token it gives you into TELEGRAM_BOT_TOKEN in
// .env. Then message your new bot anything (e.g. "hi"), open
// https://api.telegram.org/bot<token>/getUpdates in a browser, and copy
// the "chat":{"id": ...} number into TELEGRAM_CHAT_ID in .env.
function sendTelegramMessage(text) {
    return new Promise((resolve) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (!token || !chatId) return resolve();

        const payload = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
        const req = https.request(
            {
                hostname: 'api.telegram.org',
                path: `/bot${token}/sendMessage`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            },
            (res) => {
                res.resume();
                resolve();
            }
        );
        req.on('error', (err) => {
            console.error('Telegram notify failed:', err.message);
            resolve();
        });
        req.write(payload);
        req.end();
    });
}

// Fire-and-forget from the caller's point of view — never throws,
// so a slow or misconfigured channel never delays checkout.
async function notifyNewOrder(order, items) {
    try {
        const plainText = buildOrderMessage(order, items);
        const telegramText = buildTelegramOrderMessage(order, items);
        await Promise.all([
            sendWhatsAppMessage(plainText),
            sendTelegramMessage(telegramText),
            sendAlertEmail(`🛒 নতুন অর্ডার #${order.id} — ${money(order.total)}`, plainText)
        ]);
    } catch (err) {
        console.error('Order notification failed:', err.message);
    }
}

// products: [{ name, stock }] — products that just crossed into low-stock
// territory as part of the order/edit that was just made.
async function notifyLowStock(products) {
    if (!products || products.length === 0) return;
    try {
        const text = buildLowStockMessage(products);
        await Promise.all([
            sendWhatsAppMessage(text),
            sendTelegramMessage(text),
            sendAlertEmail(`⚠️ স্টক কম — ${products.map(p => p.name).join(', ')}`, text)
        ]);
    } catch (err) {
        console.error('Low stock notification failed:', err.message);
    }
}

module.exports = { notifyNewOrder, notifyLowStock };
