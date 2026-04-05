import { useState, useEffect } from "react";
import { PlayCircle, CheckCircle2, AlertCircle, RefreshCw, Activity, Layers, Clock, ArrowRight } from "lucide-react";
import api from "@/lib/axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { initSocket } from "@/lib/socket";

interface ScanJob {
  jobId: string;
  scanType: "full" | "single";
  scannerName?: string;
  accountName: string;
  state: string;
  result?: any;
  error?: string;
  timestamp: number;
}

export default function RunScanPage() {
  const navigate = useNavigate();
  // Form State
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [scanType, setScanType] = useState<"full" | "single">("full");
  const [scannerName, setScannerName] = useState<string>("s3PublicAccess");
  const [s3BucketName, setS3BucketName] = useState<string>("");
  const [rdsInstanceId, setRdsInstanceId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Tracked Jobs List
  const [jobs, setJobs] = useState<ScanJob[]>([]);

  // Fetch Accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await api.get("/credentials");
        setAccounts(res.data.credentials || []);
        if (res.data.credentials && res.data.credentials.length > 0) {
          setSelectedAccountId(res.data.credentials[0]._id);
        }
      } catch (error) {
        toast.error("Failed to load AWS accounts");
      }
    };
    fetchAccounts();
  }, []);

  // Initialize WebSockets
  useEffect(() => {
    const socket = initSocket();

    const handleScanUpdate = (data: { jobId: string; state: string; result?: any; error?: string }) => {
      setJobs(prevJobs => prevJobs.map(job => 
        job.jobId === data.jobId 
          ? { ...job, state: data.state, result: data.result, error: data.error }
          : job
      ));

      if (data.state === "completed") {
        toast.success(`Job completed successfully!`);
      } else if (data.state === "failed") {
        toast.error(`Job failed: ${data.error}`);
      }
    };

    socket.on("scanUpdate", handleScanUpdate);

    return () => {
      socket.off("scanUpdate", handleScanUpdate);
    };
  }, []);

  const handleStartScan = async () => {
    if (!selectedAccountId) {
      toast.error("Please select an AWS account");
      return;
    }
    
    const targetAccount = accounts.find(a => a._id === selectedAccountId);

    setIsSubmitting(true);
    try {
      let endpoint = "/aws/scan/queue/single";
      let payload: any = {
        credentialId: selectedAccountId,
        scannerName,
        params: {
          ...(s3BucketName ? { bucketName: s3BucketName } : {}),
          ...(rdsInstanceId ? { instanceId: rdsInstanceId } : {})
        }
      };

      if (scanType === "full") {
        endpoint = "/aws/scan/queue/all";
        payload = {
          credentialId: selectedAccountId,
          options: {
            ...(s3BucketName ? { s3BucketName } : {}),
             ...(rdsInstanceId ? { rdsInstanceId } : {}),
          }
        };
      }

      const res = await api.post(endpoint, payload);
      
      // Inject the newly generated Job into our local state tracker instantly
      const newJob: ScanJob = {
        jobId: res.data.jobId,
        scanType,
        scannerName: scanType === "single" ? scannerName : "All Services",
        accountName: targetAccount?.accountName || "Unknown Account",
        state: res.data.status, // Should be "queued"
        timestamp: Date.now()
      };

      setJobs((prev) => [newJob, ...prev]);
      toast.success("Scan successfully enqueued");
      
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to enqueue scan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-full font-sans text-slate-200 p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">CyberGuard Orchestrator</h1>
        <p className="text-sm text-slate-400">Launch concurrent security audits asynchronously via BullMQ & WebSockets</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative">
        
        {/* Left Panel: Configuration Form */}
        <div className="lg:col-span-5 rounded-xl border border-[#1E293B] bg-[#0B0F19] p-6 shadow-xl relative overflow-hidden top-0 sticky">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>

          <h3 className="text-lg font-semibold text-white mb-6">Launch New Scan</h3>
          
          <div className="space-y-6 relative z-10">
            {/* Account Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">AWS Account Environment</label>
              <select 
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-slate-700 bg-[#131A2B] px-4 py-2.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="" disabled>Select a validated account...</option>
                {accounts.map(acc => (
                  <option key={acc._id} value={acc._id}>{acc.accountName} ({acc.provider})</option>
                ))}
              </select>
            </div>

            {/* Scan Type Toggle */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-300">Execution Mode</label>
              <div className="flex gap-4">
                <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${scanType === 'full' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-[#131A2B] border-slate-700 text-slate-400 hover:border-slate-600'} ${isSubmitting && 'opacity-50 cursor-not-allowed'}`}>
                  <input type="radio" className="hidden" disabled={isSubmitting} checked={scanType === "full"} onChange={() => setScanType("full")} />
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${scanType === 'full' ? 'border-blue-500' : 'border-slate-600'}`}>
                    {scanType === 'full' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                  </div>
                  <span className="font-medium text-sm">Full Scan</span>
                </label>
                
                <label className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${scanType === 'single' ? 'bg-blue-500/10 border-blue-500/50 text-blue-400' : 'bg-[#131A2B] border-slate-700 text-slate-400 hover:border-slate-600'} ${isSubmitting && 'opacity-50 cursor-not-allowed'}`}>
                  <input type="radio" className="hidden" disabled={isSubmitting} checked={scanType === "single"} onChange={() => setScanType("single")} />
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${scanType === 'single' ? 'border-blue-500' : 'border-slate-600'}`}>
                    {scanType === 'single' && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                  </div>
                  <span className="font-medium text-sm">Targeted</span>
                </label>
              </div>
            </div>

            {/* Target Scanner */}
            {scanType === "single" && (
              <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                <label className="text-sm font-medium text-slate-300">Specific Target Service</label>
                <select 
                  value={scannerName}
                  onChange={(e) => setScannerName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-lg border border-slate-700 bg-[#131A2B] px-4 py-2.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                >
                  <option value="s3PublicAccess">S3 Public Storage Block</option>
                  <option value="s3Encryption">S3 Default Encryption Audit</option>
                  <option value="ec2">EC2 Network Security Groups</option>
                  <option value="iam">IAM Best Practices Review</option>
                  <option value="rds">RDS Infrastructure Audit</option>
                </select>
              </div>
            )}

            {/* Optional Input Overrides */}
            <div className="space-y-4 pt-4 border-t border-slate-800">
              <label className="text-sm font-medium text-slate-300 text-slate-500 flex items-center gap-2">
                 Identifier Overrides
              </label>
              {(scanType === "full" || scannerName.startsWith("s3")) && (
                <div className="animate-in fade-in">
                  <input type="text" placeholder="Isolated S3 Bucket Name (Optional)" value={s3BucketName} onChange={(e) => setS3BucketName(e.target.value)} disabled={isSubmitting} className="w-full rounded-lg border border-slate-700 bg-[#131A2B] px-4 py-2.5 text-sm text-slate-200 focus:border-blue-500 placeholder-slate-600"/>
                </div>
              )}

              {(scanType === "full" || scannerName === "rds") && (
                <div className="animate-in fade-in">
                  <input type="text" placeholder="Isolated RDS Instance ID (Optional)" value={rdsInstanceId} onChange={(e) => setRdsInstanceId(e.target.value)} disabled={isSubmitting} className="w-full rounded-lg border border-slate-700 bg-[#131A2B] px-4 py-2.5 text-sm text-slate-200 focus:border-blue-500 placeholder-slate-600"/>
                </div>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={handleStartScan}
              disabled={isSubmitting || accounts.length === 0}
              className="mt-6 w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-blue-500 hover:shadow-[0_0_20px_1px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <PlayCircle className="h-5 w-5" /> Push to Scan Queue
            </button>
          </div>
        </div>

        {/* Right Panel: Concurrent Scan Tracker */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
             <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Layers className="text-purple-400 h-5 w-5" /> Active Job Queue
             </h3>
             <span className="text-xs font-semibold px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
               {jobs.filter(j => ['queued', 'active', 'waiting'].includes(j.state)).length} running natively
             </span>
          </div>

          {jobs.length === 0 && (
             <div className="rounded-xl border border-dashed border-slate-700 bg-slate-800/10 h-64 flex flex-col items-center justify-center text-slate-500">
               <Activity className="h-10 w-10 mb-3 opacity-30"/>
               <p className="text-sm font-medium">No concurrent jobs active.</p>
               <p className="text-xs">Jobs added to the queue will appear here via Socket.io.</p>
             </div>
          )}

          {/* Job Cards */}
          <div className="space-y-4">
            {jobs.map(job => (
              <div 
                key={job.jobId} 
                className={`animate-in slide-in-from-bottom-3 duration-300 w-full rounded-xl border bg-gradient-to-r p-5 relative overflow-hidden
                   ${job.state === 'completed' ? 'border-green-500/30 from-[#131A2B] to-[#131A2B]/40' : 
                     job.state === 'failed' ? 'border-red-500/30 from-red-950/20 to-[#131A2B]/40' : 
                     job.state === 'active' ? 'border-blue-500/40 from-blue-900/10 to-[#131A2B]' :
                     'border-yellow-500/30 from-yellow-900/10 to-[#131A2B]'
                   }
                `}
              >
                {/* Visual Status Indicator Glow */}
                {job.state === 'active' && <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>}
                {job.state === 'completed' && <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl pointer-events-none"></div>}
                {job.state === 'queued' && <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>}
                
                <div className="flex justify-between items-start relative z-10">
                   <div className="space-y-1">
                      <h4 className="text-md font-bold text-slate-200 capitalize">
                        {job.scanType === 'full' ? 'Full Environment Scan' : `${job.scannerName} Scan`}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono flex items-center gap-2">
                        {job.accountName} <span className="text-slate-600">•</span> ID: {job.jobId.slice(0, 8)}
                      </p>
                   </div>
                   
                   <div className="flex flex-col items-end gap-2">
                     {job.state === 'completed' && (
                        <div className="flex bg-green-500/20 border border-green-500/30 text-green-400 px-3 py-1 rounded text-xs font-bold items-center gap-1.5 shadow-[0_0_15px_1px_rgba(34,197,94,0.1)]">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                        </div>
                     )}
                     {job.state === 'failed' && (
                        <div className="flex bg-red-500/20 border border-red-500/30 text-red-400 px-3 py-1 rounded text-xs font-bold items-center gap-1.5 shadow-[0_0_15px_1px_rgba(239,68,68,0.1)]">
                          <AlertCircle className="h-3.5 w-3.5" /> Failed
                        </div>
                     )}
                     {job.state === 'active' && (
                        <div className="flex bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-1 rounded text-xs font-bold items-center gap-1.5">
                          <Activity className="h-3.5 w-3.5 animate-pulse" /> Active
                        </div>
                     )}
                     {(job.state === 'queued' || job.state === 'waiting' || job.state === 'delayed') && (
                        <div className="flex bg-purple-500/20 border border-purple-500/30 text-purple-400 px-3 py-1 rounded text-xs font-bold items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> Queued
                        </div>
                     )}
                   </div>
                </div>

                {/* Sub-body rendering based on completion */}
                {(job.state === 'active' || job.state === 'queued') && (
                  <div className="mt-6 h-1 w-full bg-slate-800 rounded overflow-hidden">
                      <div className={`h-full bg-gradient-to-r ${job.state === 'active' ? 'from-blue-600 to-purple-500 w-[50%] animate-[pulse_2s_ease-in-out_infinite]' : 'from-purple-900 to-purple-700 w-[10%] '} transition-all duration-700`}></div>
                  </div>
                )}

                {job.state === 'completed' && job.result && (
                  <div className="mt-5 pt-4 border-t border-slate-700/50 flex justify-between items-center">
                     <div className="flex items-center gap-4">
                        <div className="text-center bg-slate-900/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
                           <span className="block text/[10px] uppercase font-bold text-slate-500">Totals</span>
                           <span className="block text-sm font-bold text-white">{job.result.scan?.totalFindings || 0}</span>
                        </div>
                        <div className="text-center bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-500/20">
                           <span className="block text/[10px] uppercase font-bold text-red-500/80">Critical</span>
                           <span className="block text-sm font-bold text-red-400">{job.result.scan?.criticalCount || 0}</span>
                        </div>
                     </div>
                     <button 
                        onClick={() => navigate(`/findings?scanId=${job.result.scan?._id || ''}`)}
                        className="text-xs flex items-center gap-1 font-semibold text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-3 py-2 rounded-lg"
                      >
                       View Report <ArrowRight className="h-3 w-3" />
                     </button>
                  </div>
                )}

                {job.state === 'failed' && job.error && (
                  <div className="mt-4 p-3 rounded bg-red-950/30 border border-red-900/50">
                    <p className="text-xs text-red-400/90 font-mono">Dump: {job.error}</p>
                  </div>
                )}

              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
