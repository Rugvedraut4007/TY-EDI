import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth, ROLE_HOME } from "./context/AuthContext";
import { LoadingBlock } from "./components/UI";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyMedicine from "./pages/VerifyMedicine";
import VerifyBill from "./pages/VerifyBill";
import NotFound from "./pages/NotFound";

import AdminDashboard from "./pages/admin/AdminDashboard";
import ManufacturerDashboard from "./pages/manufacturer/ManufacturerDashboard";
import DistributorDashboard from "./pages/distributor/DistributorDashboard";
import PharmacistDashboard from "./pages/pharmacist/PharmacistDashboard";
import CustomerDashboard from "./pages/customer/CustomerDashboard";

function ProtectedRoute({ role, children }) {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50">
        <LoadingBlock label="Restoring your session..." />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={ROLE_HOME[user.role] || "/"} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify" element={<VerifyMedicine />} />
        <Route path="/verify-bill" element={<VerifyBill />} />

        <Route path="/admin-dashboard" element={<ProtectedRoute role="admin"><AdminDashboard /></ProtectedRoute>} />
        <Route
          path="/manufacturer-dashboard"
          element={<ProtectedRoute role="manufacturer"><ManufacturerDashboard /></ProtectedRoute>}
        />
        <Route
          path="/distributor-dashboard"
          element={<ProtectedRoute role="distributor"><DistributorDashboard /></ProtectedRoute>}
        />
        <Route
          path="/pharmacist-dashboard"
          element={<ProtectedRoute role="pharmacist"><PharmacistDashboard /></ProtectedRoute>}
        />
        <Route
          path="/customer-dashboard"
          element={<ProtectedRoute role="customer"><CustomerDashboard /></ProtectedRoute>}
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
