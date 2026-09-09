import { useSyncExternalStore } from "react";

// Shared, external (module-level) sidebar state — mirrors the Vue
// composable's shared `ref`s. React has no built-in "module-level reactive
// value" the way Vue's `ref` is, so this is a tiny external store (plain
// mutable object + subscriber set) read via useSyncExternalStore, which is
// the React-idiomatic way to subscribe a component to state that lives
// outside React itself.
//
//  - drag the handle on the sidebar's right edge to resize it (persisted)
//  - the topbar button collapses it to an icon rail (desktop) or slides it
//    in/out over the content (mobile, <= 900px)
// The live width is pushed onto the --sidebar-width CSS variable so the page
// layout (which keys its left margin off that var) follows for free.

const MOBILE_BP = 900;
const MIN_W = 160;
const MAX_W = 380;
const DEFAULT_W = 200;

function clampW(px: number): number {
  return Math.max(MIN_W, Math.min(MAX_W, Math.round(px)));
}

interface SidebarState {
  width: number;
  collapsed: boolean;
  mobileOpen: boolean;
  isMobile: boolean;
}

function readInitialState(): SidebarState {
  if (typeof window === "undefined") {
    return { width: DEFAULT_W, collapsed: false, mobileOpen: false, isMobile: false };
  }
  const stored = parseInt(localStorage.getItem("sidebar:width") || "", 10);
  return {
    width: Number.isFinite(stored) ? clampW(stored) : DEFAULT_W,
    collapsed: localStorage.getItem("sidebar:collapsed") === "1",
    mobileOpen: false,
    isMobile: window.innerWidth <= MOBILE_BP,
  };
}

let state: SidebarState = readInitialState();
const listeners = new Set<() => void>();

function apply() {
  if (typeof document === "undefined" || !document.body) return;
  const root = document.documentElement;

  root.style.setProperty(
    "--sidebar-width",
    state.isMobile ? "0px" : state.collapsed ? "var(--sidebar-width-rail)" : `${state.width}px`
  );

  document.body.classList.toggle("sidebar-collapsed", !state.isMobile && state.collapsed);
  document.body.classList.toggle("sidebar-mobile", state.isMobile);
  document.body.classList.toggle("sidebar-mobile-open", state.isMobile && state.mobileOpen);
}

function setState(patch: Partial<SidebarState>) {
  state = { ...state, ...patch };
  apply();
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  apply(); // initial apply, mirrors the Vue watcher's { immediate: true }

  window.addEventListener("resize", () => {
    const m = window.innerWidth <= MOBILE_BP;
    if (m !== state.isMobile) {
      setState({ isMobile: m, mobileOpen: m ? state.mobileOpen : false });
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): SidebarState {
  return state;
}

export interface UseSidebarResult extends SidebarState {
  toggle: () => void;
  closeMobile: () => void;
  setWidth: (px: number) => void;
  resetWidth: () => void;
  MIN_W: number;
  MAX_W: number;
}

export function useSidebar(): UseSidebarResult {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  function toggle() {
    if (snapshot.isMobile) {
      setState({ mobileOpen: !snapshot.mobileOpen });
    } else {
      const next = !snapshot.collapsed;
      localStorage.setItem("sidebar:collapsed", next ? "1" : "0");
      setState({ collapsed: next });
    }
  }

  function closeMobile() {
    if (state.mobileOpen) setState({ mobileOpen: false });
  }

  // px = distance from the viewport's left edge (i.e. the pointer's clientX).
  function setWidth(px: number) {
    const w = clampW(px);
    localStorage.setItem("sidebar:width", String(w));
    setState({ width: w });
  }

  function resetWidth() {
    localStorage.setItem("sidebar:width", String(DEFAULT_W));
    setState({ width: DEFAULT_W });
  }

  return { ...snapshot, toggle, closeMobile, setWidth, resetWidth, MIN_W, MAX_W };
}
