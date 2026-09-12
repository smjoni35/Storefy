# Electronics/Gadgets E-commerce Shop

A custom Node.js/Express e-commerce site for electronics & gadgets — public storefront, cart & checkout (Cash on Delivery), customer accounts, and an admin panel — with automatic owner alerts (Telegram, WhatsApp, Email) on new orders and low stock.

## Tech Stack

- **Backend:** Node.js, Express
- **Views:** EJS
- **Database:** PostgreSQL (`pg`)
- **Sessions:** `express-session` + `connect-pg-simple` (stored in Postgres)
- **File storage:** Cloudflare R2 (S3-compatible, via `@aws-sdk/client-s3`)
- **Auth:** `bcryptjs` (admin + customer accounts)
- **PDF invoices:** `pdfkit`
- **Email:** `nodemailer` (Gmail SMTP)
- **Security:** `helmet`, CSRF middleware, `express-rate-limit`

## Project Structure

```
├── server.js              # App entry point
├── db/
│   ├── schema.sql         # Database schema
│   ├── migrate.js         # Runs schema + seeds admin on startup
│   └── pool.js            # PostgreSQL connection pool
├── routes/
│   ├── shop.js             # Storefront: browsing, cart, checkout
│   ├── admin.js             # Admin panel
│   ├── customer.js          # Customer account/dashboard
│   └── webhooks.js          # Courier (Steadfast) webhook
├── middleware/
│   ├── auth.js, customerAuth.js   # Session guards
│   ├── csrf.js, rateLimit.js      # Security
│   └── r2.js                      # Image upload to Cloudflare R2
├── services/
│   ├── cart.js, coupon.js, invoice.js, activityLog.js
│   ├── courier/            # Steadfast courier integration
│   ├── email.js            # Gmail SMTP alerts
│   └── notify.js           # Order/low-stock alerts (Telegram, WhatsApp, Email)
└── views/                  # EJS templates (public site + admin)
```

## Environment Variables

Create a `.env` file in the project root (see `.gitignore` — it's never committed).

### Required

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random secret for signing session cookies |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Seeded admin login (created on first migrate) |
| `BASE_URL` | Public URL of the deployed site (e.g. `https://my-electronics-shop.onrender.com`) |
| `PORT` | Port to listen on (Render sets this automatically) |

### Store Info

| Variable | Description |
|---|---|
| `STORE_NAME` | Shown in header, emails, invoices |
| `STORE_ADDRESS` | Shown on invoices/footer |
| `STORE_PHONE` | Shown on invoices/footer |
| `STORE_EMAIL` | Shown on invoices/footer |

### Delivery Charges

| Variable | Description |
|---|---|
| `DELIVERY_CHARGE_DHAKA` | Delivery charge for Dhaka orders |
| `DELIVERY_CHARGE_OUTSIDE` | Delivery charge for outside-Dhaka orders |

### Image Storage — Cloudflare R2

| Variable | Description |
|---|---|
| `R2_ENDPOINT` | R2 S3-compatible endpoint |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 credentials |
| `R2_BUCKET_NAME` | R2 bucket name |
| `R2_PUBLIC_URL` | Public base URL for serving uploaded images |

### Courier — Steadfast

| Variable | Description |
|---|---|
| `STEADFAST_API_KEY` / `STEADFAST_SECRET_KEY` | Steadfast API credentials |
| `STEADFAST_WEBHOOK_TOKEN` | Verifies incoming delivery-status webhooks |

### Order/Low-Stock Alerts (all optional — each channel is independent; an unconfigured channel just does nothing)

| Variable | Description |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID (get it via `getUpdates`, see below) |
| `CALLMEBOT_APIKEY` | API key from [CallMeBot](https://www.callmebot.com/blog/free-api-whatsapp-messages/) for WhatsApp alerts |
| `WHATSAPP_TO` | Owner's WhatsApp number (with country code) |
| `EMAIL_USER` | Gmail address used to send alert emails |
| `EMAIL_APP_PASSWORD` | Gmail **App Password** (not the normal account password) |
| `ALERT_EMAIL_TO` | Where alert emails are sent (defaults to `EMAIL_USER`) |

**Setting up Telegram alerts:**
1. Message [@BotFather](https://t.me/BotFather) → `/newbot` → follow the prompts → copy the token into `TELEGRAM_BOT_TOKEN`.
2. Open a chat with your new bot and send it any message (e.g. "hi").
3. Open `https://api.telegram.org/bot<token>/getUpdates` in a browser and copy the `"chat":{"id": ...}` number into `TELEGRAM_CHAT_ID`.

## Local Development

```bash
npm install
npm run migrate   # applies schema.sql, seeds the admin account
npm start          # runs migrate again, then starts the server
```

The site runs on `http://localhost:<PORT>`.

## Deployment (Render)

1. Push the repo to GitHub.
2. Create a new Web Service on [Render](https://render.com), connect the repo.
3. Build command: `npm install` — Start command: `npm start` (already runs migrations on boot).
4. Add all environment variables above under **Environment**.
5. Click **Save, rebuild, and deploy**.

## Notifications

`services/notify.js` fires on every new order and whenever a product crosses into low stock. Each channel is fire-and-forget and independent — none of them can block or slow down checkout, and each is skipped silently if its env vars aren't set.
