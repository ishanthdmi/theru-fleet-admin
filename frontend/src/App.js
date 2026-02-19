import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import DevicesPage from "@/pages/DevicesPage";
import DriversPage from "@/pages/DriversPage";
import CampaignsPage from "@/pages/CampaignsPage";
import ClientsPage from "@/pages/ClientsPage";
import AnalyticsPage from "@/pages/AnalyticsPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/devices"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <DevicesPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/drivers"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <DriversPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/campaigns"
            element={
              <ProtectedRoute>
                <CampaignsPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/clients"
            element={
              <ProtectedRoute requiredRoles={["admin"]}>
                <ClientsPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          
          <Route
            path="/unauthorized"
            element={
              <div className="min-h-screen bg-slate-950 flex items-center justify-center" data-testid="unauthorized-page">
                <div className="text-center">
                  <h1 className="text-4xl font-black text-slate-100 mb-4" style={{ fontFamily: 'Chivo, sans-serif' }}>
                    Unauthorized
                  </h1>
                  <p className="text-slate-400">You don't have permission to access this page.</p>
                </div>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
