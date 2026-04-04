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
import SumsubVerification from "../components/SumsubVerification";

// Token proxy URL (local dev) — in production: CRE gateway
const TOKEN_PROXY_URL = "http://localhost:3001/token";

export default function IntegratorPage() {
  const { address } = useAccount();
  const { data: integrator, refetch } = useIntegrator(address);
  const [workspaceId, setWorkspaceId] = useState(DEMO_WORKSPACE_ID);
  const [lookupAddress, setLookupAddress] = useState("");
  const [confirmedLookup, setConfirmedLookup] = useState<Address | undefined>();
  const [lookupResult, setLookupResult] = useState<boolean | null>(null);
  const [verifyTarget, setVerifyTarget] = useState("");

  // KYC flow state
  const [kycStep, setKycStep] = useState<"idle" | "loading-token" | "sumsub" | "cre" | "done" | "error">("idle");
  const [sumsubToken, setSumsubToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const { writeContract, data: tx } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash: tx });

  const {
    issueCredential,
    isPending: isIssuePending,
    isConfirming: isIssueConfirming,
    isSuccess: isIssueSuccess,
    error: issueError,
  } = useSimulateCredentialIssuance();

  useEffect(() => { if (isSuccess) refetch(); }, [isSuccess, refetch]);
  useEffect(() => {
    if (isIssueSuccess) setKycStep("done");
    if (issueError) { setKycStep("error"); setErrorMsg(issueError.message?.slice(0, 100) || "Transaction failed"); }
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
    if (lookupAddress) { setConfirmedLookup(lookupAddress as Address); setLookupResult(true); }
  };

  // Start KYC: get Sumsub token → show iframe
  const handleStartKYC = async () => {
    const target = (verifyTarget || address) as string;
    if (!target) return;

    setKycStep("loading-token");
    setErrorMsg("");

    try {
      const resp = await fetch(`${TOKEN_PROXY_URL}?userId=${encodeURIComponent(target)}`);
      const data = await resp.json();

      if (data.token) {
        setSumsubToken(data.token);
        setKycStep("sumsub");
      } else {
        throw new Error(data.description || "Failed to get token");
      }
    } catch (err: any) {
      console.error("Token generation failed:", err);
      setErrorMsg(
        err.message?.includes("fetch")
          ? "Token proxy not running. Start it with: bun frontend/sumsub-proxy.ts"
          : err.message || "Failed to generate token"
      );
      setKycStep("error");
    }
  };

  // Sumsub iframe completed → trigger credential issuance
  const handleSumsubComplete = () => {
    const target = (verifyTarget || address) as Address;
    if (!target || !address) return;

    setKycStep("cre");
    setSumsubToken(null);

    if (SIMULATE_MODE) {
      // Simulation: call onReport() directly
      issueCredential(target, address);
    }
    // Production: CRE Workflow A would verify via Sumsub API and write credential
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
              <div className="text-sm text-gray-400 font-mono">APP-ID: {appId?.slice(0, 16)}...</div>
            </div>
            <span className="badge-verified">{ROLE_NAMES[role]}</span>
          </div>

          {/* KYC Verification Panel */}
          <div className="card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent-green" />
              Identity Verification
              {SIMULATE_MODE && (
                <span className="text-xs bg-accent-amber/20 text-accent-amber px-2 py-0.5 rounded-full ml-2">
                  Demo Mode
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-400">
              Verify a user's identity via Sumsub. After verification, a KYC credential is written on-chain. In production, CRE Workflow A handles the entire flow inside the TEE.
            </p>

            {/* Wallet input */}
            {kycStep === "idle" && (
              <>
                <div>
                  <label className="text-sm text-gray-400 block mb-1">
                    Wallet to verify (leave empty for yourself)
                  </label>
                  <input
                    type="text"
                    value={verifyTarget}
                    onChange={(e) => setVerifyTarget(e.target.value)}
                    className="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-accent-blue"
                    placeholder={address || "0x..."}
                  />
                </div>
                <button onClick={handleStartKYC} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" />
                  Start KYC Verification
                </button>
              </>
            )}

            {/* Loading token */}
            {kycStep === "loading-token" && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-accent-blue animate-spin mx-auto mb-3" />
                <p className="text-accent-blue text-sm">Generating Sumsub access token...</p>
                <p className="text-gray-500 text-xs mt-1">In production: CRE generates this inside the TEE</p>
              </div>
            )}

            {/* Sumsub iframe */}
            {kycStep === "sumsub" && sumsubToken && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-accent-blue">
                  <div className="w-5 h-5 rounded-full bg-accent-blue/20 flex items-center justify-center">
                    <Loader2 className="w-3 h-3 animate-spin" />
                  </div>
                  Step 1: Complete identity verification below
                </div>
                <SumsubVerification
                  accessToken={sumsubToken}
                  onComplete={handleSumsubComplete}
                  onError={(err) => { setKycStep("error"); setErrorMsg(String(err)); }}
                />
              </div>
            )}

            {/* CRE processing */}
            {kycStep === "cre" && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-accent-purple animate-spin mx-auto mb-3" />
                <p className="text-accent-purple text-sm">
                  {isIssuePending ? "Sending credential transaction..." : isIssueConfirming ? "Confirming on-chain..." : "Writing KYC credential..."}
                </p>
                <p className="text-gray-500 text-xs mt-1">Step 2: CRE Workflow writing credential to CredentialRegistry</p>
              </div>
            )}

            {/* Done */}
            {kycStep === "done" && (
              <div className="text-center py-8 bg-accent-green/5 rounded-xl">
                <ShieldCheck className="w-12 h-12 text-accent-green mx-auto mb-3" />
                <p className="text-accent-green font-semibold text-lg">Verified!</p>
                <p className="text-gray-400 text-sm mt-1">On-chain KYC credential issued. This wallet can now trade on compliant protocols.</p>
                <button onClick={() => { setKycStep("idle"); setSumsubToken(null); }} className="btn-secondary mt-4 text-sm">
                  Verify Another User
                </button>
              </div>
            )}

            {/* Error */}
            {kycStep === "error" && (
              <div className="text-center py-8 bg-accent-red/5 rounded-xl">
                <ShieldX className="w-10 h-10 text-accent-red mx-auto mb-3" />
                <p className="text-accent-red font-medium">Verification failed</p>
                <p className="text-gray-400 text-xs mt-2 max-w-md mx-auto">{errorMsg}</p>
                <button onClick={() => { setKycStep("idle"); setSumsubToken(null); setErrorMsg(""); }} className="btn-secondary mt-4 text-sm">
                  Try Again
                </button>
              </div>
            )}
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

          {/* Audit Trail */}
          <div className="card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-accent-amber" />
              Audit Trail
            </h2>
            <p className="text-sm text-gray-400">
              Per-trade audit records are on IPFS. KYC/AML data accessed via CRE Workflow C (Confidential HTTP in TEE, scoped by appId).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-surface-700/50">
                <div className="text-xs text-gray-400 mb-1">KYC/AML Data (PII)</div>
                <div className="text-sm">Via CRE Workflow C</div>
                <div className="text-xs text-gray-500 mt-1">Confidential HTTP in TEE</div>
              </div>
              <div className="p-4 rounded-lg bg-surface-700/50">
                <div className="text-xs text-gray-400 mb-1">Trade Audit (non-PII)</div>
                <div className="text-sm">Direct IPFS fetch</div>
                <div className="text-xs text-gray-500 mt-1">Public, hash-verified</div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card space-y-6 max-w-lg">
          <h2 className="text-lg font-semibold">Join a Protocol Workspace</h2>
          <p className="text-sm text-gray-400">
            Enter the workspace ID to register as a broker. Your wallet becomes your API key.
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
            <p className="text-xs text-gray-500 mt-1">Pre-filled with the demo workspace</p>
          </div>
          <button onClick={handleJoin} disabled={!workspaceId || isLoading} className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {isLoading ? "Joining..." : "Join as Broker"}
          </button>
        </div>
      )}
    </div>
  );
}
