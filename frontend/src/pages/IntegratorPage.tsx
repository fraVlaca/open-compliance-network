import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldX,
  Loader2,
  Search,
  FileCheck,
  Zap,
} from "lucide-react";
import { type Address } from "viem";
import {
  CONTRACTS,
  INTEGRATOR_REGISTRY_ABI,
  SIMULATE_MODE,
  DEMO_WORKSPACE_ID,
} from "../config/contracts";
import { useIntegrator, useIsVerified, ROLE_NAMES } from "../hooks/useComplianceStatus";
import { useSimulateCredentialIssuance } from "../hooks/useSimulate";

export default function IntegratorPage() {
  const { address } = useAccount();
  const { data: integrator, refetch } = useIntegrator(address);
  const [workspaceId, setWorkspaceId] = useState(DEMO_WORKSPACE_ID);
  const [lookupAddress, setLookupAddress] = useState("");
  const [confirmedLookup, setConfirmedLookup] = useState<Address | undefined>();
  const [lookupResult, setLookupResult] = useState<boolean | null>(null);
  const [verifyTarget, setVerifyTarget] = useState("");
  const [kycStep, setKycStep] = useState<"idle" | "sumsub" | "cre" | "done" | "error">("idle");

  const { writeContract, data: tx } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash: tx });

  // Simulation hooks
  const {
    issueCredential,
    isPending: isIssuePending,
    isConfirming: isIssueConfirming,
    isSuccess: isIssueSuccess,
    error: issueError,
  } = useSimulateCredentialIssuance();

  useEffect(() => {
    if (isSuccess) refetch();
  }, [isSuccess, refetch]);

  useEffect(() => {
    if (isIssueSuccess) {
      setKycStep("done");
      // Also refresh the lookup if we verified the same address
      if (confirmedLookup === verifyTarget) {
        setLookupResult(null);
        setTimeout(() => setLookupResult(true), 500);
      }
    }
    if (issueError) setKycStep("error");
  }, [isIssueSuccess, issueError]);

  const { data: userVerified } = useIsVerified(confirmedLookup);

  const [appId, wsId, role, active] = (integrator as [string, string, number, boolean]) ?? [];
  const isRegistered = active === true;

  const handleJoin = () => {
    if (!workspaceId) return;
    writeContract({
      address: CONTRACTS.integratorRegistry,
      abi: INTEGRATOR_REGISTRY_ABI,
      functionName: "joinWorkspace",
      args: [workspaceId as `0x${string}`, 1],
    });
  };

  const handleLookup = () => {
    if (lookupAddress) {
      setConfirmedLookup(lookupAddress as Address);
      setLookupResult(true);
    }
  };

  const handleStartKYC = () => {
    const target = (verifyTarget || address) as Address;
    if (!target || !address) return;

    setKycStep("sumsub");

    // Simulate: skip Sumsub SDK, go straight to CRE simulation
    setTimeout(() => {
      setKycStep("cre");

      if (SIMULATE_MODE) {
        // In simulate mode, call onReport() directly
        issueCredential(target, address);
      }
      // In production: this would trigger the CRE HTTP workflow
    }, 1500); // Brief delay to simulate Sumsub SDK step
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-accent-purple" />
          Integrator Dashboard
        </h1>
        <p className="text-gray-400 mt-1">
          Join a workspace as a broker, onboard users, and access compliance data
        </p>
      </div>

      {isRegistered ? (
        <>
          {/* Status */}
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-purple/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-accent-purple" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{ROLE_NAMES[role]} — Active</div>
              <div className="text-sm text-gray-400 font-mono">
                APP-ID: {appId?.slice(0, 16)}...
              </div>
            </div>
            <span className="badge-verified">{ROLE_NAMES[role]}</span>
          </div>

          {/* KYC Verification Panel */}
          <div className="card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent-green" />
              User Verification
              {SIMULATE_MODE && (
                <span className="text-xs bg-accent-amber/20 text-accent-amber px-2 py-0.5 rounded-full ml-2">
                  Simulation Mode
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-400">
              {SIMULATE_MODE
                ? "Simulating the KYC flow: Sumsub SDK → CRE Workflow A → on-chain credential. In production, the CRE DON handles this automatically."
                : "As a broker, you onboard users via the Sumsub SDK. The CRE workflow verifies their identity and writes a credential on-chain."}
            </p>

            {/* Verify target input */}
            <div>
              <label className="text-sm text-gray-400 block mb-1">
                Wallet to verify (leave empty to verify yourself)
              </label>
              <input
                type="text"
                value={verifyTarget}
                onChange={(e) => { setVerifyTarget(e.target.value); setKycStep("idle"); }}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-accent-blue"
                placeholder={address || "0x..."}
              />
            </div>

            {/* KYC Flow visualization */}
            <div className="border border-surface-600 rounded-xl p-6 space-y-4">
              {/* Step indicators */}
              <div className="flex items-center gap-3 text-sm">
                <div className={`flex items-center gap-2 ${kycStep === "sumsub" ? "text-accent-blue" : kycStep === "cre" || kycStep === "done" ? "text-accent-green" : "text-gray-500"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${kycStep === "sumsub" ? "bg-accent-blue/20 border border-accent-blue" : kycStep === "cre" || kycStep === "done" ? "bg-accent-green/20" : "bg-surface-700"}`}>
                    {kycStep === "sumsub" ? <Loader2 className="w-3 h-3 animate-spin" /> : (kycStep === "cre" || kycStep === "done") ? "✓" : "1"}
                  </div>
                  Sumsub KYC
                </div>
                <div className="flex-1 h-px bg-surface-600" />
                <div className={`flex items-center gap-2 ${kycStep === "cre" ? "text-accent-blue" : kycStep === "done" ? "text-accent-green" : "text-gray-500"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${kycStep === "cre" ? "bg-accent-blue/20 border border-accent-blue" : kycStep === "done" ? "bg-accent-green/20" : "bg-surface-700"}`}>
                    {(isIssuePending || isIssueConfirming) ? <Loader2 className="w-3 h-3 animate-spin" /> : kycStep === "done" ? "✓" : "2"}
                  </div>
                  CRE Workflow
                </div>
                <div className="flex-1 h-px bg-surface-600" />
                <div className={`flex items-center gap-2 ${kycStep === "done" ? "text-accent-green" : "text-gray-500"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${kycStep === "done" ? "bg-accent-green/20" : "bg-surface-700"}`}>
                    {kycStep === "done" ? "✓" : "3"}
                  </div>
                  On-chain
                </div>
              </div>

              {/* Status message */}
              {kycStep === "idle" && (
                <div className="text-center py-4">
                  <ShieldCheck className="w-10 h-10 text-accent-blue/30 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Ready to verify</p>
                </div>
              )}
              {kycStep === "sumsub" && (
                <div className="text-center py-4">
                  <Loader2 className="w-8 h-8 text-accent-blue animate-spin mx-auto mb-2" />
                  <p className="text-accent-blue text-sm">Sumsub SDK verifying identity...</p>
                  <p className="text-gray-500 text-xs mt-1">{SIMULATE_MODE ? "Simulated — skipping document upload" : "Upload documents and selfie"}</p>
                </div>
              )}
              {kycStep === "cre" && (
                <div className="text-center py-4">
                  <Loader2 className="w-8 h-8 text-accent-purple animate-spin mx-auto mb-2" />
                  <p className="text-accent-purple text-sm">
                    {isIssuePending ? "Sending credential transaction..." : isIssueConfirming ? "Confirming on-chain..." : "CRE Workflow processing..."}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">Writing KYC credential to CredentialRegistry</p>
                </div>
              )}
              {kycStep === "done" && (
                <div className="text-center py-4 bg-accent-green/5 rounded-lg">
                  <ShieldCheck className="w-10 h-10 text-accent-green mx-auto mb-2" />
                  <p className="text-accent-green font-medium">Verified!</p>
                  <p className="text-gray-400 text-xs mt-1">On-chain credential issued. Wallet is now compliance-ready.</p>
                </div>
              )}
              {kycStep === "error" && (
                <div className="text-center py-4 bg-accent-red/5 rounded-lg">
                  <ShieldX className="w-10 h-10 text-accent-red mx-auto mb-2" />
                  <p className="text-accent-red font-medium">Verification failed</p>
                  <p className="text-gray-400 text-xs mt-1">{issueError?.message?.slice(0, 100)}</p>
                </div>
              )}

              {/* Start button */}
              <button
                onClick={handleStartKYC}
                disabled={kycStep !== "idle" && kycStep !== "done" && kycStep !== "error"}
                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {kycStep === "idle" || kycStep === "done" || kycStep === "error" ? (
                  <>
                    <Zap className="w-4 h-4" />
                    {kycStep === "done" ? "Verify Another" : "Start KYC Verification"}
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                )}
              </button>
            </div>
          </div>

          {/* User Lookup */}
          <div className="card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Search className="w-5 h-5 text-accent-cyan" />
              Check User Compliance
            </h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={lookupAddress}
                onChange={(e) => { setLookupAddress(e.target.value); setLookupResult(null); }}
                className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-accent-blue"
                placeholder="0x... wallet address"
              />
              <button onClick={handleLookup} className="btn-primary flex items-center gap-2">
                <Search className="w-4 h-4" />
                Check
              </button>
            </div>

            {lookupResult !== null && (
              <div className={`flex items-center gap-3 p-4 rounded-lg ${userVerified ? "bg-accent-green/10 border border-accent-green/20" : "bg-accent-red/10 border border-accent-red/20"}`}>
                {userVerified ? <ShieldCheck className="w-5 h-5 text-accent-green" /> : <ShieldX className="w-5 h-5 text-accent-red" />}
                <div>
                  <div className="text-sm font-medium">{userVerified ? "Verified" : "Not Verified"}</div>
                  <div className="text-xs text-gray-400 font-mono">{lookupAddress.slice(0, 20)}...</div>
                </div>
              </div>
            )}
          </div>

          {/* Audit Trail Access */}
          <div className="card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-accent-amber" />
              Audit Trail
            </h2>
            <p className="text-sm text-gray-400">
              Per-trade audit records are stored on IPFS. Read the on-chain ComplianceReport to get the IPFS CID, then fetch the full record from any IPFS gateway. Verify integrity with{" "}
              <code className="bg-surface-700 px-1 rounded text-xs">keccak256(record) === auditHash</code>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-surface-700/50">
                <div className="text-xs text-gray-400 mb-1">KYC/AML Data (PII)</div>
                <div className="text-sm">Via CRE Workflow C</div>
                <div className="text-xs text-gray-500 mt-1">Confidential HTTP in TEE, scoped by appId</div>
              </div>
              <div className="p-4 rounded-lg bg-surface-700/50">
                <div className="text-xs text-gray-400 mb-1">Trade Audit (non-PII)</div>
                <div className="text-sm">Direct IPFS fetch</div>
                <div className="text-xs text-gray-500 mt-1">Public, hash-verified, no workflow needed</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Join Workspace */
        <div className="card space-y-6 max-w-lg">
          <h2 className="text-lg font-semibold">Join a Protocol Workspace</h2>
          <p className="text-sm text-gray-400">
            Enter the workspace ID provided by the protocol to register as a broker. Your wallet becomes your API key — no signup needed.
          </p>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Workspace ID</label>
            <input
              type="text"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-accent-blue"
              placeholder="0x411f2547..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Pre-filled with the demo workspace ID
            </p>
          </div>
          <button
            onClick={handleJoin}
            disabled={!workspaceId || isLoading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {isLoading ? "Joining..." : "Join as Broker"}
          </button>
        </div>
      )}
    </div>
  );
}
