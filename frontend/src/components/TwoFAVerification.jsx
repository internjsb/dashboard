import React, { useState } from "react"
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api/client";
import styles from "./TwoFAVerification.module.css";

const TwoFAVerification = ({onVerifySuccess, onRestSuccess}) => {
    const navigate = useNavigate();
    const [otp, setOtp] = useState ("");
    const [error, setError] = useState ("");

    const handleTokenVerification = async(e) => {
        e.preventDefault();
        try
        {
            const {data} = await api.post("/2fa/verify", { token: otp });
            onVerifySuccess(data);
        }
        catch(err){
            setOtp("");
            console.log("The err is : ", err.message);
            setError(err.response?.data?.error || "Invalid OTP");
        }
    };

    const handleReset = async() => {
        try{
            const {data} = await rest2FA;
            onRestSuccess(data);
        }
        catch(error){
            console.log("The err is : ", error.message);
            setError(error.message);
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
                <h2 className={styles.title}>Validate TOP</h2>
                <p className={styles.subtitle}>Please enter 6-digit Time base OTP to verify 2FA authentication</p>
        
                <div className={styles.qrSection}>
                    <div className={styles.qrWrap}>
                        <label>TOTP</label>
                    </div>
                    <div className={styles.manualEntry}>
                        <span className={styles.manualEntryLabel}>Or enter the code manually</span>
                        <div className={styles.secretRow}>
                            {error && <p className={styles.message}>{error}</p>}
                            <input
                                type="text"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className={styles.otpInput}
                                placeholder="Enter your TOTP"
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