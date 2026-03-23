# Deploy `growwtrader.in` (single domain: app + API + Google OAuth)

Your Google Cloud OAuth client is set up for:

- **Authorized JavaScript origins:** `https://growwtrader.in`
- **Authorized redirect URIs:** `https://growwtrader.in/auth/google/callback`

That matches this project when **one** Node process serves:

1. The built Vite app (`dist/`)
2. The API (`/auth`, `/api`, `/paper`, …)
3. Google OAuth routes (`/auth/google`, `/auth/google/callback`)

The server already does this if `dist/index.html` exists after `npm run build`.

---

## 1. Server environment (`.env.server` on the VPS)

Create or edit `.env.server` next to `package.json` (never commit real secrets):

| Variable | Value for your setup |
|----------|------------------------|
| `PORT` | `3001` (or whatever your reverse proxy forwards to) |
| `TRUST_PROXY` | `1` (required behind nginx/Caddy so `https` + `Host` are correct for OAuth) |
| `FRONTEND_ORIGIN` | `https://growwtrader.in` |
| `GOOGLE_CLIENT_ID` | From Google Console (Web client) |
| `GOOGLE_CLIENT_SECRET` | From Google Console |
| `GOOGLE_REDIRECT_URI` | `https://growwtrader.in/auth/google/callback` |
| `JWT_SECRET` | Long random string (generate new for production) |
| `KITE_API_KEY` / `KITE_API_SECRET` | If you use Kite live data |
| `KITE_REDIRECT_URL` | Must match Kite app settings, e.g. `https://growwtrader.in/kite/callback` if you expose that path on the same host |
| `ADMIN_EMAIL` | Optional |

**Why `TRUST_PROXY=1`:** Behind HTTPS termination, the browser talks `https` to nginx, but Node sees `http` locally. OAuth builds the redirect URI from `X-Forwarded-Proto` + `Host`; trusting the proxy makes that reliable.

---

## 2. Frontend build-time env (`.env.production`)

Vite reads `.env.production` when you run `npm run build`. The API base must be your **public** origin:

```bash
VITE_MARKET_DATA_API_BASE=https://growwtrader.in
VITE_MARKET_DATA_PROVIDER=kite-backend
```

Copy from `.env.production.example` and adjust. Then:

```bash
npm ci
npm run build
```

This produces `dist/` with the correct API URL in the JS bundle.

---

## 3. Reverse proxy (HTTPS → Node)

Example **nginx** (Certbot can fill SSL paths):

```nginx
server {
    server_name growwtrader.in www.growwtrader.in;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    listen 443 ssl; # + ssl_certificate lines from Certbot
}
```

Reload nginx after `certbot --nginx` or your TLS setup.

---

## 4. Run the app (process manager)

From the project directory on the server:

```bash
NODE_ENV=production TRUST_PROXY=1 node server/index.js
```

Use **PM2**, **systemd**, or your host’s process manager so it restarts on reboot.

Example PM2:

```bash
npm ci
npm run build
TRUST_PROXY=1 NODE_ENV=production pm2 start server/index.js --name growwtrader
pm2 save
```

Ensure only **one** process binds to `PORT` (avoid duplicate `EADDRINUSE`).

---

## 5. Google OAuth checklist

- [ ] **OAuth consent screen** published (or test users added) in Google Cloud.
- [ ] **Authorized JavaScript origins** includes `https://growwtrader.in`.
- [ ] **Authorized redirect URIs** includes exactly  
      `https://growwtrader.in/auth/google/callback` (no trailing slash).
- [ ] Keep **local** URIs in the same client if you still dev locally:  
      `http://localhost:3001/auth/google/callback` and  
      `http://127.0.0.1:3001/auth/google/callback`.

---

## 6. CORS

`FRONTEND_ORIGIN` in `.env.server` must equal the URL users open: `https://growwtrader.in`.  
If the frontend and API share the same origin (`https://growwtrader.in`), browsers still send `Origin` on `fetch`; your server already allows `frontendOrigin` and localhost patterns for dev.

---

## 7. Troubleshooting

| Symptom | Check |
|--------|--------|
| `redirect_uri_mismatch` | Redirect URI in Google Console must match `https://growwtrader.in/auth/google/callback`; set `TRUST_PROXY=1` and correct `Host`/`X-Forwarded-Proto` in nginx. |
| White screen / 404 on refresh | SPA fallback: server must serve `dist/index.html` for non-API routes (already implemented when `dist` exists). |
| API calls wrong host | Rebuild frontend with `VITE_MARKET_DATA_API_BASE=https://growwtrader.in`. |
| `EADDRINUSE` | Another Node already on `PORT`; stop duplicate process. |

---

## Google Sign-In (`redirect_uri_mismatch`) — local dev

For localhost, register **both** (see [README](./README.md) Google section):

- `http://127.0.0.1:3001/auth/google/callback`
- `http://localhost:3001/auth/google/callback`

Production URI `https://growwtrader.in/auth/google/callback` can stay in the same OAuth client alongside these.

cd D:\Cloner\groww-clone-studio
ssh -i "C:\Users\badal\Downloads\ssh-key-2026-03-20.key" ubuntu@141.148.217.18'
