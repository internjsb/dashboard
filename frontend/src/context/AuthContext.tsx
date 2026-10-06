import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import axios from "axios";
import { onAuthStateChanged, signOut as firebaseSignOut, type User as FirebaseUser } from "firebase/auth";
import { auth } from "../firebase";
import api from "../api/client";
import type { Role, UserStatus, Department, MeResponse } from "../types";
import type { PageAccessMap } from "../lib/pageAccess";

// Left in sessionStorage when a session is force-ended (account removed or
// disabled) so the login screen can explain why. Login reads and clears it.
export const AUTH_NOTICE_KEY = "authNotice";

function setAuthNotice(kind: "removed" | "disabled") {
  try {
    sessionStorage.setItem(AUTH_NOTICE_KEY, kind);
  } catch {
    /* private mode — the notice is a nicety, not essential */
  }
}

// Mirrors the Vue composable's shared, module-level reactive state: one
// AuthProvider wraps the app, and every component reads the same values via
// the useAuth() hook instead of holding separate copies.
interface AuthContextValue {
  user: FirebaseUser | null;
  displayName: string | null;
  role: Role | null;
  status: UserStatus | null;
  department: Department | null;
  pageAccess: PageAccessMap;
  isSuperAdmin: boolean;
  // Whether the account has 2FA turned on at all, vs. whether THIS session
  // has already proven possession of the authenticator (see markTwoFactorVerified).
  twoFactorEnabled: boolean | null;
  twoFactorVerified: boolean;
  // True for the full span of any hydrate() call, not just the first one.
  // waitUntilReady()/ready only ever resolve once (on app boot), so without
  // this a route guard mounting right after a fresh sign-in sees `checked`
  // already true and renders off stale role/status/twoFactorEnabled — the
  // "flash into the dashboard, then get kicked back out" glitch.
  profileLoading: boolean;
  ready: boolean;
  waitUntilReady: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markTwoFactorVerified: () => void;
  markTwoFactorDisabled: () => void;
}

// A session that already proved its OTP once shouldn't be asked again on
// every reload — remembered per tab (sessionStorage) and per account, so
// switching accounts in the same tab always starts unverified again.
function verifiedSessionKey(uid: string) {
  return `2fa_verified:${uid}`;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [pageAccess, setPageAccess] = useState<PageAccessMap>({});
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean | null>(null);
  const [twoFactorVerified, setTwoFactorVerified] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [ready, setReady] = useState(false); // true once the first auth state has been resolved

  // A one-time promise that resolves when the first auth state is known.
  // NOTE: must be created exactly once — putting `new Promise(...)` directly in
  // useRef's argument re-runs it on every render and reassigns the resolver to
  // a throwaway promise, so the real one never resolves (blank screen).
  const readyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!readyRef.current) {
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    readyRef.current = { promise, resolve };
  }

  // Force the session closed and record why, so the login screen can say so.
  const endSession = useCallback(async (kind: "removed" | "disabled") => {
    setAuthNotice(kind);
    const uid = auth.currentUser?.uid;
    await firebaseSignOut(auth).catch(() => {});
    if (uid) {
      try {
        sessionStorage.removeItem(verifiedSessionKey(uid));
      } catch {
        /* private mode — nothing was persisted to begin with */
      }
    }
    setUser(null);
    setDisplayName(null);
    setRole(null);
    setStatus(null);
    setDepartment(null);
    setPageAccess({});
    setIsSuperAdmin(false);
    setTwoFactorEnabled(null);
    setTwoFactorVerified(false);
    setProfileLoading(false);
  }, []);

  // Pull role + approval status from the backend (the source of truth). Falls
  // back to token claims if the API is unreachable, and marks status
  // "unknown" so guards don't hand out access we couldn't verify.
  const hydrate = useCallback(async (firebaseUser: FirebaseUser | null) => {
    setProfileLoading(true);
    setUser(firebaseUser);

    if (!firebaseUser) {
      setDisplayName(null);
      setRole(null);
      setStatus(null);
      setDepartment(null);
      setPageAccess({});
      setIsSuperAdmin(false);
      setTwoFactorEnabled(null);
      setTwoFactorVerified(false);
      setProfileLoading(false);
      return;
    }

    // onAuthStateChanged hands back a locally-cached profile snapshot, so
    // fields like displayName can be stale after they were changed elsewhere.
    // Pull the current profile from Firebase before trusting it. A removed or
    // disabled account makes reload() throw — end the session and leave a note.
    try {
      await firebaseUser.reload();
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/user-not-found" || code === "auth/user-token-expired") {
        return endSession("removed");
      }
      if (code === "auth/user-disabled") {
        return endSession("disabled");
      }
    }
    setDisplayName(firebaseUser.displayName ?? null);

    try {
      const { data } = await api.get<MeResponse>("/me");
      setRole(data.role);
      setStatus(data.status);
      setDepartment(data.department);
      setPageAccess(data.pageAccess || {});
      setIsSuperAdmin(data.isSuperAdmin);
      setTwoFactorEnabled(data.twoFactorEnabled);
      let verifiedThisSession = false;
      try {
        verifiedThisSession = sessionStorage.getItem(verifiedSessionKey(firebaseUser.uid)) === "1";
      } catch {
        /* private mode — falls back to requiring verification */
      }
      setTwoFactorVerified(data.twoFactorEnabled && verifiedThisSession);
    } catch (err) {
      const code = axios.isAxiosError(err)
        ? (err.response?.data as { code?: string } | undefined)?.code
        : undefined;
      if (code === "account_removed") return endSession("removed");
      if (code === "account_disabled") return endSession("disabled");

      console.error("Couldn't load /me:", err);
      const t = await firebaseUser.getIdTokenResult().catch(() => null);
      setRole((t?.claims.role as Role) || null);
      setStatus("unknown");
      setDepartment(null);
      setPageAccess({});
      setIsSuperAdmin(false);
      // Unknown 2FA state — fail closed (treat as enabled-but-unverified)
      // rather than silently letting the session through unchecked.
      setTwoFactorEnabled(true);
      setTwoFactorVerified(false);
    } finally {
      setProfileLoading(false);
    }
  }, [endSession]);

  useEffect(() => {
    // Safety net: if Firebase Auth never reports (seen on the newest Safari
    // when storage is restricted), proceed as logged-out after 5s instead of
    // leaving the app stuck on a blank screen.
    const timeout = setTimeout(() => {
      console.warn("Firebase auth did not report within 5s — continuing.");
      setReady(true);
      readyRef.current?.resolve();
    }, 5000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout);
      await hydrate(firebaseUser);
      setReady(true);
      readyRef.current?.resolve();
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [hydrate]);

  // Resolves once the first auth state (and its /me lookup) has completed.
  // Route guards await this so a page refresh doesn't briefly look "logged out".
  function waitUntilReady() {
    return readyRef.current!.promise;
  }

  async function signOut() {
    // Clear this account's "verified this session" marker so logging back in
    // — even in the same tab — always asks for the OTP again. Without this,
    // sessionStorage outlives sign-out and a re-login skips 2FA entirely.
    const uid = auth.currentUser?.uid;
    await firebaseSignOut(auth);
    if (uid) {
      try {
        sessionStorage.removeItem(verifiedSessionKey(uid));
      } catch {
        /* private mode — nothing was persisted to begin with */
      }
    }
  }

  // Called once the OTP step succeeds (fresh setup or a returning login).
  // Session-scoped so re-verification is required again next time this
  // account signs in from a new tab/browser session.
  function markTwoFactorVerified() {
    if (!auth.currentUser) return;
    try {
      sessionStorage.setItem(verifiedSessionKey(auth.currentUser.uid), "1");
    } catch {
      /* private mode — verification still holds for the rest of this render session */
    }
    setTwoFactorEnabled(true);
    setTwoFactorVerified(true);
  }

  // Called once the account owner turns 2FA off from Profile. Clears the
  // "verified this session" marker too, so turning it back on later starts
  // from a clean state instead of a stale flag from before it was disabled.
  function markTwoFactorDisabled() {
    if (auth.currentUser) {
      try {
        sessionStorage.removeItem(verifiedSessionKey(auth.currentUser.uid));
      } catch {
        /* private mode — nothing was persisted to begin with */
      }
    }
    setTwoFactorEnabled(false);
    setTwoFactorVerified(false);
  }

  // Force a fresh ID token + re-fetch role/status. Call after registering or
  // after an admin changes someone's access.
  async function refreshRole() {
    if (!auth.currentUser) return;
    await auth.currentUser.getIdToken(true);
    await hydrate(auth.currentUser);
  }

  // Re-read the Firebase profile (display name, etc.) after the user edits it.
  async function refreshProfile() {
    if (!auth.currentUser) return;
    await auth.currentUser.reload().catch(() => {});
    setUser(auth.currentUser);
    setDisplayName(auth.currentUser.displayName ?? null);
  }

  const value: AuthContextValue = {
    user,
    displayName,
    role,
    status,
    department,
    pageAccess,
    isSuperAdmin,
    twoFactorEnabled,
    twoFactorVerified,
    profileLoading,
    ready,
    waitUntilReady,
    signOut,
    refreshRole,
    refreshProfile,
    markTwoFactorVerified,
    markTwoFactorDisabled,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
