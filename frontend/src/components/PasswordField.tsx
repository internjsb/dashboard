import { useState, type InputHTMLAttributes } from "react";
import styles from "./PasswordField.module.css";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * A password <input> with a show/hide eye toggle. Spreads through every normal
 * input prop (value, onChange, required, autoComplete, placeholder, …) so it
 * drops in wherever a plain password input was used.
 */
export default function PasswordField({ style, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <span className={styles.wrap}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        style={{ paddingRight: 40, ...style }}
      />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff /> : <Eye />}
      </button>
    </span>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
