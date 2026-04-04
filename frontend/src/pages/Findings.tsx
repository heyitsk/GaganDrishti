import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";
import { ChevronRight, ChevronDown, Filter } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import api from "@/lib/axios";

// --- Types ---
interface TimelineBucket {
  date: string;
  new: number;
  bySeverity: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
}

interface Finding {
  _id: string;
  scanId: string;
  provider: string;
  service: string;
  resource: string;
  resourceName: string;
  issue: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "open" | "resolved" | "ignored";
  detectedAt: string;
  recommendation?: string;
  details?: Record<string, any>;
}

export default function FindingsPage() {
  // State
  const [timeline, setTimeline] = useState<TimelineBucket[]>([]);
  const [totalInWindow, setTotalInWindow] = useState(0);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // URL Params for deep linking
  const [searchParams] = useSearchParams();
  const scanIdQuery = searchParams.get("scanId");

  // Filters state
  const [filters, setFilters] = useState({
    severity: "",
    service: "",
    status: "",
    scanId: scanIdQuery || "",
  });

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Prepare clean params (remove empty strings)
        const params: Record<string, string> = {};
        if (filters.severity) params.severity = filters.severity;
        if (filters.service) params.service = filters.service;
        if (filters.status) params.status = filters.status;
        if (filters.scanId) params.scanId = filters.scanId;

        const [timelineRes, findingsRes] = await Promise.all([
          api.get("/findings/timeline", { params }),
          api.get("/findings", { params }),
        ]);

        setTimeline(timelineRes.data.timeline || []);
        setTotalInWindow(timelineRes.data.totalInWindow || 0);
        setFindings(findingsRes.data.findings || []);
      } catch (err) {
        console.error("Failed to fetch findings data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  // Transform timeline data for recharts Stacked Bar Chart
  const chartData = timeline.map((bucket) => ({
    date: bucket.date,
    CRITICAL: bucket.bySeverity.CRITICAL,
    HIGH: bucket.bySeverity.HIGH,
    MEDIUM: bucket.bySeverity.MEDIUM,
    LOW: bucket.bySeverity.LOW,
  }));

  // Utility to get consistent colors
  const getSeverityStyles = (severity: string) => {
    switch (severity.toUpperCase()) {
      case "CRITICAL":
        return "bg-red-500/10 text-red-500";
      case "HIGH":
        return "bg-orange-500/10 text-orange-500";
      case "MEDIUM":
        return "bg-yellow-500/10 text-yellow-500";
      case "LOW":
        return "bg-green-500/10 text-green-500";
      default:
        return "bg-slate-500/10 text-slate-500";
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case "resolved":
        return "bg-green-500/10 text-green-400";
      case "ignored":
        return "bg-slate-500/20 text-slate-400";
      case "open":
      default:
        return "bg-orange-500/10 text-orange-400";
    }
  };

  return (
    <div className="min-h-full font-sans text-slate-200 p-8 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Findings</h1>
          {filters.scanId && (
            <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
              Filtered by Scan
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400">{findings.length} findings across your selection</p>
      </div>

      {/* Timeline Chart Container */}
      <div className="rounded-xl border border-slate-800 bg-[#131A2B] p-5">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-semibold text-slate-200">New Findings Timeline</h3>
          <span className="text-xs text-slate-400 font-medium bg-slate-800/50 px-2 py-1 rounded">
            Total in window: {totalInWindow}
          </span>
        </div>
        <div className="h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
              <XAxis 
                dataKey="date" 
                stroke="#64748B" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false} 
                tickFormatter={(val) => {
                  try {
                    return format(new Date(val), "MMM dd");
                  } catch (e) {
                    return val;
                  }
                }}
              />
              <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
              <RechartsTooltip 
                cursor={{ fill: "#1E293B", opacity: 0.4 }} 
                contentStyle={{ backgroundColor: "#0F1423", borderColor: "#1E293B", borderRadius: "8px", color: "#fff" }}
                itemStyle={{ color: "#fff", fontSize: "13px" }}
                labelStyle={{ color: "#94A3B8", marginBottom: "8px" }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", color: "#94A3B8" }} />
              <Bar dataKey="CRITICAL" stackId="a" fill="#EF4444" radius={[0, 0, 0, 0]} barSize={32} />
              <Bar dataKey="HIGH" stackId="a" fill="#F97316" radius={[0, 0, 0, 0]} barSize={32} />
              <Bar dataKey="MEDIUM" stackId="a" fill="#EAB308" radius={[0, 0, 0, 0]} barSize={32} />
              <Bar dataKey="LOW" stackId="a" fill="#22C55E" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="rounded-xl border border-slate-800 bg-[#131A2B] p-4 flex flex-col sm:flex-row items-start sm:items-center gap-6">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter className="h-5 w-5" />
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          {/* Severity Filter */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">Severity</label>
            <select
              name="severity"
              value={filters.severity}
              onChange={handleFilterChange}
              className="block w-full min-w-[140px] rounded-md border border-slate-700 bg-[#1E293B] px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Service Filter */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">Service</label>
            <select
              name="service"
              value={filters.service}
              onChange={handleFilterChange}
              className="block w-full min-w-[140px] rounded-md border border-slate-700 bg-[#1E293B] px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="S3">S3</option>
              <option value="EC2 Security Group">EC2 Security Group</option>
              <option value="IAM">IAM</option>
              <option value="RDS">RDS</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <label className="text-xs text-slate-500 font-medium">Status</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="block w-full min-w-[140px] rounded-md border border-slate-700 bg-[#1E293B] px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
              <option value="ignored">Ignored</option>
            </select>
          </div>
        </div>
      </div>

      {/* Findings List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading findings...</div>
        ) : findings.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm border border-slate-800 rounded-xl border-dashed">
            No findings match the selected filters.
          </div>
        ) : (
          findings.map((finding) => {
            const isExpanded = expandedIds.has(finding._id);
            return (
              <div key={finding._id} className="rounded-xl border border-slate-800 bg-[#131A2B] overflow-hidden transition-all duration-200">
                {/* Header Row (Clickable) */}
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-800/30"
                  onClick={() => toggleExpand(finding._id)}
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <button className="text-slate-500 hover:text-slate-300">
                      {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                    </button>
                    
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold ${getSeverityStyles(finding.severity)}`}>
                        {finding.severity}
                      </span>
                      <span className="inline-flex items-center rounded bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-400">
                        {finding.service}
                      </span>
                    </div>

                    <div className="flex flex-col ml-2 flex-1 min-w-0">
                      <span className="text-sm font-semibold text-slate-200 truncate">{finding.issue}</span>
                      <span className="text-xs text-slate-500 font-mono mt-0.5 truncate">{finding.resourceName || finding.resource}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 pl-4">
                    <span className={`inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold ${getStatusStyles(finding.status)}`}>
                      {finding.status.charAt(0).toUpperCase() + finding.status.slice(1)}
                    </span>
                    <span className="text-xs text-slate-500 w-20 text-right">
                      {formatDistanceToNow(new Date(finding.detectedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                {/* Expanded Details Pane */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-[#0F1423] p-5.5 px-6 pb-6 text-sm">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                      {/* Left Column: Parsed Details */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Finding Context</h4>
                        <div className="space-y-2">
                          {finding.details ? (
                            Object.entries(finding.details).map(([key, value]) => {
                              // If value is an object, format the keys briefly or stringify
                              let displayValue = "";
                              if (typeof value === "object" && value !== null) {
                                displayValue = Object.entries(value)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(", ");
                              } else {
                                displayValue = String(value);
                              }
                              return (
                                <div key={key} className="flex flex-col sm:flex-row sm:gap-2 border-b border-slate-800/50 pb-2 last:border-0 last:pb-0">
                                  <span className="text-slate-500 w-32 capitalize shrink-0">{key}</span>
                                  <span className="text-slate-200">{displayValue}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-slate-400">No context available</div>
                          )}
                        </div>
                      </div>

                      {/* Right Column: Recommendations */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Recommendation</h4>
                        <p className="text-slate-300 leading-relaxed max-w-prose">
                          {finding.recommendation || "No specific recommendation generated for this finding. Please review standard security practices for this service."}
                        </p>
                      </div>
                    </div>

                    {/* Raw JSON Snippet below parsed context */}
                    <div className="mt-4 pt-4 border-t border-slate-800/50">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">Raw Payload Detail</h4>
                      <div className="rounded-lg bg-[#131A2B] p-4 font-mono text-xs text-slate-400 overflow-x-auto border border-slate-800/80">
                        <pre>{JSON.stringify(finding.details || { id: finding._id, Provider: finding.provider }, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
