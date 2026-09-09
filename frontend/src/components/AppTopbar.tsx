import { useSidebar } from "../hooks/useSidebar";
import styles from "./AppTopbar.module.css";

interface AppTopbarProps {
  title?: string;
}

export default function AppTopbar({ title = "" }: AppTopbarProps) {
  const { toggle } = useSidebar();

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <header className={styles.topbar}>
      <div className={styles.topbarLeft}>
        <button className={styles.menuBtn} aria-label="Toggle sidebar" onClick={toggle}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <h2>{title}</h2>
      </div>
      <div className={styles.topbarRight}>
        <span className={styles.date}>{today}</span>
      </div>
    </header>
  );
}
