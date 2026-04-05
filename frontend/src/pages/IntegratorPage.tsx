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
  DEMO_WORKSPACE_ID,
} from "../config/contracts";
import { useIntegrator, ROLE_NAMES } from "../hooks/useComplianceStatus";
import { useKYCFlow } from "../hooks/useKYCFlow";
import { useComplianceLookup } from "../hooks/useComplianceLookup";
import SumsubVerification from "../components/SumsubVerification";
import DecryptButton from "../components/DecryptButton";
import AuditTrail from "../components/AuditTrail";

export default function IntegratorPage() {
  const { address } = useAccount();
  const { data: integrator, refetch } = useIntegrator(address);
  const [workspaceId, setWorkspaceId] = useState(DEMO_WORKSPACE_ID);
  const {
    lookupAddress,
    setLookupAddress,
    lookupPhase,
    lookupResult,
    handleLookup,
  } = useComplianceLookup();
  const [verifyTarget, setVerifyTarget] = useState("");

  const { writeContract, data: tx } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash: tx });

  // KYC flow via backend SDK → CRE workflows
  // On mount: checks on-chain isVerified(). If already verified, auto-skips to "done".
  const {
    step: kycStep,
    sumsubToken,
    errorMsg,
    isVerified: walletVerified,
    startKYC,
    onSumsubComplete,
    reset: resetKYC,
  } = useKYCFlow(address);

  useEffect(() => { if (isSuccess) refetch(); }, [isSuccess, refetch]);

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

  const handleStartKYC = () => {
    const target = verifyTarget || (address as string);
    startKYC(target);
  };

  const handleSumsubComplete = () => {
    const target = verifyTarget || (address as string);
    onSumsubComplete(target);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="w-6 h-6 text-accent-purple" />
          Integrator Dashboard
        </h1>
        <p className="text-gray-300 mt-1">
          Join a workspace as a broker, onboard users, and access compliance data.
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
              <span className="text-xs bg-accent-blue/20 text-accent-blue px-2 py-0.5 rounded-full ml-2">
                CRE Workflows
              </span>
            </h2>
            <p className="text-sm text-gray-400">
              Verify a user's identity via Sumsub. The backend triggers CRE Workflow D (token generation) and
              Workflow A (verification + credential issuance). All API calls happen inside the TEE via Confidential HTTP.
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
                    className="input-base font-mono text-sm"
                    placeholder={address || "0x..."}
                  />
                </div>
                <button onClick={handleStartKYC} className="btn-primary w-full flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" />
                  Start KYC Verification
                </button>
              </>
            )}

            {/* Loading token — CRE Workflow D running */}
            {kycStep === "loading-token" && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-accent-blue animate-spin mx-auto mb-3" />
                <p className="text-accent-blue text-sm">Generating Sumsub access token via CRE...</p>
                <p className="text-gray-500 text-xs mt-1">Workflow D: Confidential HTTP → Sumsub API (credentials in TEE)</p>
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
                  onError={(err) => resetKYC()}
                />
              </div>
            )}

            {/* CRE Workflow A processing */}
            {(kycStep === "verifying" || kycStep === "polling") && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 text-accent-purple animate-spin mx-auto mb-3" />
                <p className="text-accent-purple text-sm">
                  {kycStep === "verifying"
                    ? "CRE verifying identity + issuing credential..."
                    : "Waiting for on-chain confirmation..."}
                </p>
                <p className="text-gray-500 text-xs mt-1">
                  Workflow A: Confidential HTTP → Sumsub + Chainalysis → onReport() → credential on-chain
                </p>
              </div>
            )}

            {/* Done / Already Verified */}
            {kycStep === "done" && (
              <div className="text-center py-8 bg-accent-green/5 rounded-xl">
                <ShieldCheck className="w-12 h-12 text-accent-green mx-auto mb-3" />
                <p className="text-accent-green font-semibold text-lg">Verified</p>
                <p className="text-gray-400 text-sm mt-1">
                  On-chain KYC credential active. This wallet can trade on compliant protocols.
                </p>
                <p className="text-gray-500 text-xs mt-1 font-mono">{address?.slice(0, 10)}...{address?.slice(-8)}</p>
                <button onClick={resetKYC} className="btn-secondary mt-4 text-sm">
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
                <button onClick={resetKYC} className="btn-secondary mt-4 text-sm">
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* User Compliance Lookup — triggers CRE Workflow C */}
          <div className="card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Search className="w-5 h-5 text-accent-cyan" />
              Check User Compliance
            </h2>
            <p className="text-xs text-gray-400">
              Triggers CRE Workflow C (Identity Audit) to fetch compliance data via Confidential HTTP.
              PII is encrypted with AES-GCM before leaving the TEE enclave.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={lookupAddress}
                onChange={(e) => setLookupAddress(e.target.value)}
                className="input-base flex-1 font-mono text-sm"
                placeholder="0x... wallet address"
              />
              <button onClick={handleLookup} disabled={lookupPhase === "chain" || lookupPhase === "cre" || !lookupAddress} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                {lookupPhase === "chain" || lookupPhase === "cre" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {lookupPhase === "chain" ? "Reading chain..." : lookupPhase === "cre" ? "Running CRE..." : "Check"}
              </button>
            </div>

            {/* Phase indicator */}
            {(lookupPhase === "chain" || lookupPhase === "cre") && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-700/30 border border-surface-600/50">
                <Loader2 className="w-5 h-5 text-accent-cyan animate-spin flex-shrink-0" />
                <div>
                  <p className="text-sm text-accent-cyan font-medium">
                    {lookupPhase === "chain" ? "Reading on-chain status..." : "Running CRE Workflow C (Identity Audit)..."}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {lookupPhase === "chain"
                      ? "Calling isVerified() on ComplianceCredentialConsumer"
                      : "Confidential HTTP → Sumsub API inside TEE enclave. PII encrypted with AES-GCM."}
                  </p>
                </div>
              </div>
            )}

            {lookupResult && (
              <div className="space-y-3">
                {/* On-chain status */}
                <div className={`flex items-center gap-3 p-3 rounded-lg ${lookupResult.isVerified ? "bg-accent-green/10 border border-accent-green/20" : "bg-accent-red/10 border border-accent-red/20"}`}>
                  {lookupResult.isVerified ? <ShieldCheck className="w-5 h-5 text-accent-green" /> : <ShieldX className="w-5 h-5 text-accent-red" />}
                  <div>
                    <div className="text-sm font-medium">{lookupResult.isVerified ? "Verified — safe to trade" : "Not Verified"}</div>
                    <div className="text-xs text-gray-400 font-mono">{lookupAddress.slice(0, 20)}...</div>
                  </div>
                </div>

                {/* CRE Audit result */}
                {lookupResult.audit && (
                  <div className="p-3 rounded-lg bg-surface-700/30 border border-surface-600/50 space-y-2">
                    <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-accent-cyan" />
                      CRE Workflow C — Identity Audit
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Authorized:</span>{" "}
                        <span className={lookupResult.audit.authorized ? "text-accent-green" : "text-accent-red"}>
                          {lookupResult.audit.authorized ? "Yes" : "No"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Role:</span>{" "}
                        <span className="text-gray-300">{lookupResult.audit.requesterRole || "—"}</span>
                      </div>
                      {lookupResult.audit.reason && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Reason:</span>{" "}
                          <span className="text-gray-300">{lookupResult.audit.reason}</span>
                        </div>
                      )}
                      {lookupResult.audit.encryptedIdentity && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Encrypted PII:</span>{" "}
                          <code className="text-accent-purple text-[10px] break-all">{lookupResult.audit.encryptedIdentity.slice(0, 40)}...</code>
                          <p className="text-gray-500 mt-1">{lookupResult.audit.encryptionNote}</p>
                          <DecryptButton encryptedHex={lookupResult.audit.encryptedIdentity} />
                        </div>
                      )}
                      {lookupResult.audit.identity && (
                        <>
                          <div>
                            <span className="text-gray-500">KYC Status:</span>{" "}
                            <span className="text-gray-300">{lookupResult.audit.identity.status}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Country:</span>{" "}
                            <span className="text-gray-300">{lookupResult.audit.identity.country}</span>
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1">
                      Data fetched via Confidential HTTP inside TEE. PII encrypted with AES-256-GCM.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Audit Trail — real on-chain data */}
          <AuditTrail />
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
              className="input-base font-mono text-sm"
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
