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
  if (!checked) return null;

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

  // Every account must clear 2FA before reaching anything else — regardless
  // of how they arrived here (fresh login, a bookmarked URL, or a Firebase
  // session that was already signed in from before). Not set up yet ->
  // setup; set up but not proven this session -> verify.
  if (location.pathname !== "/setup-2fa" && location.pathname !== "/verify-2fa") {
    if (twoFactorEnabled === false) {
      return <Navigate to="/setup-2fa" replace />;
    }
    if (twoFactorEnabled === true && !twoFactorVerified) {
      return <Navigate to="/verify-2fa" replace />;
    }
  }

  if (role && role !== userRole) {
    return <Navigate to="/forbidden" replace />;
  }

  if (page && !canAccessPage(isSuperAdmin, department, page)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
