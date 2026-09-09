# Amazon Ops Console — starter dashboard

React 18 + TypeScript + Vite frontend, Node/Express backend, Firebase Auth +
Realtime Database (roles) + Firestore (reserved for file/document storage).

**Access model:**

- **Super admin** — exactly one, pinned by `SUPER_ADMIN_EMAIL` in `backend/.env`.
  Always `admin`, auto-approved, and its role can never be changed by anyone
  (not even itself).
- **admin** — appointed/revoked by the super admin only. Can approve or deny
  new signups, but cannot touch anyone's admin status.
- **user** — everyone else.
- **Self-registration** — anyone can create an account at `/register`, but it
  lands in a **pending** state with no dashboard access until an admin approves
  it from the **Manage users** page. Denying disables the login.

## How the pieces fit together

- **Firebase Auth** — handles login. Each user gets an ID token.
- **Custom claims** (`role: "admin" | "user"`) — baked into that ID token
  server-side. Only your backend can set these (via `firebase-admin`), which
  is why role changes must go through an API call, never directly from the
  browser.
- **Realtime Database** (`/users/{uid}/role`) — mirrors each user's role so
  it's readable without decoding tokens, and so the Admin panel can list
  everyone.
- **Firestore** — wired up and ready (`frontend/src/firebase.ts` exports
  `firestore`) for whatever documents/files you store later; nothing reads
  from it yet since there's no sample content for it.
- **Express backend** — the *only* thing allowed to verify tokens, set
  claims, and decide who's allowed to do what. The React app never trusts
  its own idea of the role for anything sensitive — it just uses the role
  to decide what to *show*, while the backend independently re-checks on
  every request.

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

**First-time setup:**

```bash
# backend
cd backend
npm install
cp .env.example .env   # fill in your real values
npm run seed           # ONE TIME — creates admin@example.com / user@example.com

# frontend
cd frontend
npm install
cp .env.example .env   # fill in your real values
```

`npm run seed` is a **one-time** command. It's safe to re-run (it won't
overwrite a display name or password you've changed), but you never need to.

**Every time you work on it — two terminals:**

```bash
# terminal 1
cd backend && npm run dev     # http://localhost:4000

# terminal 2
cd frontend && npm run dev    # http://localhost:5173
```

Log in as the seeded super admin (`admin@example.com` — password is whatever
`sampleUsers` in `backend/src/data/sampleData.js` says, `Password` by default)
to see the **Manage users** page. That's where you approve/deny pending
signups and (as super admin) grant or revoke `admin`. The `/admin` route
requires `role: admin`, enforced both in the React route guard
(`ProtectedRoute`) and independently on the backend; pending accounts are
bounced to `/pending`.

> Make sure `SUPER_ADMIN_EMAIL` in `backend/.env` matches that seeded admin
> email, otherwise no one can approve the first signups.

## 4. Where to go next

- Swap the sample `stats` / `revenueTrend` / `recentActivity` in
  `backend/src/data/sampleData.js` for real reads from Realtime Database or
  Firestore.
- Add a Firestore-backed "Documents" page using the exported `firestore`
  instance in `frontend/src/firebase.ts`.
- If you want password reset / email verification flows, Firebase Auth
  supports both — ask and I can wire those in.
