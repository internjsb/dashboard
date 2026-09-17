import { useState } from "react"
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AxiosError } from "axios";
import api from "../api/client";
import styles from "./TwoFAVerification.module.css";

type TwoFAVerificationProps = {
    onVerifySuccess: (data: unknown) => void;
    onRestSuccess: (data: unknown) => void;
};

const TwoFAVerification = ({onVerifySuccess, onRestSuccess}: TwoFAVerificationProps) => {
    const navigate = useNavigate();
    const [otp, setOtp] = useState ("");
    const [error, setError] = useState ("");

    const handleTokenVerification = async(e: React.FormEvent) => {
        e.preventDefault();
        try
        {
            const {data} = await api.post("/2fa/verify", { token: otp });
            onVerifySuccess(data);
        }
        catch(err){
            setOtp("");
            const axiosErr = err as AxiosError<{ error?: string }>;
            console.log("The err is : ", axiosErr.message);
            setError(axiosErr.response?.data?.error || "Invalid OTP");
        }
    };

    const handleReset = async() => {
        try{
            const {data} = await api.post("/2fa/reset");
            onRestSuccess(data);
        }
        catch(err){
            const axiosErr = err as AxiosError<{ error?: string }>;
            console.log("The err is : ", axiosErr.message);
            setError(axiosErr.response?.data?.error || axiosErr.message);
        }
    }
    return (
        <form onSubmit={handleTokenVerification}>
          <div className={styles.loginScreen}>

              <div className={styles.loginCard}>
                <button type="button" onClick={() => navigate(-1)} className={styles.backBtn} aria-label="Go back">
                  <ArrowLeft size={18} />
                </button>
                <div className={styles.brand}>
                  <div className={styles.brandMark}>Jsb</div>
                  <span>Amazon Dashboard</span>
                </div>
                <h2 className={styles.title}>Validate OTP</h2>
                <p className={styles.subtitle}>Please enter 6-digit Time base OTP to verify 2FA authentication</p>

                <div className={styles.qrSection}>

                    <div className={styles.manualEntry}>
                        <span className={styles.manualEntryLabel}>Enter your OTP code</span>
                        <div className={styles.secretRow}>
                            {error && <p className={styles.message}>{error}</p>}
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className={styles.otpInput}
                                placeholder="Enter your OTP"
                            />
                        </div>
                    </div>
                </div>
                <button
                // onClick={onSetupComplete}
                 className={styles.continueBtn}>
                   Verify TOTP
                </button>
                <button
                 onClick={handleReset}
                 type="button" className={styles.resentbutton}>
                    Reset 2FA
                </button>
                </div>
            </div>
        </form>
    );
}

export default TwoFAVerification;
