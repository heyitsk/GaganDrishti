import { useState, useEffect } from "react";
import { format } from "date-fns";
import { 
  Cloud, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  X, 
  Copy,
  Loader2,
  ShieldAlert,
  Key
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/axios";


// --- Types ---
interface Account {
  _id: string;
  accountName: string;
  provider: string;
  authType: "role" | "keys";
  region: string;
  isActive: boolean;
  createdAt: string;
  roleArn?: string;
  accessKeyId?: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<Record<string, "success" | "error">>({});
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form State
  const [accountName, setAccountName] = useState("");
  const [provider, setProvider] = useState("AWS");
  const [region, setRegion] = useState("us-east-1");
  const [authType, setAuthType] = useState<"role" | "keys">("role");
  
  // Role Mode
  const [roleArn, setRoleArn] = useState("");
  
  // Keys Mode
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/accounts");
      const fetchedAccounts = res.data.accounts || [];
      setAccounts(fetchedAccounts);
      
      const statusMap: Record<string, "success" | "error"> = {};
      fetchedAccounts.forEach((acc: any) => {
        if (acc.isValidated) {
          statusMap[acc._id] = "success";
        }
      });
      setValidationStatus(statusMap);
    } catch (err) {
      toast.error("Failed to load accounts");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleCopyTrustPolicy = () => {
    const policy = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::<YOUR_12_DIGIT_ACCOUNT_ID>:user/<YOUR_IAM_USERNAME>"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}`;
    navigator.clipboard.writeText(policy);
    toast.success("Trust policy copied to clipboard!");
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) {
      toast.error("Account name is required");
      return;
    }

    if (authType === "role" && !roleArn.trim()) {
      toast.error("Role ARN is required");
      return;
    }

    if (authType === "keys" && (!accessKeyId.trim() || !secretAccessKey.trim())) {
      toast.error("Access Key and Secret Key are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: Record<string, string> = {
        accountName,
        provider,
        region,
        authType,
      };

      if (authType === "role") {
        payload.roleArn = roleArn;
      } else {
        payload.accessKeyId = accessKeyId;
        payload.secretAccessKey = secretAccessKey;
      }

      await api.post("/accounts", payload);
      toast.success("Account added successfully");
      setIsModalOpen(false);
      resetForm();
      fetchAccounts();
    } catch (error) {
      toast.error((error as any).response?.data?.error || "Failed to add account");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAccountName("");
    setProvider("AWS");
    setRegion("us-east-1");
    setAuthType("role");
    setRoleArn("");
    setAccessKeyId("");
    setSecretAccessKey("");
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleValidate = async (id: string) => {
    setValidatingId(id);
    setValidationStatus(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    try {
      const res = await api.post(`/accounts/${id}/validate`);
      if (res.data.valid) {
        toast.success("Account validation successful");
        setValidationStatus(prev => ({ ...prev, [id]: "success" }));
      } else {
        toast.error(`Validation failed: ${res.data.error || "Unknown error"}`);
        setValidationStatus(prev => ({ ...prev, [id]: "error" }));
      }
    } catch (error) {
      console.log(error);
      toast.error((error as any).response?.data?.error || "Failed to validate account");
      setValidationStatus(prev => ({ ...prev, [id]: "error" }));
    } finally {
      setValidatingId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    toast(`Are you sure you want to delete the account "${name}"?`, {
      position: "top-center",
      action: {
        label: "Delete",
        onClick: async () => {
          try {
            await api.delete(`/accounts/${id}`);
            toast.success("Account deleted successfully");
            fetchAccounts();
          } catch (error) {
            toast.error((error as any).response?.data?.error || "Failed to delete account");
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    });
  };

  return (
    <div className="min-h-full font-sans text-slate-200 p-8 space-y-8 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-1">Cloud Accounts</h1>
          <p className="text-sm text-slate-400">Manage your connected cloud accounts</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </button>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-xl border border-slate-800 border-dashed bg-[#131A2B]/50">
          <Cloud className="h-12 w-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-300 mb-1">No accounts connected</h3>
          <p className="text-sm text-slate-500 text-center max-w-sm mb-6">Connect your first AWS account to start scanning for security vulnerabilities and compliance issues.</p>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add First Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {accounts.map(account => (
            <div key={account._id} className="rounded-xl border border-slate-800 bg-[#131A2B] p-5 hover:border-slate-700 transition-all flex flex-col h-full shadow-lg">
              
              {/* Card Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white mb-2">{account.accountName}</h3>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1 rounded bg-[#F79009]/10 px-2 py-0.5 text-[11px] font-medium text-[#F79009] border border-[#F79009]/20">
                      <Cloud className="h-3 w-3" />
                      {account.provider}
                    </span>
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-medium border ${account.isActive ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <Cloud className="h-5 w-5 text-slate-400" />
                </div>
              </div>

              {/* Card Details */}
              <div className="space-y-3 mb-6 flex-1 text-sm bg-[#0B0F19] p-4 rounded-lg border border-slate-800/50">
                <div className="flex justify-between">
                  <span className="text-slate-500">Auth Type</span>
                  <span className="text-slate-300 font-medium flex items-center gap-1.5">
                    {account.authType === 'role' ? <ShieldAlert className="h-3.5 w-3.5 text-blue-400" /> : <Key className="h-3.5 w-3.5 text-orange-400" />}
                    {account.authType === 'role' ? 'IAM Role' : 'Access Keys'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Region</span>
                  <span className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded text-xs font-mono">{account.region}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{account.authType === 'role' ? 'Role ARN' : 'Access Key ID'}</span>
                  <span className="text-slate-300 font-mono text-[11px] bg-slate-800/50 px-2 py-1 rounded truncate max-w-[150px]" title={account.authType === 'role' ? account.roleArn : account.accessKeyId}>
                    {account.authType === 'role' ? account.roleArn : account.accessKeyId}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Connected</span>
                  <span className="text-slate-400 text-xs">{format(new Date(account.createdAt), "MMM dd, yyyy")}</span>
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-800">
                <button 
                  onClick={() => handleValidate(account._id)}
                  disabled={validatingId === account._id}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                    validationStatus[account._id] === "error"
                      ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                      : validationStatus[account._id] === "success"
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-slate-800 border-slate-700/50 text-slate-200 hover:bg-slate-700"
                  }`}
                >
                  {validatingId === account._id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : validationStatus[account._id] === "error" ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Validate
                </button>
                <button 
                  onClick={() => handleDelete(account._id, account.accountName)}
                  className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                  title="Delete Account"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-[#0B0F19]/80 backdrop-blur-sm" onClick={closeModal} />
          
          {/* Modal Content */}
          <div className="relative w-full max-w-xl mx-4 rounded-2xl border border-slate-800 bg-[#131A2B] shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-blue-500" />
                Connect Cloud Account
              </h2>
              <button onClick={closeModal} className="text-slate-500 hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleAddAccount} className="space-y-6">
                
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      Account Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="e.g. Production AWS"
                      className="w-full rounded-lg border border-slate-700 bg-[#1E293B] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Provider</label>
                    <select
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#1E293B] px-3 py-2.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="AWS">AWS</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Authentication Type</label>
                    <select
                      value={authType}
                      onChange={(e) => setAuthType(e.target.value as "role"| "keys")}
                      className="w-full rounded-lg border border-slate-700 bg-[#1E293B] px-3 py-2.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="role">IAM Role (Recommended)</option>
                      <option value="keys">Access Keys (Not Recommended)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Region</label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-[#1E293B] px-3 py-2.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="us-east-1">US East (N. Virginia) us-east-1</option>
                      <option value="us-west-2">US West (Oregon) us-west-2</option>
                      <option value="eu-west-1">Europe (Ireland) eu-west-1</option>
                      <option value="ap-south-1">Asia Pacific (Mumbai) ap-south-1</option>
                      <option value="ap-southeast-1">Asia Pacific (Singapore) ap-southeast-1</option>
                    </select>
                  </div>
                </div>

                <hr className="border-slate-800" />

                {/* Auth Specific UI */}
                {authType === "role" ? (
                  <div className="space-y-4">
                    <div className="bg-[#1E293B]/50 rounded-xl border border-slate-700/50 p-4 space-y-4 text-sm text-slate-300">
                      
                      <div className="space-y-1">
                        <p className="font-semibold text-white flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs">1</span>
                          Create an IAM Role
                        </p>
                        <p className="text-slate-400 pl-7">Go to AWS Console → IAM → Roles → Create Role. Select "Custom trust policy".</p>
                      </div>

                      <div className="space-y-2">
                        <p className="font-semibold text-white flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs">2</span>
                          Set Trust Policy
                        </p>
                        <div className="relative pl-7 group">
                          <pre className="rounded-lg bg-[#0B0F19] border border-slate-800 p-3 text-xs overflow-x-auto text-slate-400 font-mono">
{`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::<YOUR_12_DIGIT_ACCOUNT_ID>:user/<YOUR_IAM_USERNAME>" },
    "Action": "sts:AssumeRole"
  }]
}`}
                          </pre>
                          <button 
                            type="button" 
                            onClick={handleCopyTrustPolicy}
                            className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-800 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                         <p className="font-semibold text-white flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs">3</span>
                          Attach Permissions
                        </p>
                        <ul className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-slate-400">
                          <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> AmazonS3ReadOnlyAccess</li>
                          <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> AmazonEC2ReadOnlyAccess</li>
                          <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> IAMReadOnlyAccess</li>
                          <li className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> AmazonRDSReadOnlyAccess</li>
                        </ul>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="text-sm font-medium text-white flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-xs">4</span>
                        Paste your Role ARN <span className="text-red-500">*</span>
                      </label>
                      <div className="pl-7">
                        <input
                          type="text"
                          value={roleArn}
                          onChange={(e) => setRoleArn(e.target.value)}
                          placeholder="arn:aws:iam::123456789012:role/GaganDrishtiScanRole"
                          className="w-full rounded-lg border border-slate-700 bg-[#1E293B] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 p-4 text-sm text-orange-200">
                      <strong>Security Warning:</strong> Using long-lived access keys is not recommended. Please ensure the IAM user associated with these keys only has the minimum Required ReadOnly permissions.
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        Access Key ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={accessKeyId}
                        onChange={(e) => setAccessKeyId(e.target.value)}
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        className="w-full rounded-lg border border-slate-700 bg-[#1E293B] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">
                        Secret Access Key <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        value={secretAccessKey}
                        onChange={(e) => setSecretAccessKey(e.target.value)}
                        placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                        className="w-full rounded-lg border border-slate-700 bg-[#1E293B] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-6 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 rounded-lg border border-slate-700 bg-[#1E293B] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Validate & Connect
                  </button>
                </div>

              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
