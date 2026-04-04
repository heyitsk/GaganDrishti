import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import RegisterPage from "@/pages/register";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/Dashboard";
import FindingsPage from "@/pages/Findings";
import ScansPage from "@/pages/Scans";
import { DashboardLayout } from "@/components/layout/DashboardLayout";


function App() {
  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <Toaster theme="dark" position="top-right" />
        <Routes>
          {/* Public Routes */}
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Routes directly to Dashboard Layout */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/accounts" element={<div className="p-8 text-white">Accounts Page (Coming Soon)</div>} />
            <Route path="/scans" element={<ScansPage />} />
            <Route path="/findings" element={<FindingsPage />} />
            <Route path="/settings" element={<div className="p-8 text-white">Settings (Coming Soon)</div>} />
          </Route>
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
