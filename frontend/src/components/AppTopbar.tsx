import { useSidebar } from "../hooks/useSidebar";
import styles from "./AppTopbar.module.css";
import { useState } from "react";
import { MARKETPLACES, useMarketplace } from "../hooks/useMarketplace";


interface AppTopbarProps {
  title?: string;
}

export default function AppTopbar({ title = "" }: AppTopbarProps) {
  const { toggle } = useSidebar();
  const [selected, setSelected] = useState("");
  const { code, setMarketplace } = useMarketplace();

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

        <select className={styles.select} value={code} onChange={(e) => setMarketplace(e.target.value)}>
          <option value="">All marketplaces</option>
          {MARKETPLACES.map((m) => (
            <option key={m.code} value={m.code}>
              {m.label}
            </option>
          ))}
        </select>



{/* 
      <select
          className={styles.select}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Select…</option>
          <option value="option1">France</option>
          <option value="option2"> Saudi Arabia</option>
          <option value="option3"> Netherlands</option>
          <option value="option1">Mexico</option>
          <option value="option2"> Poland</option>
          <option value="option3"> United Kingdom</option>
            <option value="option3"> Germany</option>
          <option value="option1">Spain</option>
          <option value="option2"> Japan</option>
          <option value="option3">  Ireland</option>
            <option value="option3"> Canada</option>
          <option value="option1">Sweden</option>
          <option value="option2"> Brazil</option>
          <option value="option3">  UAE</option>
          <option value="option2"> Turkey</option>
          <option value="option3">  Australia</option>
            <option value="option3"> Belgium</option>
          <option value="option1">Italy</option>
          <option value="option2"> United States</option>

        </select> */}
      </div>
    </header>
  );
}
