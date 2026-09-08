<template>
  <div class="login-screen">
    <div class="login-card">
      <div class="brand">
        <div class="brand-mark">A</div>
        <span>Amazon Ops Console</span>
      </div>

      <h1>Sign in</h1>
      <p class="subtitle">Use your assigned email and password to continue.</p>

      <form @submit.prevent="handleSubmit">
        <label class="field">
          <span>Email</span>
          <input v-model="email" type="email" required autocomplete="email" placeholder="you@example.com" />
        </label>

        <label class="field">
          <span>Password</span>
          <input v-model="password" type="password" required autocomplete="current-password" placeholder="••••••••" />
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <button type="submit" class="submit-btn" :disabled="loading">
          {{ loading ? "Signing in…" : "Sign in" }}
        </button>
      </form>

      <p class="hint">
        Seed accounts: <code>admin@example.com</code> / <code>user@example.com</code>, password <code>Passw0rd!</code>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

const router = useRouter();
const route = useRoute();

async function handleSubmit() {
  error.value = "";
  loading.value = true;
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
    router.push(route.query.redirect || "/dashboard");
  } catch (err) {
    error.value = mapError(err.code);
  } finally {
    loading.value = false;
  }
}

function mapError(code) {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a moment.";
    default:
      return "Couldn't sign in. Please try again.";
  }
}
</script>

<style scoped>
.login-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 15% 20%, rgba(14, 143, 127, 0.16), transparent 45%),
    var(--sidebar-bg);
  padding: 24px;
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border-radius: var(--radius-md);
  padding: 40px 36px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  color: var(--text-secondary);
}

.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
}

h1 {
  font-size: 24px;
  margin-bottom: 6px;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0 0 28px;
}

.field {
  display: block;
  margin-bottom: 16px;
}

.field span {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.field input {
  width: 100%;
  padding: 11px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  font-size: 14px;
  font-family: var(--font-body);
  background: var(--bg);
}

.field input:focus {
  outline: none;
  border-color: var(--accent);
  background: var(--surface);
}

.error {
  color: var(--danger);
  font-size: 13px;
  margin: -6px 0 14px;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: white;
  font-weight: 700;
  font-size: 14px;
  margin-top: 4px;
}

.submit-btn:hover { background: var(--accent-strong); }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.hint {
  margin-top: 24px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.6;
}

.hint code {
  background: var(--bg);
  padding: 1px 5px;
  border-radius: 4px;
}
</style>
