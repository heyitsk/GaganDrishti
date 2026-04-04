import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Cloud,
  History,
  ShieldAlert,
  Settings,
  LogOut,
  Shield,
} from "lucide-react";

export function Sidebar() {
  const navigate = useNavigate();
  const username = localStorage.getItem("gagandrishti_user") || "User";

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Accounts", href: "/accounts", icon: Cloud },
    { name: "Scan History", href: "/scans", icon: History },
    { name: "Findings", href: "/findings", icon: ShieldAlert },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const handleLogout = () => {
    localStorage.removeItem("gagandrishti_token");
    localStorage.removeItem("gagandrishti_user");
    navigate("/login");
  };

  return (
    <div className="flex h-screen w-64 flex-col border-r border-[#1e293b] bg-[#0f1423] text-slate-300 font-sans">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-2 border-b border-[#1e293b] px-6">
        <Shield className="h-6 w-6 text-blue-500" />
        <span className="text-xl font-bold tracking-tight text-white font-heading">
          GaganDrishti
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1.5 p-4">
        {navItems.map((item) => {
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[#1e293b] text-blue-400"
                    : "text-slate-400 hover:bg-[#1e293b]/50 hover:text-slate-200"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info & Logout Wrapper */}
      <div className="border-t border-[#1e293b] p-4">
        <div className="flex items-center gap-3">
          {/* Avatar Placeholder */}
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/20 text-xs font-semibold text-blue-400 uppercase">
            {username.slice(0, 2)}
          </div>
          
          <div className="flex flex-1 flex-col truncate">
            <span className="truncate text-sm font-medium text-slate-200">
              {username}
            </span>
            <span className="text-xs text-slate-500">Engineer</span>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-md p-2 text-slate-400 hover:bg-[#1e293b] hover:text-slate-200 transition-colors"
            title="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
