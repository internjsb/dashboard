import { Link } from "react-router-dom";
import styles from "./NotFound.module.css";

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <h1>404</h1>
      <p>That page doesn't exist.</p>
      <Link to="/dashboard" className={styles.back}>
        Back to dashboard
      </Link>
    </div>
  );
}
