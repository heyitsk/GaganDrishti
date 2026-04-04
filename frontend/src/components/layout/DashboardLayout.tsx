import { Outlet, Navigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function DashboardLayout() {
  const token = localStorage.getItem("gagandrishti_token");

  // Protect the dashboard routes
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen w-full bg-[#0B0F19]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
