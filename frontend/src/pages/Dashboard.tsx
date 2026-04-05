import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Play, TriangleAlert, ShieldAlert, ShieldX, Scan } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import api from "@/lib/axios";
import { initSocket } from "@/lib/socket";

interface DashboardStats {
  totalScans: number;
  totalFindings: number;
  severityCounts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  serviceCounts: Record<string, number>;
  statusCounts: {
    open: number;
    resolved: number;
    ignored: number;
  };
  recentScans: Array<{
    _id: string;
    provider: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    totalFindings: number;
    criticalCount: number;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      const res = await api.get("/dashboard/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch dashboard stats", err);
    } finally {
      // Even on subsequent silent reloads, loading will simply remain false ensuring no flicker
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // ─── Socket.IO Live Updates ───────────────────────────────────────────────
    const socket = initSocket();
    
    const handleScanUpdate = (data: { jobId: string; state: string }) => {
      // Silently reload the entire dashboard stats organically without a toast
      if (data.state === "completed") {
        fetchStats();
      }
    };
    
    socket.on("scanUpdate", handleScanUpdate);
    
    return () => {
      socket.off("scanUpdate", handleScanUpdate);
    };
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p>Loading overview...</p>
        </div>
      </div>
    );
  }

  // --- Prep Chart Data ---
  const severityData = [
    { name: "Critical", value: stats.severityCounts.critical, fill: "#EF4444" },
    { name: "High", value: stats.severityCounts.high, fill: "#F97316" },
    { name: "Medium", value: stats.severityCounts.medium, fill: "#EAB308" },
    { name: "Low", value: stats.severityCounts.low, fill: "#22C55E" },
  ];

  const serviceColors = ["#EAB308", "#3B82F6", "#A855F7", "#22C55E", "#F43F5E"];
  const serviceData = Object.entries(stats.serviceCounts).map(([name, value], i) => ({
    name,
    value,
    fill: serviceColors[i % serviceColors.length],
  }));

  // --- Prep Progress Bar Data ---
  const totalStatus =
    stats.statusCounts.open + stats.statusCounts.resolved + stats.statusCounts.ignored || 1; // avoid division by zero
  const openPct = (stats.statusCounts.open / totalStatus) * 100;
  const resolvedPct = (stats.statusCounts.resolved / totalStatus) * 100;
  const ignoredPct = (stats.statusCounts.ignored / totalStatus) * 100;

  return (
    <div className="min-h-full font-sans text-slate-200 p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Dashboard</h1>
          <p className="text-sm text-slate-400">Cloud security posture overview</p>
        </div>
        <button className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors">
          <Play className="h-4 w-4" />
          Run Full Scan
        </button>
      </div>

      {/* Overview Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="rounded-xl border border-slate-800 bg-[#131A2B] p-5">
          <div className="mb-2">
            <TriangleAlert className="h-5 w-5 text-slate-400" />
          </div>
          <div className="text-3xl font-bold text-white mb-1">{stats.totalFindings}</div>
          <div className="text-xs text-slate-500 font-medium">Total Findings</div>
        </div>
        {/* Card 2 */}
        <div className="rounded-xl border border-slate-800 bg-[#131A2B] p-5">
          <div className="mb-2">
            <ShieldX className="h-5 w-5 text-red-500" />
          </div>
          <div className="text-3xl font-bold text-blue-500 mb-1">{stats.severityCounts.critical}</div>
          <div className="text-xs text-slate-500 font-medium">Critical Issues</div>
        </div>
        {/* Card 3 */}
        <div className="rounded-xl border border-slate-800 bg-[#131A2B] p-5">
          <div className="mb-2">
            <ShieldAlert className="h-5 w-5 text-orange-400" />
          </div>
          <div className="text-3xl font-bold text-orange-400 mb-1">{stats.statusCounts.open}</div>
          <div className="text-xs text-slate-500 font-medium">Open Issues</div>
        </div>
        {/* Card 4 */}
        <div className="rounded-xl border border-slate-800 bg-[#131A2B] p-5">
          <div className="mb-2">
            <Scan className="h-5 w-5 text-blue-400" />
          </div>
          <div className="text-3xl font-bold text-blue-400 mb-1">{stats.totalScans}</div>
          <div className="text-xs text-slate-500 font-medium">Total Scans</div>
        </div>
      </div>

      {/* Chart Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[320px]">
        {/* Bar Chart */}
        <div className="rounded-xl border border-slate-800 bg-[#131A2B] p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-6">Findings by Severity</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1E293B" />
                <XAxis type="number" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} width={80} />
                <RechartsTooltip 
                  cursor={{ fill: "#1E293B", opacity: 0.4 }} 
                  contentStyle={{ backgroundColor: "#0F1423", borderColor: "#1E293B", borderRadius: "8px", color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Donut Chart */}
        <div className="rounded-xl border border-slate-800 bg-[#131A2B] p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-200 mb-2">Findings by Service</h3>
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center">
            <div className="h-[200px] w-full">
              {serviceData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={serviceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {serviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: "#0F1423", borderColor: "#1E293B", borderRadius: "8px", color: "#fff" }}
                      itemStyle={{ color: "#fff" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">No finding data</div>
              )}
            </div>
            
            {/* Custom Legend */}
            {serviceData.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
                {serviceData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-slate-400">
                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                    {entry.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Bar Row */}
      <div className="rounded-xl border border-slate-800 bg-[#131A2B] p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Finding Status Distribution</h3>
        
        {/* Progress tracks */}
        <div className="h-3 w-full rounded-full bg-[#1E293B] overflow-hidden flex mb-4">
          <div className="h-full bg-orange-500" style={{ width: `${openPct}%` }} />
          <div className="h-full bg-green-500 border-l border-[#131A2B]" style={{ width: `${resolvedPct}%` }} />
          <div className="h-full bg-slate-600 border-l border-[#131A2B]" style={{ width: `${ignoredPct}%` }} />
        </div>

        {/* Labels under progress bar */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="h-2 w-2 rounded-full bg-orange-500" />
            Open ({stats.statusCounts.open})
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Resolved ({stats.statusCounts.resolved})
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="h-2 w-2 rounded-full bg-slate-600" />
            Ignored ({stats.statusCounts.ignored})
          </div>
        </div>
      </div>

      {/* Table Row */}
      <div className="rounded-xl border border-slate-800 bg-[#131A2B] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200">Recent Scans</h3>
          <button className="text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors">
            View all &rarr;
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-[#131A2B] text-xs font-semibold uppercase text-slate-500 border-b border-slate-800">
              <tr>
                <th className="px-5 py-4 w-[20%]">Account</th>
                <th className="px-5 py-4 w-[15%]">Provider</th>
                <th className="px-5 py-4 w-[15%]">Status</th>
                <th className="px-5 py-4 w-[15%]">Started</th>
                <th className="px-5 py-4 w-[15%]">Duration</th>
                <th className="px-5 py-4 w-[10%]">Findings</th>
                <th className="px-5 py-4 w-[10%]">Critical</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {stats.recentScans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No recent scans found.
                  </td>
                </tr>
              ) : (
                stats.recentScans.map((scan) => {
                  let durationStr = "—";
                  if (scan.startedAt && scan.completedAt) {
                    const diffMs = new Date(scan.completedAt).getTime() - new Date(scan.startedAt).getTime();
                    const seconds = Math.floor(diffMs / 1000);
                    durationStr = `${seconds}s`;
                  }

                  const StatusBadge = () => {
                    const status = (scan.status || "completed").toLowerCase();
                    if (status === "failed") {
                      return <span className="inline-flex rounded-md bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-400">Failed</span>;
                    }
                    if (status === "completed") {
                      return <span className="inline-flex rounded-md bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-400">Completed</span>;
                    }
                    return <span className="inline-flex rounded-md bg-slate-500/10 px-2 py-1 text-[10px] font-semibold text-slate-400">{status}</span>;
                  };

                  return (
                    <tr key={scan._id} className="hover:bg-slate-800/20 transition-colors">
                      <td className="px-5 py-4 font-medium text-slate-200">Production AWS</td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded bg-orange-500/10 px-2 py-1 text-[10px] font-bold text-orange-400">
                          AWS
                        </span>
                      </td>
                      <td className="px-5 py-4"><StatusBadge /></td>
                      <td className="px-5 py-4">
                        {scan.startedAt ? formatDistanceToNow(new Date(scan.startedAt), { addSuffix: true }) : "—"}
                      </td>
                      <td className="px-5 py-4">{durationStr}</td>
                      <td className="px-5 py-4 font-medium text-slate-200">{scan.totalFindings || "—"}</td>
                      <td className="px-5 py-4 font-medium text-red-500">
                        {scan.criticalCount > 0 ? scan.criticalCount : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
