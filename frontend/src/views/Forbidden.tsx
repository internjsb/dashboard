import { Link } from "react-router-dom";
import styles from "./Forbidden.module.css";

export default function Forbidden() {
  return (
    <div className={styles.wrap}>
      <h1>403</h1>
      <p>You don't have access to that page.</p>
      <Link to="/dashboard" className={styles.back}>
        Back to dashboard
      </Link>
    </div>
  );
}
