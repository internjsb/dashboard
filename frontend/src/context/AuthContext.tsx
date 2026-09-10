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
import type { Role, UserStatus, MeResponse } from "../types";

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
  isSuperAdmin: boolean;
  ready: boolean;
  waitUntilReady: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [status, setStatus] = useState<UserStatus | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
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
    await firebaseSignOut(auth).catch(() => {});
    setUser(null);
    setDisplayName(null);
    setRole(null);
    setStatus(null);
    setIsSuperAdmin(false);
  }, []);

  // Pull role + approval status from the backend (the source of truth). Falls
  // back to token claims if the API is unreachable, and marks status
  // "unknown" so guards don't hand out access we couldn't verify.
  const hydrate = useCallback(async (firebaseUser: FirebaseUser | null) => {
    setUser(firebaseUser);

    if (!firebaseUser) {
      setDisplayName(null);
      setRole(null);
      setStatus(null);
      setIsSuperAdmin(false);
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
      setIsSuperAdmin(data.isSuperAdmin);
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
      setIsSuperAdmin(false);
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
    await firebaseSignOut(auth);
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
    isSuperAdmin,
    ready,
    waitUntilReady,
    signOut,
    refreshRole,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
