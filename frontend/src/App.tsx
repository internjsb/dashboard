import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

const Login = lazy(() => import("./views/Login"));
const Register = lazy(() => import("./views/Register"));
const Pending = lazy(() => import("./views/Pending"));
const Dashboard = lazy(() => import("./views/Dashboard"));
const SalesHistory = lazy(() => import("./views/SalesHistory"));
const Profile = lazy(() => import("./views/Profile"));
const AdminPanel = lazy(() => import("./views/AdminPanel"));
const AuditLog = lazy(() => import("./views/AuditLog"));
const Forbidden = lazy(() => import("./views/Forbidden"));
const NotFound = lazy(() => import("./views/NotFound"));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales-history"
              element={
                <ProtectedRoute>
                  <SalesHistory />
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
