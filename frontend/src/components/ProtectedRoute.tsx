import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { canAccessPage, defaultPageFor, type PageKey } from "../lib/pageAccess";
import type { Role } from "../types";

interface ProtectedRouteProps {
  children: ReactNode;
  role?: Role;
  /** For business pages gated by department (see lib/pageAccess.ts). */
  page?: PageKey;
}

// Replaces the Vue router's global beforeEach guard. Wrap any route element
// that needs auth in this; pass `role` for routes that also need a specific
// role, or `page` for routes gated by department (mirrors the route `meta`
// object in the old router config).
export default function ProtectedRoute({ children, role, page }: ProtectedRouteProps) {
  const {
    user,
    role: userRole,
    status,
    department,
    isSuperAdmin,
    twoFactorEnabled,
    twoFactorVerified,
    profileLoading,
    waitUntilReady,
  } = useAuth();
  const [checked, setChecked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    waitUntilReady().then(() => {
      if (mounted) setChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, [waitUntilReady]);

  // Wait for Firebase's first auth-state report (and its /me lookup) so a
  // page refresh doesn't wrongly look logged-out while that check is in flight.
  // profileLoading also covers every LATER hydrate (e.g. a fresh sign-in) —
  // checked alone only ever resolves once, on app boot, so without this a
  // route mounting right after login would render off stale role/status/2FA.
  if (!checked || profileLoading) return null;

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  // Signed in but the account hasn't been approved by an admin yet.
  if (status === "pending") {
    return location.pathname === "/pending" ? <>{children}</> : <Navigate to="/pending" replace />;
  }
  if (status === "denied") {
    return <Navigate to="/forbidden" replace />;
  }
  // Approved — don't leave them stranded on the waiting screen. Send them to
  // whichever page their role/department actually grants, not always /dashboard.
  if (location.pathname === "/pending") {
    return <Navigate to={defaultPageFor(isSuperAdmin, department)} replace />;
  }

  // 2FA is opt-in (toggled from Profile), not forced on every account. An
  // account that has turned it on still has to prove it each new session
  // before reaching anything else — regardless of how they arrived here
  // (fresh login, a bookmarked URL, or an already-signed-in Firebase session).
  if (location.pathname !== "/setup-2fa" && location.pathname !== "/verify-2fa") {
    if (twoFactorEnabled === true && !twoFactorVerified) {
      return <Navigate to="/verify-2fa" replace />;
    }
  }

  // When both are given, either one satisfies the guard (e.g. a page that
  // admins should see regardless of department, on top of the departments
  // that already grant it). A single prop keeps its own strict check.
  if (role && page) {
    const roleOk = role === userRole;
    const pageOk = canAccessPage(isSuperAdmin, department, page);
    if (!roleOk && !pageOk) {
      return <Navigate to="/forbidden" replace />;
    }
  } else {
    if (role && role !== userRole) {
      return <Navigate to="/forbidden" replace />;
    }
    if (page && !canAccessPage(isSuperAdmin, department, page)) {
      return <Navigate to="/forbidden" replace />;
    }
  }

  return <>{children}</>;
}
