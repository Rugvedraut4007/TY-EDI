import { BrowserRouter, Routes, Route } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import UserDashboard from "./pages/UserDashboard";
import PharmacistDashboard from "./pages/PharmacistDashboard";
import ManufacturerDashboard from "./pages/ManufacturerDashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Register />} />
        <Route path="/register" element={<Register />} />
        <Route path="/user-dashboard" element={<UserDashboard />} />
        <Route path="/pharmacist-dashboard" element={<PharmacistDashboard />}/>
        <Route path="/manufacturer-dashboard" element={<ManufacturerDashboard />}/>
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;