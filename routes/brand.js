const express = require('express');
const router = express.Router();

// Storefy's own public marketing site. Lives at root (/) and is completely
// separate from any shop — mounted in server.js BEFORE session/resolveShop,
// so it never touches the shops table and a shop being down can never take
// this page down with it. Any path other than the ones defined below falls
// through to the rest of the app untouched (see middleware/shop.js).
//
// TODO(JonS): replace the WhatsApp number / phone / email placeholders below
// with your real Storefy business contact details before going live.
const CONTACT = {
    whatsapp: '8801XXXXXXXXX', // TODO: your real WhatsApp number, country code, digits only
    phone: '01XXXXXXXXX',      // TODO
    email: 'hello@example.com' // TODO
};

// Live demo shops to showcase — add more slugs here as you onboard clients.
const DEMOS = [
    { name: 'JM Gadget Zone', desc: 'ইলেকট্রনিক্স ও গ্যাজেট শপ', slug: 'jm-gadget-zone' },
    { name: 'Rafsan Electronics', desc: 'ইলেকট্রনিক্স শপ', slug: 'rafsan-electronics' }
];

function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

router.get('/', (req, res) => {
    const demoCards = DEMOS.map(d => `
        <a class="demo-card" href="/shop/${esc(d.slug)}" target="_blank" rel="noopener">
            <div class="demo-card-top">
                <span class="demo-dot"></span>
                <span class="demo-live">লাইভ</span>
            </div>
            <h3>${esc(d.name)}</h3>
            <p>${esc(d.desc)}</p>
            <span class="demo-link">শপ দেখুন →</span>
        </a>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Storefy — বাংলাদেশের জন্য রেডি অনলাইন শপ</title>
<meta name="description" content="Storefy দিয়ে কয়েক দিনেই চালু করুন আপনার নিজের অনলাইন শপ — ক্যাশ অন ডেলিভারি, কুরিয়ার ট্র্যাকিং, অ্যাডমিন প্যানেল সহ সম্পূর্ণ রেডি সমাধান।">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet">
<style>
    :root {
        --bg: #FFFFFF; --surface: #F8F9FC; --ink: #0F172A; --muted: #64748B;
        --line: #E4E7EC; --blue: #2F80ED; --purple: #7B2FF7;
        --gradient: linear-gradient(90deg, var(--blue), var(--purple));
        --accent-soft: #EEF1FF;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Hind Siliguri', sans-serif; background: var(--bg); color: var(--ink); line-height: 1.6; }
    h1, h2, h3 { font-family: 'Poppins', sans-serif; }
    .container { max-width: 1080px; margin: 0 auto; padding: 0 24px; }
    a { color: inherit; text-decoration: none; }

    header.nav { padding: 20px 0; border-bottom: 1px solid var(--line); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; }
    .brand-mark { font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 1.4rem; }
    .brand-mark .fy { background: var(--gradient); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .nav-links { display: flex; gap: 24px; font-size: 0.92rem; font-weight: 500; }
    .nav-links a:hover { color: var(--blue); }

    .hero { padding: 64px 0 56px; text-align: center; }
    .hero h1 { font-size: clamp(1.7rem, 5vw, 2.6rem); font-weight: 700; margin: 0 0 18px; line-height: 1.35; }
    .hero h1 .grad { background: var(--gradient); -webkit-background-clip: text; background-clip: text; color: transparent; }
    .hero p { max-width: 620px; margin: 0 auto 32px; color: var(--muted); font-size: 1.02rem; }
    .cta-row { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
    .btn { display: inline-block; padding: 13px 26px; border-radius: 10px; font-weight: 600; font-size: 0.95rem; }
    .btn-primary { background: var(--gradient); color: #fff; }
    .btn-secondary { background: var(--surface); color: var(--ink); border: 1px solid var(--line); }

    section { padding: 56px 0; }
    .section-title { text-align: center; font-size: 1.5rem; font-weight: 700; margin: 0 0 8px; }
    .section-sub { text-align: center; color: var(--muted); margin: 0 0 40px; font-size: 0.95rem; }

    .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .feature-card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 24px; }
    .feature-icon { font-size: 1.6rem; margin-bottom: 12px; }
    .feature-card h3 { font-size: 1rem; margin: 0 0 8px; }
    .feature-card p { font-size: 0.88rem; color: var(--muted); margin: 0; }

    .demos { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; }
    .demo-card { display: block; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 22px; transition: border-color 0.15s, transform 0.15s; }
    .demo-card:hover { border-color: var(--blue); transform: translateY(-2px); }
    .demo-card-top { display: flex; align-items: center; gap: 6px; margin-bottom: 10px; }
    .demo-dot { width: 8px; height: 8px; border-radius: 50%; background: #2ecc71; }
    .demo-live { font-size: 0.75rem; color: #2ecc71; font-weight: 600; letter-spacing: 0.03em; text-transform: uppercase; }
    .demo-card h3 { font-size: 1.05rem; margin: 0 0 4px; }
    .demo-card p { font-size: 0.88rem; color: var(--muted); margin: 0 0 14px; }
    .demo-link { font-size: 0.88rem; font-weight: 600; color: var(--blue); }

    .contact { background: var(--surface); border-radius: 20px; padding: 44px 32px; text-align: center; }
    .contact h2 { margin: 0 0 10px; }
    .contact p { color: var(--muted); margin: 0 0 26px; }
    .contact-row { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; font-size: 0.92rem; }
    .contact-item { background: #fff; border: 1px solid var(--line); border-radius: 10px; padding: 12px 18px; }

    footer { padding: 28px 0 40px; text-align: center; color: var(--muted); font-size: 0.85rem; }

    @media (max-width: 760px) {
        .features { grid-template-columns: 1fr 1fr; }
        .nav-links { display: none; }
    }
    @media (max-width: 480px) {
        .features { grid-template-columns: 1fr; }
        section { padding: 40px 0; }
    }
</style>
</head>
<body>

<header class="nav">
    <div class="container nav-inner">
        <span class="brand-mark">Store<span class="fy">fy</span></span>
        <nav class="nav-links">
            <a href="#features">ফিচার</a>
            <a href="#demo">লাইভ ডেমো</a>
            <a href="#contact">যোগাযোগ</a>
        </nav>
    </div>
</header>

<section class="hero">
    <div class="container">
        <h1>আপনার ব্যবসার জন্য <span class="grad">রেডি অনলাইন শপ</span><br>চালু হবে দিন কয়েকের মধ্যেই</h1>
        <p>Storefy হলো বাংলাদেশি ব্যবসার জন্য একটি সম্পূর্ণ অনলাইন শপ সমাধান — ক্যাশ অন ডেলিভারি, কুরিয়ার ট্র্যাকিং, অ্যাডমিন ড্যাশবোর্ড, কাস্টমার অ্যাকাউন্ট — সব রেডি করা, আপনাকে শুধু পণ্য যোগ করে বিক্রি শুরু করতে হবে।</p>
        <div class="cta-row">
            <a class="btn btn-primary" href="https://wa.me/${esc(CONTACT.whatsapp)}" target="_blank" rel="noopener">WhatsApp-এ যোগাযোগ করুন</a>
            <a class="btn btn-secondary" href="#demo">লাইভ ডেমো দেখুন</a>
        </div>
    </div>
</section>

<section id="features">
    <div class="container">
        <h2 class="section-title">সব কিছু একসাথে</h2>
        <p class="section-sub">প্রতিটা শপে যা লাগে, সবই বিল্ট-ইন</p>
        <div class="features">
            <div class="feature-card">
                <div class="feature-icon">💵</div>
                <h3>ক্যাশ অন ডেলিভারি + অনলাইন পেমেন্ট</h3>
                <p>COD, বিকাশ, নগদ, কার্ড — যেভাবে আপনার কাস্টমার পেমেন্ট করতে স্বাচ্ছন্দ্য বোধ করে।</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🚚</div>
                <h3>এলাকাভিত্তিক ডেলিভারি চার্জ</h3>
                <p>ঢাকার ভিতরে ও বাইরে আলাদা চার্জ সেট করুন, কুরিয়ার স্ট্যাটাস অটোমেটিক আপডেট হয়।</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">📦</div>
                <h3>প্রোডাক্ট ও ভ্যারিয়েন্ট</h3>
                <p>রং, সাইজ, স্টোরেজ অনুযায়ী আলাদা দাম ও স্টক ম্যানেজ করুন এক জায়গা থেকেই।</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">👤</div>
                <h3>কাস্টমার অ্যাকাউন্ট ও ট্র্যাকিং</h3>
                <p>কাস্টমাররা নিজেই অর্ডার ট্র্যাক করতে ও আগের অর্ডার হিস্ট্রি দেখতে পারবে।</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🏷️</div>
                <h3>কুপন ও ডিসকাউন্ট</h3>
                <p>ক্যাম্পেইনের জন্য কুপন কোড বানান, রিভিউ সিস্টেম দিয়ে বিশ্বাসযোগ্যতা বাড়ান।</p>
            </div>
            <div class="feature-card">
                <div class="feature-icon">🔐</div>
                <h3>নিরাপদ অ্যাডমিন প্যানেল</h3>
                <p>একাধিক স্টাফ, ভিন্ন ভিন্ন পারমিশন (অ্যাডমিন/ম্যানেজার/মডারেটর), সব কাজের লগ।</p>
            </div>
        </div>
    </div>
</section>

<section id="demo">
    <div class="container">
        <h2 class="section-title">লাইভ শপ দেখুন</h2>
        <p class="section-sub">Storefy দিয়ে বানানো কিছু চলমান শপ</p>
        <div class="demos">
            ${demoCards}
        </div>
    </div>
</section>

<section id="contact">
    <div class="container">
        <div class="contact">
            <h2>নিজের শপ শুরু করতে চান?</h2>
            <p>যোগাযোগ করুন, আপনার ব্যবসার জন্য শপ সেট আপ করে দেওয়া হবে।</p>
            <div class="contact-row">
                <a class="contact-item" href="https://wa.me/${esc(CONTACT.whatsapp)}" target="_blank" rel="noopener">💬 WhatsApp</a>
                <a class="contact-item" href="tel:${esc(CONTACT.phone)}">📞 ${esc(CONTACT.phone)}</a>
                <a class="contact-item" href="mailto:${esc(CONTACT.email)}">✉️ ${esc(CONTACT.email)}</a>
            </div>
        </div>
    </div>
</section>

<footer>
    <div class="container">© ${new Date().getFullYear()} Storefy. সর্বস্বত্ব সংরক্ষিত।</div>
</footer>

</body>
</html>`;

    res.send(html);
});

module.exports = router;
