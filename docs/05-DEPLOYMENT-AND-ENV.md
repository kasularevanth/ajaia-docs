# 05 — Deployment, Infrastructure and Environment Variables

**Everything below is free. Reviewers pay for nothing.**

---

## 1. Accounts you need (all free)

| # | Service | Used for | Free-tier notes |
|---|---|---|---|
| 1 | **GitHub** | Source repo (Render deploys from it) and CI | Free. Public or private repo both work with Render. |
| 2 | **Neon** (neon.tech) | Production PostgreSQL | 0.5 GB, scale-to-zero, **no expiry** |
| 3 | **Render** (render.com) | Static Site (frontend) and Web Service (API) | Static sites are free. Free web services sleep after 15 min idle (cold start about 30–60 s), with 750 instance-hours/month. |
| 4 | **Loom** or **YouTube** | Walkthrough video (3–5 min, unlisted) | Loom's free plan caps videos at 5 min, which fits |
| 5 | **Google Drive** | Submission folder | Free |

> **Why Neon and not Render Postgres?** Render's free Postgres **expires 30 days after creation**, and reviewers may test later than that. Neon's free tier doesn't expire. Supabase free projects **pause after about 7 days of inactivity**. Neon is the safest free option.
>
> **Why not SQLite on Render?** Free web services have **no persistent disk**, so a file DB would be wiped on every deploy or restart.

---

## 2. Topology

```
GitHub repo (main)
   │  push → auto-deploy (Render Blueprint: render.yaml)
   ├──────────────► Render Static Site  "ajaia-docs-web"   https://ajaia-docs-web.onrender.com
   │                 build: npm ci && npm run build -w @ajaia/web   publish: apps/web/dist
   │                 rewrite /* → /index.html  (SPA routing)
   │
   └──────────────► Render Web Service  "ajaia-docs-api"   https://ajaia-docs-api.onrender.com
                     build: npm ci && npm run build -w @ajaia/api
                     start: npm run start -w @ajaia/api    (migrate → seed → listen)
                     health: /api/health
                            │
                            └──► Neon Postgres (pooled connection string, TLS)
```

> Render may add a suffix if a name is taken (for example `ajaia-docs-api-x7k2.onrender.com`). Use the **actual** URLs in `VITE_API_URL` and `CORS_ORIGINS`.

---

## 3. Environment variables

### 3.1 API: Render Web Service `ajaia-docs-api`

| Variable | Required | Example | Description |
|---|---|---|---|
| `NODE_ENV` | ✅ | `production` | Enables production error output and logging |
| `NODE_VERSION` | ✅ (Render) | `22` | Node version Render installs (also pinned in `.node-version`) |
| `PORT` | auto | `10000` | **Injected by Render. Don't set it.** Local default is `4000`. |
| `DATABASE_URL` | ✅ | `postgresql://neondb_owner:****@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require` | Neon **pooled** connection string. If empty, the API uses local PGlite (dev only). |
| `JWT_SECRET` | ✅ | *(64 random chars)* | HMAC secret for tokens. `render.yaml` uses `generateValue: true`. Locally: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | ➖ | `7d` | Token lifetime |
| `CORS_ORIGINS` | ✅ | `https://ajaia-docs-web.onrender.com` | Comma-separated allow-list of frontend origins (no trailing slash) |
| `MAX_UPLOAD_MB` | ➖ | `5` | Import file size limit |
| `SEED_DEMO_DATA` | ➖ | `true` | Seed Alice, Bob, Carol and sample docs at boot (idempotent) |
| `DEMO_PASSWORD` | ➖ | `demo1234` | Password for the seeded demo users |
| `LOG_LEVEL` | ➖ | `info` | pino level (`debug` locally) |

### 3.2 Web: Render Static Site `ajaia-docs-web`

| Variable | Required | Example | Description |
|---|---|---|---|
| `VITE_API_URL` | ✅ | `https://ajaia-docs-api.onrender.com` | API base URL, **baked in at build time**. Changing it requires a rebuild ("Manual Deploy → Clear cache & deploy"). |
| `NODE_VERSION` | ✅ (Render) | `22` | Build-time Node version |

> Never put secrets in `VITE_*` variables. They end up in the public JS bundle.

### 3.3 Local `.env` files (committed as `.env.example`, real files gitignored)

`apps/api/.env`
```dotenv
NODE_ENV=development
PORT=4000
# Leave empty to use embedded PGlite at apps/api/.data (zero setup)
DATABASE_URL=
JWT_SECRET=dev-only-change-me-dev-only-change-me
JWT_EXPIRES_IN=7d
CORS_ORIGINS=http://localhost:5173
MAX_UPLOAD_MB=5
SEED_DEMO_DATA=true
DEMO_PASSWORD=demo1234
LOG_LEVEL=debug
```

`apps/web/.env`
```dotenv
VITE_API_URL=http://localhost:4000
```

### 3.4 GitHub Actions (CI): no secrets needed
Tests use in-memory PGlite, so CI needs **no** database secrets.

---

## 4. `render.yaml` (Blueprint, committed at the repo root)

```yaml
services:
  - type: web
    name: ajaia-docs-api
    runtime: node
    plan: free
    region: oregon
    branch: main
    buildCommand: npm ci && npm run build -w @ajaia/api
    startCommand: npm run start -w @ajaia/api
    healthCheckPath: /api/health
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: NODE_VERSION
        value: "22"
      - key: DATABASE_URL
        sync: false            # entered in the dashboard (Neon string)
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_EXPIRES_IN
        value: 7d
      - key: CORS_ORIGINS
        sync: false            # https://<your-web>.onrender.com
      - key: MAX_UPLOAD_MB
        value: "5"
      - key: SEED_DEMO_DATA
        value: "true"
      - key: DEMO_PASSWORD
        value: demo1234
      - key: LOG_LEVEL
        value: info

  - type: web
    name: ajaia-docs-web
    runtime: static
    branch: main
    buildCommand: npm ci && npm run build -w @ajaia/web
    staticPublishPath: apps/web/dist
    autoDeploy: true
    envVars:
      - key: NODE_VERSION
        value: "22"
      - key: VITE_API_URL
        sync: false            # https://<your-api>.onrender.com
    routes:
      - type: rewrite
        source: /*
        destination: /index.html
    headers:
      - path: /*
        name: X-Frame-Options
        value: DENY
      - path: /*
        name: X-Content-Type-Options
        value: nosniff
      - path: /*
        name: Referrer-Policy
        value: strict-origin-when-cross-origin
```

---

## 5. Step-by-step deployment runbook

> **You can do steps A–C now, while I build the code.** That saves about 15 minutes at the end.

**A. Neon (about 3 min)**
1. Sign up at neon.tech → **New Project** → name `ajaia-docs`, Postgres 16, a region near Oregon (`us-west-2`) or wherever you prefer.
2. Dashboard → **Connect** → turn on **Connection pooling** → copy the string (it contains `-pooler` and `?sslmode=require`).
3. Keep it private. You'll paste it into Render only. Don't paste it in chat or commit it.

**B. GitHub (about 2 min)**
1. Create an empty repo `ajaia-docs` (no README, so we push the existing one).
2. Share the repo URL with me. I'll set up `git init`, the remote and the first commit when the code is ready. **You run `git push`** (your credentials).

**C. Render (about 3 min to set up the account)**
1. Sign up at render.com with GitHub and authorize access to the `ajaia-docs` repo.

**D. Deploy (after the first push, about 8 min)**
1. Render → **New → Blueprint** → select the repo. Render reads `render.yaml` and shows both services.
2. Enter the `sync: false` values:
   - `DATABASE_URL` = the Neon pooled string
   - `CORS_ORIGINS` = `https://ajaia-docs-web.onrender.com` (adjust if Render added a suffix)
   - `VITE_API_URL` = `https://ajaia-docs-api.onrender.com` (adjust likewise)
3. **Apply**, then wait for both builds to go green.
4. If the generated URLs differ from what you entered, update the two env vars. The API restarts on its own. For the static site, use **Manual Deploy → Clear build cache & deploy**.

**E. Smoke test (about 3 min)**
```powershell
curl https://ajaia-docs-api.onrender.com/api/health
```
Then in the browser: log in as Alice → open "Q4 Product Brief" → edit → refresh (the change persists) → share with Carol → log in as Carol → the doc shows under "Shared with me".

**F. Optional: keep the API warm for reviewers**
- A free UptimeRobot monitor that pings `/api/health` every 10 min keeps the instance awake. One service running 24/7 is about 720 h, under the 750 h/month free allowance.

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Browser console shows a CORS error | `CORS_ORIGINS` doesn't exactly match the static site origin | No trailing slash, include `https://`, then redeploy the API |
| Frontend calls `localhost:4000` in prod | `VITE_API_URL` was missing at build time | Set it, then **Clear build cache & deploy** the static site |
| Refreshing `/d/:id` returns 404 | SPA rewrite missing | Check the `routes` rewrite in `render.yaml` |
| API boot fails with `ECONNREFUSED` / SSL error | Wrong Neon string | Use the pooled string with `?sslmode=require` |
| First request takes about 50 s | Free-tier cold start | Expected. The UI shows a "waking up" banner (or use step F). |
