## AudioLink Development Notes

### Stack Overview

- **Runtime:** Node.js server built on core `http` + `url` modules (`server.js`), no Express or bundler.
- **Data layer:** SQLite via `better-sqlite3`, database lives under `data/audiolink.db` with WAL turned on.
- **Auth:** PBKDF2-hashed passwords and cookie-based sessions persisted in SQLite.
- **Billing & email:** Stripe API (`stripe` SDK) for subscriptions and Nodemailer for welcome emails.
- **Frontend:** Static HTML/Tailwind (via CDN) and a large vanilla ES module (`public/new.js`) that drives auth, checkout, and the ggwave audio workflows.
- **Audio transport:** Web Audio API + ggwave WASM (`public/vendor/ggwave.js`) for encoding/decoding ultrasonic links.

### Getting Started

1. Install Node.js 18+ (native fetch is required for the smoke script).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template and populate the values you were issued:
   ```bash
   cp .env.example .env
   ```
   The server loads `.env` on boot and leaves any pre-set environment variables untouched.

Start the server with:

```bash
npm start
```

The app serves static assets from `public/` and the API from `/api/*` at `http://127.0.0.1:3000` by default.

### Environment Variables

Minimum Stripe configuration for subscription checkout:

- `STRIPE_SECRET_KEY` (e.g. `sk_test_...`)
- One of the price hints:
  - `STRIPE_PRO_PRICE_ID` (preferred exact price)
  - or `STRIPE_PRO_PRODUCT_ID` so the server can resolve the active price
- Optional URLs when the server sits behind a proxy: `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL`
- Keep `STRIPE_PUBLISHABLE_KEY` handy for any client-side Stripe usage you add later.

Email is optional; set these to enable welcome messages:

- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

Other knobs:

- `HOST` / `PORT` to change the bind address.
- `COOKIE_SECURE=true` when running behind HTTPS.
- Stripe product fallbacks (`STRIPE_PRICE_ID`, `STRIPE_PRODUCT_ID`, `STRIPE_DEFAULT_PRICE_ID`, `STRIPE_DEFAULT_PRODUCT_ID`) if you expand tiers.
- `DATA_DIR` to override where SQLite + WAL files live (useful when mounting persistent disks in cloud platforms).

Restart `node server.js` (or kill/restart the process) after changing `.env`.

### Audio & Browser Requirements

- Chrome, Edge, or Safari with Web Audio API, AudioWorklet, and microphone access are required for scanning.
- Users must grant mic permission; failure falls back to a ScriptProcessorNode path with reduced performance.
- The ggwave module is loaded from `public/vendor/ggwave.js`; keep it reachable over HTTPS in production to avoid mixed-content issues.

### Database & Storage

- SQLite files (`audiolink.db`, `audiolink.db-wal`, `audiolink.db-shm`) live in `data/`.
- `storage.js` runs migrations at startup. Back up the entire `data/` directory before upgrades or deployments.
- When seeding or importing legacy users, drop JSON records into `data/users.json` before the first boot; the server will migrate and then ignore invalid entries.

### Useful Scripts

- `npm start` – runs `node server.js`.
- `node scripts/login-smoke.js` – boots the server, registers/logs in/logs out a temp user to confirm auth flows. Requires Node 18+ because it uses the global `fetch`.

### Testing & Verification

- Use the smoke script after changing auth, session, or storage logic.
- Stripe flows are not unit tested; run live-mode or test-mode checkouts to validate billing changes.
- Consider adding browser-based checks (Playwright/Cypress) if you extend the dashboard or scanner UI.

### Deployment Notes

- The server is stateful (SQLite + local sessions). For multi-instance deployments, migrate to a shared database or pin traffic to a single node.
- Serve behind HTTPS so `SameSite=Lax` cookies remain secure and Web Audio permissions are granted.
- Rotate or back up the `data/` directory regularly; WAL mode keeps write-ahead files that need to stay with the main DB.
- Set proper `HOST` and `PORT` when running in containers or PaaS environments, and expose the `/public` assets through a CDN or reverse proxy if needed.
- For Render (or similar PaaS) deployments:
  1. Push this folder to GitHub/GitLab and create a Render “Web Service” pointed at the repo.
  2. Set build command to `npm install` and start command to `npm start`.
  3. Add environment variables: `HOST=0.0.0.0`, `PORT=${PORT}`, Stripe + SMTP secrets, and `DATA_DIR=/opt/render/project/src/data` (or another mounted volume path).
  4. Attach a Render Disk (e.g., 1 GB) mounted at the same `DATA_DIR` path so SQLite files survive redeploys.
  5. After the first deploy, visit the Render URL, create a test account, and run encode/scan flows plus Stripe checkout (test mode) before sharing the link with stakeholders.
