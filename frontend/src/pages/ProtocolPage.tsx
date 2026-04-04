import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { Building2, Copy, ExternalLink, Check, Loader2, Code2, BookOpen, Plus, ChevronRight } from "lucide-react";
import { CONTRACTS, INTEGRATOR_REGISTRY_ABI, DEMO_WORKSPACE_ID } from "../config/contracts";
import { useIntegrator, ROLE_NAMES } from "../hooks/useComplianceStatus";

export default function ProtocolPage() {
  const { address } = useAccount();
  const { data: integrator, refetch } = useIntegrator(address);
  const [name, setName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const { writeContract, data: tx } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash: tx });

  // Read demo workspace info
  const { data: demoWorkspace } = useReadContract({
    address: CONTRACTS.integratorRegistry,
    abi: INTEGRATOR_REGISTRY_ABI,
    functionName: "getWorkspace",
    args: [DEMO_WORKSPACE_ID as `0x${string}`],
  });

  useEffect(() => {
    if (isSuccess) refetch();
  }, [isSuccess, refetch]);

  const [appId, workspaceId, role, active] = (integrator as [string, string, number, boolean]) ?? [];
  const isRegistered = active === true;
  const [wsName, wsAdmin, wsActive] = (demoWorkspace as [string, string, boolean, boolean]) ?? [];

  const handleCreate = () => {
    if (!name) return;
    writeContract({
      address: CONTRACTS.integratorRegistry,
      abi: INTEGRATOR_REGISTRY_ABI,
      functionName: "createWorkspace",
      args: [name, false],
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Building2 className="w-6 h-6 text-accent-blue" />
          Protocol Dashboard
        </h1>
        <p className="text-gray-300 mt-1">
          Manage compliance workspaces and view integration details
        </p>
      </div>

      {/* Workspaces List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Workspaces</h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            New Workspace
          </button>
        </div>

        {/* Demo workspace card */}
        {wsName && (
          <div className="card hover:border-accent-blue/50 transition-colors cursor-pointer"
            onClick={() => {/* Could navigate to workspace detail */}}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent-blue/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-accent-blue" />
                </div>
                <div>
                  <div className="font-medium">{wsName}</div>
                  <div className="text-sm text-gray-400">
                    Admin: {wsAdmin?.slice(0, 8)}...{wsAdmin?.slice(-6)}
                    {wsActive && <span className="ml-2 text-accent-green">● Active</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-gray-500">Workspace ID</div>
                  <code className="text-xs text-gray-400 font-mono">
                    {DEMO_WORKSPACE_ID.slice(0, 10)}...{DEMO_WORKSPACE_ID.slice(-6)}
                  </code>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(DEMO_WORKSPACE_ID, "ws"); }}
                  className="p-2 hover:bg-surface-700 rounded-lg transition-colors"
                >
                  {copied === "ws" ? <Check className="w-4 h-4 text-accent-green" /> : <Copy className="w-4 h-4 text-gray-400" />}
                </button>
                <ChevronRight className="w-5 h-5 text-gray-500" />
              </div>
            </div>
          </div>
        )}

        {/* Create new workspace form */}
        {showCreate && (
          <div className="card space-y-4 border-dashed border-surface-600">
            <h3 className="text-sm font-semibold text-gray-300">Create New Workspace</h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-base flex-1 text-sm"
                placeholder="my-defi-protocol"
              />
              <button
                onClick={handleCreate}
                disabled={!name || isLoading}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {isLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Current wallet status */}
      {isRegistered && (
        <div className="card flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-green/20 flex items-center justify-center">
            <Check className="w-5 h-5 text-accent-green" />
          </div>
          <div className="flex-1">
            <div className="font-medium text-sm">Your Registration</div>
            <div className="text-xs text-gray-400">
              Role: <span className="text-white">{ROLE_NAMES[role]}</span> |
              APP-ID: <code className="text-gray-300 font-mono">{appId?.slice(0, 10)}...{appId?.slice(-6)}</code>
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(appId, "appId")}
            className="p-2 hover:bg-surface-700 rounded-lg"
          >
            {copied === "appId" ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
          </button>
        </div>
      )}

      {/* Deployed Contracts */}
      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Code2 className="w-5 h-5 text-accent-purple" />
          Deployed Contracts (Arc Testnet)
        </h2>
        <div className="space-y-2">
          {Object.entries(CONTRACTS).map(([name, addr]) => (
            <div key={name} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-700/50">
              <span className="text-sm text-gray-300">{name}</span>
              <div className="flex items-center gap-2">
                <code className="text-xs text-gray-400 font-mono">
                  {addr.slice(0, 10)}...{addr.slice(-8)}
                </code>
                <a
                  href={`https://testnet.arcscan.app/address/${addr}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:text-accent-blue/80"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Guide */}
      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-accent-cyan" />
          Integration Guide
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-accent-green mb-2">
              Pattern 1: Simplest (1 line)
            </h3>
            <pre className="bg-surface-900 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto">
{`require(
  IComplianceCredentialConsumer(${CONTRACTS.credentialConsumer.slice(0, 10)}...).isVerified(msg.sender),
  "Not compliant"
);`}
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-medium text-accent-blue mb-2">
              Pattern 2: ACE PolicyEngine
            </h3>
            <pre className="bg-surface-900 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto">
{`function trade(...) external runPolicy {
    // compliance check is transparent
}`}
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-medium text-accent-purple mb-2">
              Pattern 3: Async (auto-callback)
            </h3>
            <pre className="bg-surface-900 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto">
{`function swap(...) external {
    emit ComplianceCheckRequested(tradeId, msg.sender, counterparty, asset, amount);
    // CRE checks → auto-calls onComplianceApproved → trade executes
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
