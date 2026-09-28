import { useSyncExternalStore } from "react";

// Shared, external (module-level) theme state — same pattern as useSidebar.ts.
// index.html sets data-theme on <html> inline, before first paint (so there's
// no flash of the wrong palette while React boots); this hook takes over from
// there for anything that changes it afterwards.

export type Theme = "light" | "dark";

function systemPreference(): Theme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem("theme");
  return stored === "light" || stored === "dark" ? stored : systemPreference();
}

let theme: Theme = readInitialTheme();
const listeners = new Set<() => void>();

function apply() {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

function setState(next: Theme) {
  theme = next;
  apply();
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  apply(); // in sync with the inline script in index.html, but harmless if already applied
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return theme;
}

export interface UseThemeResult {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

export function useTheme(): UseThemeResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  function setTheme(next: Theme) {
    localStorage.setItem("theme", next);
    setState(next);
  }

  function toggleTheme() {
    setTheme(snapshot === "dark" ? "light" : "dark");
  }

  return { theme: snapshot, setTheme, toggleTheme };
}
