import "dotenv/config";
import admin from "firebase-admin";

// Service-account credentials — the only credential type that can verify ID
// tokens, set custom claims, and do privileged reads/writes. This is NOT the
// same as the client apiKey used in frontend/src/firebase.js.
const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

export const auth = admin.auth();
export const rtdb = admin.database();
export default admin;
