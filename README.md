# Welcome to your Lovable project

## Run

```bash
npm install
npm run dev
```

### Kite backend (for true live Indian market quotes)

1. Copy `.env.server.example` to `.env.server`
2. Fill values:
   - `KITE_API_KEY`
   - `KITE_API_SECRET`
   - `KITE_REDIRECT_URL=http://127.0.0.1:3001/kite/callback`
   - `JWT_SECRET=your_strong_secret`
   - `DEFAULT_VIRTUAL_BALANCE_INR=10000000`
3. Start backend:

```bash
npm run server
```

4. In frontend `.env`, set:

```bash
VITE_MARKET_DATA_PROVIDER=kite-backend
VITE_MARKET_DATA_API_BASE=http://127.0.0.1:3001
```

5. Restart frontend and click **Connect Kite** badge on `Stocks` page.

### Google Sign-In (OAuth)

`Error 400: redirect_uri_mismatch` means the callback URL your app sends to Google is **not** in **Authorized redirect URIs** for that OAuth client (exact string: scheme, host, port, path).

The backend builds the redirect URI from the **request** (so `http://127.0.0.1:3001/...` and `http://localhost:3001/...` are not mixed up). You must register **both** for local dev:

- `http://127.0.0.1:3001/auth/google/callback`
- `http://localhost:3001/auth/google/callback`

1. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.server` (see `.env.server.example`). `GOOGLE_REDIRECT_URI` is the fallback / production callback URL.
2. Google Cloud Console → **Credentials** → your **OAuth 2.0 Web client** → **Authorized redirect URIs** → add the two URLs above (plus your production URL when you deploy).
3. Save, wait a minute, restart `npm run server`, try again.

Deploy to **https://growwtrader.in** (build, nginx, Google OAuth, `.env`): [DEPLOY.md](./DEPLOY.md).

### Stock search & logos

- **Search**: Tap the **search icon** in the header (Stocks / Mutual Funds / stock detail) to open the search modal. Matches **name**, **symbol**, and route **id** (indices included). **Ctrl/Cmd+K** opens search on **Stocks** and on **Mutual Funds** (desktop header).
- **Logos**: Company marks are loaded from a public CDN when available; if images fail, the UI falls back to **symbol initials**. Indices use a small **chart** icon. Full NSE coverage would need a backend search/logo API later—extend `additionalSearchStocks` in `src/data/mockData.ts` and symbol maps in `src/services/marketData.ts` as needed.

## Phase 1: Paper User Wallet

Auth and wallet APIs are now available in backend. On signup, each user gets **INR 1,00,00,000** virtual balance.

- `POST /auth/signup` with `{ name, email, password }`
- `POST /auth/login` with `{ email, password }`
- `GET /auth/me` with `Authorization: Bearer <token>`
- `GET /wallet` with `Authorization: Bearer <token>`
- `POST /wallet/reset` with `Authorization: Bearer <token>`

User data is stored locally in `server/data/users.json` (ignored in git).

Frontend login/signup is connected to these APIs on `/login`.

## Live Market Data (Free Tier)

This project supports a plug-and-play market data adapter on the `Stocks` page:

- **Provider 1:** Twelve Data (free tier, API key required)
- **Provider 2:** Simulated fallback (automatic when key is missing)

### Enable Twelve Data

1. Create a free API key at [https://twelvedata.com/](https://twelvedata.com/).
2. Add a `.env` file in project root:

```bash
VITE_TWELVE_DATA_API_KEY=your_api_key_here
```

3. Restart dev server.

When key is present, the app fetches live quotes for mapped NSE symbols.
When key is not present or a symbol fails, it falls back safely to mock values.


hat message means the running server process does not have GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET loaded.

Do this exactly on your VPS:

1) SSH in
ssh -i "C:\Users\badal\Downloads\ssh-key-2026-03-20.key" ubuntu@141.148.217.18
2) Open server env file in the app folder
cd /home/ubuntu/app
nano .env.server
Add/update these lines (real values, no quotes):

FRONTEND_ORIGIN=https://growwtrader.in
TRUST_PROXY=1
GOOGLE_CLIENT_ID=590430716719-utq3d042ra9315fft8m552e5ui1ldd3a.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_REAL_SECRET
GOOGLE_REDIRECT_URI=https://growwtrader.in/auth/google/callback
Save in nano: Ctrl+O, Enter, Ctrl+X.

3) Restart PM2 with updated env
cd /home/ubuntu/app
TRUST_PROXY=1 NODE_ENV=production pm2 restart groww-backend --update-env
4) Confirm from logs
pm2 logs groww-backend --lines 40
You should NOT see:

GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET missing
5) Confirm Google route works
curl -I https://growwtrader.in/auth/google
Expected: HTTP/1.1 302 (redirect to Google), not 503.


