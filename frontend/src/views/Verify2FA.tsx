import React from "react"
import { useNavigate } from "react-router-dom";
import TwoFAVerification from "../components/TwoFAVerification";

const Verify2FA = () => {
    const navigate = useNavigate();

    const handleVerifySuccess = () => {
        navigate("/");
    };

    const handleResetSuccess = () => {
        navigate("/setup-2fa");
    };

    return <TwoFAVerification onVerifySuccess={handleVerifySuccess} onRestSuccess={handleResetSuccess} />;
}

export default Verify2FA;
