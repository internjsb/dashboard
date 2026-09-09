import axios from "axios";
import { auth } from "../firebase";

const client = axios.create({
  // Production (Vercel): frontend + API share an origin, so a relative "/api"
  // just works. Local dev: set VITE_API_URL=http://localhost:4000/api in
  // frontend/.env so the Vite server talks to the separate backend process.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  // Bounded so a down/slow backend can't hang the auth bootstrap (route
  // guards await a /me call before the first navigation resolves).
  timeout: 10000,
});

// Attach a fresh ID token to every request. Firebase caches tokens client-side
// and only hits the network when one is near expiry, so this is cheap to call
// on every request rather than something to optimize away.
client.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
