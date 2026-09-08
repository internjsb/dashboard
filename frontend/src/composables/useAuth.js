import { ref } from "vue";
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "../firebase";

// Shared, module-level reactive state — every component that imports this
// composable sees the same user/role/ready values instead of separate copies.
const user = ref(null);
const role = ref(null); // "admin" | "user" | null (not logged in)
const ready = ref(false); // true once Firebase has reported the initial auth state

onAuthStateChanged(auth, async (firebaseUser) => {
  user.value = firebaseUser;
  if (firebaseUser) {
    const tokenResult = await firebaseUser.getIdTokenResult();
    role.value = tokenResult.claims.role || "user";
  } else {
    role.value = null;
  }
  ready.value = true;
});

// Resolves once the first auth state has been reported. Use this in route
// guards so a page refresh doesn't briefly look "logged out".
let readyPromise;
function waitUntilReady() {
  if (!readyPromise) {
    readyPromise = new Promise((resolve) => {
      if (ready.value) return resolve();
      const unwatch = onAuthStateChanged(auth, () => {
        unwatch();
        resolve();
      });
    });
  }
  return readyPromise;
}

async function signOut() {
  await firebaseSignOut(auth);
}

// Forces a fresh ID token (and thus fresh custom claims) from the server —
// call this right after an admin changes someone's role so it takes effect
// without requiring a full logout/login.
async function refreshRole() {
  if (!auth.currentUser) return;
  const tokenResult = await auth.currentUser.getIdTokenResult(true);
  role.value = tokenResult.claims.role || "user";
}

export function useAuth() {
  return { user, role, ready, waitUntilReady, signOut, refreshRole };
}
