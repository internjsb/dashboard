import AppSidebar from "../components/AppSidebar";
import AppTopbar from "../components/AppTopbar";
import styles from "./ProductListings.module.css";

export default function ProductListings() {
  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-content">
        <AppTopbar title="Products listings" />
        <main className={styles.content} />
      </div>
    </div>
  );
}
