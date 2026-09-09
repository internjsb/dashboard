import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

interface ProtectedRouteProps {
  children: ReactNode;
  role?: Role;
}

// Replaces the Vue router's global beforeEach guard. Wrap any route element
// that needs auth in this; pass `role` for routes that also need a specific
// role (mirrors the route `meta` object in the old router config).
export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, role: userRole, status, waitUntilReady } = useAuth();
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
  // Approved — don't leave them stranded on the waiting screen.
  if (location.pathname === "/pending") {
    return <Navigate to="/dashboard" replace />;
  }

  if (role && role !== userRole) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
}
