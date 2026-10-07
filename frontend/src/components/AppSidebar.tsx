import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  Boxes,
  Wallet,
  Tag,
  ListChecks,
  FileText,
  CircleUserRound,
  Users,
  ScrollText,
  Table2,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../hooks/useSidebar";
import { useStock } from "../hooks/useStock";
import { canAccessPage } from "../lib/pageAccess";
import styles from "./AppSidebar.module.css";

export default function AppSidebar() {
  const { user, displayName, role, pageAccess, isSuperAdmin, signOut } = useAuth();
  const { isMobile, collapsed, mobileOpen, closeMobile, setWidth, resetWidth } = useSidebar();

  const canSeeDashboard = canAccessPage(isSuperAdmin, pageAccess, "dashboard");
  const canSeeSalesHistory = canAccessPage(isSuperAdmin, pageAccess, "sales_history");
  const canSeeStockAvailable = canAccessPage(isSuperAdmin, pageAccess, "stock_available");
  const canSeeInventory = canAccessPage(isSuperAdmin, pageAccess, "inventory");
  const canSeeFinance = canAccessPage(isSuperAdmin, pageAccess, "finance");
  const canSeeProducts = canAccessPage(isSuperAdmin, pageAccess, "products");
  const canSeeProductListings = canAccessPage(isSuperAdmin, pageAccess, "product_listings");
  const canSeeSaleReport = canAccessPage(isSuperAdmin, pageAccess, "sale_report");

  const { lowItems } = useStock(canSeeStockAvailable || canSeeInventory);
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
          <div className={styles.brandMark}>Jsb</div>
          <span>Amazon Dashboard</span>
        </div>

        <nav className={styles.nav}>
          {canSeeDashboard && (
            <NavLink to="/dashboard" className={navItemClass}>
              <LayoutDashboard className={styles.icon} size={18} />
              Dashboard
            </NavLink>
          )}
          {canSeeSalesHistory && (
            <NavLink to="/sales-history" className={navItemClass}>
              <TrendingUp className={styles.icon} size={18} />
              Sales history
            </NavLink>
          )}
          {canSeeSaleReport && (
            <NavLink to="/sale-report" className={navItemClass}>
              <FileText className={styles.icon} size={18} />
              Sales report
            </NavLink>
          )}
          {canSeeStockAvailable && (
            <NavLink to="/stock-available" className={navItemClass}>
              <Package className={styles.icon} size={18} />
              Stock available
              {lowItems.length > 0 && (
                <span className={styles.badge} title={`${lowItems.length} item(s) low on stock`}>
                  {lowItems.length}
                </span>
              )}
            </NavLink>
          )}
          {canSeeInventory && (
            <NavLink to="/inventory" className={navItemClass}>
              <Boxes className={styles.icon} size={18} />
              Inventory
            </NavLink>
          )}
          {canSeeFinance && (
            <NavLink to="/finance" className={navItemClass}>
              <Wallet className={styles.icon} size={18} />
              Finance
            </NavLink>
          )}
          {canSeeProducts && (
            <NavLink to="/products" className={navItemClass}>
              <Tag className={styles.icon} size={18} />
              Products
            </NavLink>
          )}
          {canSeeProductListings && (
            <NavLink to="/product-listings" className={navItemClass}>
              <ListChecks className={styles.icon} size={18} />
              AMAZON Listing
            </NavLink>
          )}
          <NavLink to="/profile" className={navItemClass}>
            <CircleUserRound className={styles.icon} size={18} />
            Profile
          </NavLink>
          {role === "admin" && (
            <NavLink to="/admin" className={navItemClass}>
              <Users className={styles.icon} size={18} />
              Manage users
            </NavLink>
          )}
          {role === "admin" && (
            <NavLink to="/page-management" className={navItemClass}>
              <Table2 className={styles.icon} size={18} />
              Page management
            </NavLink>
          )}
          <NavLink to="/audit" className={navItemClass}>
            <ScrollText className={styles.icon} size={18} />
            Audit log
          </NavLink>
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
            <LogOut className={styles.signoutIcon} size={16} />
            <span className={styles.signoutLabel}>Sign out</span>
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
