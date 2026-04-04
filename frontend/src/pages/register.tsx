import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Shield, User, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || !confirmPassword.trim()) {
      toast.error("Please enter all fields");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    
    try {
      await api.post("/auth/register", { username, password });

      toast.success("Account created successfully");
      navigate("/login");
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || "An error occurred");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] p-4 font-sans text-slate-200">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 mb-6">
            <Shield className="h-8 w-8 text-blue-500" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-2">Create your account</h1>
          <p className="text-sm text-slate-400">Start securing your cloud infrastructure</p>
        </div>

        <form onSubmit={handleRegister} className="rounded-xl border border-slate-800 bg-[#131A2B] p-6 space-y-5 shadow-xl">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Username</label>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full rounded-lg border border-slate-800 bg-[#1E293B] px-10 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Choose a unique username</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Password</label>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-800 bg-[#1E293B] px-10 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Minimum 6 characters</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Confirm Password</label>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-800 bg-[#1E293B] px-10 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Must match password above</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors">
            Create Account
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <p className="text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-[#3B82F6] hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
