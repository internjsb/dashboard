import { Suspense, lazy, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { defaultPageFor } from "./lib/pageAccess";

const Login = lazy(() => import("./views/Login"));
const Register = lazy(() => import("./views/Register"));
const Pending = lazy(() => import("./views/Pending"));
const Dashboard = lazy(() => import("./views/Dashboard"));
const SalesHistory = lazy(() => import("./views/SalesHistory"));
const StockAvailable = lazy(() => import("./views/StockAvailable"));
const Finance = lazy(() => import("./views/Finance"));
const Profile = lazy(() => import("./views/Profile"));
const AdminPanel = lazy(() => import("./views/AdminPanel"));
const AuditLog = lazy(() => import("./views/AuditLog"));
const Forbidden = lazy(() => import("./views/Forbidden"));
const NotFound = lazy(() => import("./views/NotFound"));

// "/" has no page of its own — send the signed-in user to the first business
// page their role/department actually lets them see (Profile if none).
function HomeRedirect() {
  const { user, department, status, isSuperAdmin, waitUntilReady } = useAuth();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    waitUntilReady().then(() => {
      if (mounted) setChecked(true);
    });
    return () => {
      mounted = false;
    };
  }, [waitUntilReady]);

  if (!checked) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (status === "pending") return <Navigate to="/pending" replace />;
  if (status === "denied") return <Navigate to="/forbidden" replace />;
  return <Navigate to={defaultPageFor(isSuperAdmin, department)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/pending"
              element={
                <ProtectedRoute>
                  <Pending />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute page="dashboard">
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales-history"
              element={
                <ProtectedRoute page="sales_history">
                  <SalesHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock-available"
              element={
                <ProtectedRoute page="stock_available">
                  <StockAvailable />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finance"
              element={
                <ProtectedRoute page="finance">
                  <Finance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute role="admin">
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/audit"
              element={
                <ProtectedRoute role="admin">
                  <AuditLog />
                </ProtectedRoute>
              }
            />
            <Route path="/forbidden" element={<Forbidden />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
