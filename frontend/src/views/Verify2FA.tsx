import React from "react"
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import TwoFAVerification from "../components/TwoFAVerification";

const Verify2FA = () => {
    const navigate = useNavigate();
    const { markTwoFactorVerified } = useAuth();

    const handleVerifySuccess = () => {
        markTwoFactorVerified();
        navigate("/");
    };

    const handleResetSuccess = () => {
        navigate("/setup-2fa");
    };

    return <TwoFAVerification onVerifySuccess={handleVerifySuccess} onRestSuccess={handleResetSuccess} />;
}

export default Verify2FA;
