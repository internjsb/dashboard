import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../hooks/useSidebar";
import styles from "./AppSidebar.module.css";

export default function AppSidebar() {
  const { user, displayName, role, isSuperAdmin, signOut } = useAuth();
  const { isMobile, collapsed, mobileOpen, closeMobile, setWidth, resetWidth } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();

  // Close the slide-in menu after navigating on mobile.
  useEffect(() => {
    closeMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // --- Drag-to-resize the sidebar ----------------------------------------
  const [dragging, setDragging] = useState(false);
  const stopDragRef = useRef<(() => void) | null>(null);

  function startDrag(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(true);
    document.body.classList.add("sidebar-resizing"); // kills the width transition while dragging

    function onMove(ev: PointerEvent) {
      setWidth(ev.clientX);
    }
    function stopDrag() {
      setDragging(false);
      document.body.classList.remove("sidebar-resizing");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stopDrag);
      stopDragRef.current = null;
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stopDrag);
    stopDragRef.current = stopDrag;
  }

  useEffect(() => {
    return () => stopDragRef.current?.();
  }, []);

  const initials = (user?.email || "").slice(0, 2).toUpperCase();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `${styles.navItem} ${isActive ? styles.active : ""}`;

  return (
    <>
      {isMobile && mobileOpen && (
        <button className="app-backdrop" aria-label="Close menu" onClick={closeMobile} />
      )}
      <aside className={`app-sidebar ${styles.sidebar}`}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>A</div>
          <span>Amazon Dashboard</span>
        </div>

        <nav className={styles.nav}>
          <NavLink to="/dashboard" className={navItemClass}>
            <span className={styles.dot} />
            Dashboard
          </NavLink>
          <NavLink to="/sales-history" className={navItemClass}>
            <span className={styles.dot} />
            Sales history
          </NavLink>
          <NavLink to="/profile" className={navItemClass}>
            <span className={styles.dot} />
            Profile
          </NavLink>
          {role === "admin" && (
            <NavLink to="/admin" className={navItemClass}>
              <span className={styles.dot} />
              Manage users
            </NavLink>
          )}
          {role === "admin" && (
            <NavLink to="/audit" className={navItemClass}>
              <span className={styles.dot} />
              Audit log
            </NavLink>
          )}
        </nav>

        <div className={styles.sidebarFooter}>
          <NavLink to="/profile" className={styles.userLine}>
            <div className={styles.avatar}>{initials}</div>
            <div className={styles.userMeta}>
              <span className={styles.email}>{displayName || user?.email}</span>
              <span className={`${styles.roleTag} ${(role && styles[role]) || ""}`}>
                {isSuperAdmin ? "super admin" : role}
              </span>
            </div>
          </NavLink>
          <button className={styles.signout} onClick={handleSignOut}>
            Sign out
          </button>
        </div>

        {!isMobile && !collapsed && (
          <div
            className={`${styles.resizeHandle} ${dragging ? styles.dragging : ""}`}
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize · double-click to reset"
            onPointerDown={startDrag}
            onDoubleClick={resetWidth}
          >
            <span className={styles.grip} />
          </div>
        )}
      </aside>
    </>
  );
}
