# Amazon Ops Console — starter dashboard

Vue 3 + Vite frontend, Node/Express backend, Firebase Auth + Realtime Database
(roles) + Firestore (reserved for file/document storage). Two-tier RBAC:
**admin** (the one super admin) and **user** (everyone else).

## How the pieces fit together

- **Firebase Auth** — handles login. Each user gets an ID token.
- **Custom claims** (`role: "admin" | "user"`) — baked into that ID token
  server-side. Only your backend can set these (via `firebase-admin`), which
  is why role changes must go through an API call, never directly from the
  browser.
- **Realtime Database** (`/users/{uid}/role`) — mirrors each user's role so
  it's readable without decoding tokens, and so the Admin panel can list
  everyone.
- **Firestore** — wired up and ready (`frontend/src/firebase.js` exports
  `firestore`) for whatever documents/files you store later; nothing reads
  from it yet since there's no sample content for it.
- **Express backend** — the *only* thing allowed to verify tokens, set
  claims, and decide who's allowed to do what. The Vue app never trusts its
  own idea of the role for anything sensitive — it just uses the role to
  decide what to *show*, while the backend independently re-checks on every
  request.

## 1. Set up Firebase

1. In the [Firebase console](https://console.firebase.google.com), open your
   project (or create one) → enable **Authentication** (Email/Password
   provider), **Realtime Database**, and **Firestore**.
2. **Project settings → General → Your apps** → register a web app → copy the
   config into `frontend/.env` (copy from `frontend/.env.example`).
3. **Project settings → Service accounts** → Generate new private key → copy
   `project_id`, `client_email`, and `private_key` into `backend/.env` (copy
   from `backend/.env.example`).

## 2. Realtime Database rules

Only the backend (via the admin SDK, which bypasses rules) should ever write
to `/users`. Lock down client access:

```json
{
  "rules": {
    "users": {
      ".read": "auth != null",
      "$uid": {
        ".write": false
      }
    }
  }
}
```

## 3. Run it

```bash
# backend
cd backend
npm install
cp .env.example .env   # fill in your real values
npm run seed            # creates admin@example.com / user@example.com
npm run dev              # http://localhost:4000

# frontend, in a second terminal
cd frontend
npm install
cp .env.example .env   # fill in your real values
npm run dev              # http://localhost:5173
```

Log in with `admin@example.com` / `Passw0rd!` to see the **Manage users**
page — that's the RBAC gate in action (`/admin` route requires `role: admin`,
enforced both in the Vue router guard and independently on the backend).

## 4. Where to go next

- Swap the sample `stats` / `revenueTrend` / `recentActivity` in
  `backend/src/data/sampleData.js` for real reads from Realtime Database or
  Firestore.
- Add a Firestore-backed "Documents" page using the exported `firestore`
  instance in `frontend/src/firebase.js`.
- If you want password reset / email verification flows, Firebase Auth
  supports both — ask and I can wire those in.
