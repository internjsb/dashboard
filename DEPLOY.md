# Deploying to Vercel

The whole app — the React frontend **and** the Express API — runs as a single
Vercel project. The API becomes a serverless function at `/api/*`; the frontend
is served as static files. Same origin, so no CORS to configure in production.

```
vercel.json          build + routing config
api/index.js          serverless entry — re-exports the Express app
backend/app.js         the Express app (no listener)
backend/server.js      local-dev entry (app.listen)
```

## One-time: clean the repo

Secrets and `node_modules` are currently committed. Fix before deploying:

```bash
# stop tracking them (keeps the local files)
git rm -r --cached node_modules frontend/node_modules backend/node_modules
git rm --cached backend/.env frontend/.env
git rm --cached frontend/package-lock.json frontend/node_modules/.package-lock.json 2>/dev/null || true

git add .gitignore backend/.gitignore frontend/.gitignore
git commit -m "Stop tracking node_modules and .env; add Vercel deploy config"
git push
```

> **Security:** `backend/.env` held the Firebase **service-account private key**
> and it is in the GitHub history. Treat it as compromised:
> Firebase console → Project settings → Service accounts → **Generate new
> private key**, delete the old key, and put the new values into Vercel (below)
> and your local `backend/.env`. (Optional: scrub history with `git filter-repo`.)

## 1. Import the project

1. [vercel.com](https://vercel.com) → **Add New → Project** → import
   `NgweLawun/amazon-dashboard`.
2. Framework preset: **Other** (the `vercel.json` handles the build).
   Root directory: leave as the repo root.

## 2. Environment variables

Vercel → Project → **Settings → Environment Variables**. Add for
**Production** (and Preview if you want branch deploys):

| Name | Value |
|---|---|
| `SUPER_ADMIN_EMAIL` | `admin@example.com` (or your real admin email) |
| `FIREBASE_DATABASE_URL` | from Firebase → Realtime Database |
| `FIREBASE_PROJECT_ID` | from the service-account JSON |
| `FIREBASE_CLIENT_EMAIL` | from the service-account JSON |
| `FIREBASE_PRIVATE_KEY` | from the service-account JSON — paste with the `\n` sequences, wrapped in double quotes |
| `VITE_FIREBASE_API_KEY` | Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase web config |
| `VITE_FIREBASE_DATABASE_URL` | Firebase web config |
| `VITE_FIREBASE_PROJECT_ID` | Firebase web config |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase web config |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase web config |
| `VITE_FIREBASE_APP_ID` | Firebase web config |

Do **not** set `VITE_API_URL` — leaving it unset makes the frontend use the
same-origin `/api`.

## 3. Firebase: authorize the domain

Firebase console → **Authentication → Settings → Authorized domains** → add your
Vercel domain (e.g. `amazon-dashboard.vercel.app`, plus any custom domain).
Login is blocked from unlisted domains.

## 4. Deploy

Click **Deploy**. Every push to `main` redeploys automatically.

## 5. First login

The `admin@example.com` account already exists in Firebase (from the earlier
`npm run seed`). Log in, and it's the super admin as long as `SUPER_ADMIN_EMAIL`
matches. New visitors self-register and wait for approval on the Manage users
page.

---

## Local development still works the same

```bash
# terminal 1
cd backend && npm install && npm run dev      # http://localhost:4000

# terminal 2
cd frontend && npm install && npm run dev     # http://localhost:5173
```

Local dev needs `VITE_API_URL=http://localhost:4000/api` in `frontend/.env`
(it's in `.env.example`) because the two run on different ports.
