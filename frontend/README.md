# frontend

React 18 + TypeScript + Vite. Talks to `../backend` (Express, unchanged) over
the same REST API the app has always used.

## Run it

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Needs the backend running too: `cd ../backend && npm run dev` (http://localhost:4000).

`.env` holds the Firebase client config and `VITE_API_URL` — see the root
README for what each variable is and how to fill it in.

## Structure

- `src/context/AuthContext.tsx` — auth state (current user, role, approval
  status) via React Context; every component reads it through `useAuth()`.
- `src/components/ProtectedRoute.tsx` — route guard: waits for the first
  auth check, then redirects unauthenticated/pending/denied/role-mismatched
  users.
- `src/hooks/useSidebar.ts` — the sidebar's resize/collapse/mobile-drawer
  state, implemented as a small external store (`useSyncExternalStore`) so
  it's shared across components without needing a Provider.
- `src/types.ts` — shared types for what the backend API returns.
- `src/views/` — one file per route (Dashboard, AdminPanel, Login, Register,
  Pending, Forbidden, NotFound).
- `src/components/` — Sidebar, Topbar, StatCard, RevenueChart, RecentActivity.
- Each component/view has a matching `*.module.css` for scoped styling;
  `src/styles/tokens.css` holds the shared design tokens (colors, spacing,
  the sidebar-collapse/mobile CSS).

## A heads-up on installing dependencies

If `npm install` fails to reach the npm registry from a sandboxed shell,
run it from a normal Terminal instead — nothing about this project needs a
restricted network. After installing, `tsc -b` type-checks the whole app.
