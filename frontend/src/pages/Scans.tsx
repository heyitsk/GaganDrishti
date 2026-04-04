import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, ChevronDown, Activity, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/axios";

interface Scan {
  _id: string;
  provider: string;
  status: "failed" | "completed" | "running";
  startedAt: string;
  completedAt?: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  credentialId?: string;
}

interface Finding {
  _id: string;
  issue: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  service: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ScansPage() {
  const navigate = useNavigate();
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  
  // Track which scan's accordion is open
  const [expandedId, setExpandedId] = useState<string | null>(null);
  
  // Cache for fetched findings: Record<scanId, Finding[]>
  const [scanFindingsCache, setScanFindingsCache] = useState<Record<string, Finding[]>>({});
  const [findingsLoading, setFindingsLoading] = useState<Record<string, boolean>>({});

  const fetchScans = async (pageUrl: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/scans?page=${pageUrl}&limit=10`);
      if (res.data.scans) {
        setScans(res.data.scans);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch scans", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScans(1);
  }, []);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    fetchScans(newPage);
  };

  const toggleExpand = async (scanId: string) => {
    if (expandedId === scanId) {
      setExpandedId(null);
      return;
    }
    
    setExpandedId(scanId);

    // Fetch findings only if not natively cached
    if (!scanFindingsCache[scanId]) {
      setFindingsLoading(prev => ({ ...prev, [scanId]: true }));
      try {
        const res = await api.get(`/scans/${scanId}/findings`);
        setScanFindingsCache(prev => ({
          ...prev,
          [scanId]: res.data.findings || []
        }));
      } catch (err) {
        console.error("Failed to fetch findings for this scan", err);
      } finally {
        setFindingsLoading(prev => ({ ...prev, [scanId]: false }));
      }
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "bg-green-500/10 text-green-500";
      case "failed":
        return "bg-red-500/10 text-red-500";
      case "running":
        return "bg-blue-500/10 text-blue-500";
      default:
        return "bg-slate-500/10 text-slate-400";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch(severity) {
      case "CRITICAL": return "text-red-500 bg-red-500/10";
      case "HIGH": return "text-orange-500 bg-orange-500/10";
      case "MEDIUM": return "text-yellow-500 bg-yellow-500/10";
      case "LOW": return "text-green-500 bg-green-500/10";
      default: return "text-slate-400 bg-slate-500/10";
    }
  };

  return (
    <div className="min-h-full font-sans text-slate-200 p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Scan History</h1>
        <p className="text-sm text-slate-400">View all security scans across your accounts</p>
      </div>

      <div className="rounded-xl border border-[#1E293B] bg-[#0B0F19] overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center p-4 border-b border-[#1E293B] text-xs font-semibold text-slate-500 uppercase tracking-wider pl-8">
          <div className="w-[20%]">Account</div>
          <div className="w-[10%]">Provider</div>
          <div className="w-[15%] pl-2">Status</div>
          <div className="w-[15%]">Started</div>
          <div className="w-[10%] text-right">Duration</div>
          <div className="w-[10%] text-center font-bold">Findings</div>
          <div className="w-[10%] text-center text-red-500 font-bold">Critical</div>
          <div className="w-[10%] text-center text-orange-500 font-bold">High</div>
        </div>

        {/* List of Scans */}
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading scans...</div>
        ) : scans.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No scans found.</div>
        ) : (
          scans.map((scan) => {
            const isExpanded = expandedId === scan._id;
            const durationSecs = scan.completedAt && scan.startedAt 
              ? Math.floor((new Date(scan.completedAt).getTime() - new Date(scan.startedAt).getTime()) / 1000)
              : null;
            
            // Hardcoding "Production AWS" for now, ideally it comes from scan.credential.alias
            const accountLabel = scan.provider === "AWS" ? "Production AWS" : "Unknown Account";

            return (
              <div key={scan._id} className="border-b border-[#1E293B] last:border-b-0 hover:bg-[#131A2B] transition-colors">
                <div 
                  className="flex items-center p-4 text-sm cursor-pointer"
                  onClick={() => toggleExpand(scan._id)}
                >
                  <div className="w-[20%] flex items-center gap-3 font-medium text-slate-200">
                    <button className="text-slate-500 hover:text-slate-300 w-5 shrink-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <span className="truncate">{accountLabel}</span>
                  </div>
                  
                  <div className="w-[10%]">
                    <span className="inline-flex items-center gap-1.5 rounded bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-500">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M11.996 0L0 7v10l11.996 7L24 17V7l-12.004-7zm-4.34 16.74l3.197-3.198 3.195 3.196L16.2 14.59l-3.197-3.197L16.2 8.196l-2.152-2.152-3.195 3.197-3.197-3.197L5.503 8.196l3.197 3.197L5.503 14.59l2.153 2.15z"/></svg>
                      {scan.provider}
                    </span>
                  </div>

                  <div className="w-[15%] pl-2 flex shrink-0 truncate">
                    <span className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold ${getStatusStyles(scan.status)}`}>
                      {scan.status === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>}
                      {scan.status.charAt(0).toUpperCase() + scan.status.slice(1)}
                    </span>
                  </div>

                  <div className="w-[15%] text-slate-400 text-sm truncate">
                    {formatDistanceToNow(new Date(scan.startedAt), { addSuffix: true })}
                  </div>

                  <div className="w-[10%] text-slate-400 font-mono text-xs text-right">
                    {durationSecs !== null ? `${durationSecs}s` : "—"}
                  </div>

                  <div className="w-[10%] text-center font-medium text-slate-300">
                    {scan.totalFindings > 0 ? scan.totalFindings : "—"}
                  </div>

                  <div className="w-[10%] text-center font-bold text-red-500">
                    {scan.criticalCount > 0 ? scan.criticalCount : "—"}
                  </div>

                  <div className="w-[10%] text-center font-bold text-orange-500">
                    {scan.highCount > 0 ? scan.highCount : "—"}
                  </div>
                </div>

                {/* Sub-Accordion for findings preview */}
                {isExpanded && (
                  <div className="bg-[#0B0F19] border-t border-[#1E293B] p-6 shadow-inner">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Critical & High Findings Preview
                      </h4>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/findings?scanId=${scan._id}`);
                        }}
                        className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md transition-colors"
                      >
                        View All Findings
                      </button>
                    </div>

                    {findingsLoading[scan._id] ? (
                      <div className="text-xs text-slate-500 py-4 px-4 bg-[#131A2B] rounded-lg border border-[#1E293B]">Scanning report context...</div>
                    ) : (
                      <div className="bg-[#131A2B] rounded-lg border border-[#1E293B] overflow-hidden">
                        {scanFindingsCache[scan._id] && scanFindingsCache[scan._id].length > 0 ? (
                          <div className="flex flex-col">
                            {scanFindingsCache[scan._id].slice(0, 3).map((f) => (
                              <div key={f._id} className="grid grid-cols-12 gap-4 border-b border-[#1E293B] p-3 text-xs last:border-0 hover:bg-slate-800/30">
                                <div className="col-span-2">
                                  <span className={`inline-flex rounded px-1.5 py-0.5 font-bold ${getSeverityColor(f.severity)}`}>
                                    {f.severity}
                                  </span>
                                </div>
                                <div className="col-span-2 font-mono text-slate-400">{f.service}</div>
                                <div className="col-span-8 text-slate-300 truncate">{f.issue}</div>
                              </div>
                            ))}
                            {scanFindingsCache[scan._id].length > 3 && (
                              <div className="text-xs text-slate-500 text-center py-2 bg-slate-900/50">
                                + {scanFindingsCache[scan._id].length - 3} more findings. Click "View All Findings" to explore.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-4 text-xs text-green-400 font-medium">✨ No actionable findings detected in this scan!</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

      </div>
      
      {/* Pagination Footer */}
      {!loading && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800/60 pt-4">
          <div className="text-sm text-slate-400 font-medium">
            Showing <span className="text-white">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="text-white">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="text-white">{pagination.total}</span> scans
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="inline-flex items-center px-3 py-1.5 rounded bg-[#131A2B] border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </button>
            <span className="text-sm font-medium bg-[#131A2B] border border-slate-700 px-3 py-1.5 rounded text-white">
              {pagination.page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="inline-flex items-center px-3 py-1.5 rounded bg-[#131A2B] border border-slate-700 text-slate-300 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRightIcon className="h-4 w-4 ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
