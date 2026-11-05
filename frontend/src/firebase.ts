import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
} from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// getAuth() can hang on the newest Safari when storage is partitioned or
// blocked (Lockdown Mode, "Block all cookies", strict tracking prevention):
// the persistence probe never resolves, onAuthStateChanged never fires, and
// the app is stuck on a blank screen. An explicit fallback chain lets Auth
// degrade to session/in-memory storage instead of hanging.
export const auth = initializeAuth(app, {
  // Session-only: the login lasts while the tab is open (refresh is fine), and
  // closing it signs you out — reopening the link always asks you to log in.
  // indexedDB/local persistence are left out on purpose; they'd keep you signed
  // in for days.
  persistence: [
    browserSessionPersistence,
    inMemoryPersistence,
  ],
  // getAuth() wires this up automatically; initializeAuth() does not, and
  // without it signInWithPopup/Redirect throw auth/argument-error.
  popupRedirectResolver: browserPopupRedirectResolver,
});
export const rtdb = getDatabase(app);       // used for lightweight/live data
export const firestore = getFirestore(app); // used for file/document metadata (storage)
export default app;
