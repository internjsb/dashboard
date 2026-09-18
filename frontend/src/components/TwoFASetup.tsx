import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import styles from "./TwoFASetup.module.css";

type TwoFASetupProps = {
    onSetupComplete: () => void;
};

type SetupResponse = {
    qrCode?: string;
    secret?: string;
};

const TwoFASetup = ({onSetupComplete}: TwoFASetupProps) => {
    const navigate = useNavigate();
    const { signOut } = useAuth();
    const [response, setResponse] = useState<SetupResponse>({});
    const [message, setMessage] = useState("");

    // Still fully signed in at this point (2FA not enabled yet, so this page
    // is unavoidable), so a plain navigate back would get bounced right back
    // here by the route guard. Sign out first so /login is actually usable.
    const handleBack = async () => {
        await signOut().catch(() => {});
        navigate("/login", { replace: true });
    };

    const fetchQRcode = async () => {
        try {
            const { data } = await api.post("/2fa/setup");
            setResponse(data);
        } catch (err) {
            console.error("Failed to start 2FA setup:", err);
            setMessage("Couldn't load the QR code. Try refreshing the page.");
        }
    };

    useEffect(() => {
        fetchQRcode();
    }, []);
    const copyClipBoard = async () => {
        if (!response.secret) return;
        await navigator.clipboard.writeText(response.secret);
        setMessage("Secret copied to clipboard")
    }
    return <div className={styles.loginScreen}>
    
      <div className={styles.loginCard}>
        <button type="button" onClick={handleBack} className={styles.backBtn} aria-label="Go back">
          <ArrowLeft size={18} />
        </button>
        <div className={styles.brand}>
          <div className={styles.brandMark}>Jsb</div>
          <span>Amazon Dashboard</span>
        </div>
        <h2 className={styles.title}>Turn on 2FA verification</h2>
        <p className={styles.subtitle}>Scan the QR code below with your authenticator app</p>

        <div className={styles.qrSection}>
            <div className={styles.qrWrap}>
                {response.qrCode ? (
                  <img
                 className={styles.qrImage} 
                 src={response.qrCode} 
                 alt="QR code" />  
                ) : ("")}
                
            </div>
            <div className={styles.manualEntry}>
                <span className={styles.manualEntryLabel}>Or enter the code manually</span>
                <div className={styles.secretRow}>
                    {message && <p className={styles.message}>{message}</p>}
                    <input
                        readOnly
                        defaultValue={""}
                        value={response.secret}
                        className={styles.secretInput}
                        onClick={copyClipBoard}
                    />
                </div>
            </div>
        </div>
        <button onClick={onSetupComplete}
         className={styles.continueBtn}>
            Continue to Verification
        </button>
      </div>
    </div>
}

export default TwoFASetup;