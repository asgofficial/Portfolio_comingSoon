# notify-me backend

A small Express API that powers the "Notify me" form on the coming-soon page.
Stores emails in SQLite, validates + de-duplicates them, rate-limits abuse,
and sends a confirmation email through Gmail SMTP when configured.

## Endpoints

- `POST /api/subscribe` — `{ "email": "you@domain.com" }` → `{ ok: true }`
- `GET /api/subscribers` — requires `x-admin-key: <ADMIN_API_KEY>` header.
  Add `?format=csv` to download as CSV instead of JSON.
- `GET /api/health` — uptime/subscriber-count check.

## Local setup

```bash
npm install
cp .env.example .env      # then fill in ADMIN_API_KEY, IP_HASH_SALT, and Gmail settings
npm run dev                # runs on http://localhost:8787
```

Generate strong random values for the two required secrets:

```bash
openssl rand -hex 32
```

## Deploying

Any Node host works. The two things that matter:

1. **Persistent storage** — SQLite writes to a file (`DB_PATH`). If the
   host's filesystem is wiped on redeploy (most are, by default), attach a
   persistent disk/volume and point `DB_PATH` at a file inside it.
2. **Environment variables** — set everything from `.env.example` in the
   host's dashboard (never commit `.env`).

### Render (recommended — simplest with a free persistent disk)

1. Push this `backend/` folder to a GitHub repo.
2. New → Web Service → connect the repo, root directory `backend`.
3. Build command: `npm install`. Start command: `npm start`.
4. Add a Disk (Render dashboard → Disks), mount path e.g. `/data`, 1GB.
5. Environment variables: set `DB_PATH=/data/subscribers.db` plus
   `ALLOWED_ORIGINS`, `ADMIN_API_KEY`, `IP_HASH_SALT`, `GMAIL_USER`, and
   `GMAIL_APP_PASSWORD`. `NOTIFY_FROM_EMAIL` can stay as the Gmail address
   unless you want a display name.
6. Deploy. Note the resulting URL, e.g. `https://asgautam-notify.onrender.com`.

### Railway / Fly.io

Same idea: deploy the `backend/` folder, attach a volume, set `DB_PATH` to a
path inside that volume, set the same environment variables.

### A VPS (e.g. a $5 droplet)

```bash
git clone <your-repo> && cd backend
npm install --omit=dev
cp .env.example .env   # fill in values
npm install -g pm2
pm2 start server.js --name notify-me
pm2 save && pm2 startup   # keeps it running across reboots
```

Put Nginx or Caddy in front for HTTPS (Caddy gets you a free cert
automatically):

```
notify-api.asgautam.in {
  reverse_proxy localhost:8787
}
```

## Wiring up the frontend

In the frontend project, set `VITE_API_URL` to wherever you deployed this
backend (see the frontend's `.env.example`). No other frontend changes are
needed — `subscribeEmail()` already calls `${VITE_API_URL}/api/subscribe`.

Also make sure `ALLOWED_ORIGINS` here includes the exact frontend origin(s)
you're serving from (e.g. `https://asgautam.in`), or the browser will block
the request with a CORS error.

## Exporting your subscriber list

```bash
curl -H "x-admin-key: YOUR_ADMIN_API_KEY" \
  "https://your-backend-url/api/subscribers?format=csv" -o subscribers.csv
```

## Optional: confirmation emails

Set `GMAIL_USER=gautamayushsinghofficial@gmail.com` and create a Google App
Password for that account. Put it in `GMAIL_APP_PASSWORD`. If the password is
missing, signups still work — the app just skips sending the confirmation
email.
