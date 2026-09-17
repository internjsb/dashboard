import React from "react"
import { useNavigate } from "react-router-dom";
import TwoFASetup from "../components/TwoFASetup";

const Setup2FA = () => {
    const navigate = useNavigate();
    const handleSetupComplete = () => {
        navigate("/verify-2fa");
    };
    return <TwoFASetup onSetupComplete={handleSetupComplete}/>
}

export default Setup2FA;