import axios from "axios";
import { auth } from "../firebase";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
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
