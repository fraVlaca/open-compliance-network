import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount, useReadContract } from "wagmi";
import {
  Building2,
  ArrowLeft,
  Search,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  FileCheck,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Lock,
} from "lucide-react";
import {
  CONTRACTS,
  INTEGRATOR_REGISTRY_ABI,
} from "../config/contracts";
import { useComplianceLookup } from "../hooks/useComplianceLookup";
import ComplianceFlowTracker, {
  type FlowStep,
} from "../components/ComplianceFlowTracker";
import DecryptButton from "../components/DecryptButton";
import AuditTrail from "../components/AuditTrail";

export default function ProtocolDetailPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { address } = useAccount();
  const [copied, setCopied] = useState<string | null>(null);

  const {
    lookupAddress,
    setLookupAddress,
    lookupPhase,
    lookupResult,
    handleLookup,
  } = useComplianceLookup();

  // Read workspace on-chain data
  const { data: workspace, isLoading: wsLoading } = useReadContract({
    address: CONTRACTS.integratorRegistry,
    abi: INTEGRATOR_REGISTRY_ABI,
    functionName: "getWorkspace",
    args: [workspaceId as `0x${string}`],
    query: { enabled: !!workspaceId },
  });

  const [wsName, wsAdmin, wsActive] =
    (workspace as [string, string, boolean, boolean]) ?? [];

  // Access control: only the workspace admin gets full access
  const isAdmin =
    !!address &&
    !!wsAdmin &&
    address.toLowerCase() === wsAdmin.toLowerCase();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  // Map lookupPhase to ComplianceFlowTracker steps
  const flowSteps: FlowStep[] =
    lookupPhase === "idle"
      ? []
      : [
          {
            label: "On-chain verification check",
            status:
              lookupPhase === "chain"
                ? "active"
                : "done",
            detail: "isVerified() on ComplianceCredentialConsumer",
          },
          {
            label: "CRE Workflow C - Identity Audit",
            status:
              lookupPhase === "cre"
                ? "active"
                : lookupPhase === "done"
                ? "done"
                : "pending",
            detail: "Confidential HTTP → Sumsub + Chainalysis inside TEE",
          },
          {
            label: "Results",
            status: lookupPhase === "done" ? "done" : "pending",
          },
        ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/app/protocol")}
          className="p-2 rounded-lg hover:bg-surface-700/50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-accent-blue" />
            Workspace Detail
          </h1>
          <p className="text-gray-300 mt-1">
            Workspace compliance overview and user audit
          </p>
        </div>
      </div>

      {/* Workspace Info Card */}
      {wsLoading ? (
        <div className="card flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-accent-blue animate-spin" />
        </div>
      ) : wsName ? (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent-blue/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-accent-blue" />
              </div>
              <div>
                <div className="text-lg font-semibold">{wsName}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  {wsActive ? (
                    <span className="badge-verified text-xs">Active</span>
                  ) : (
                    <span className="badge-rejected text-xs">Inactive</span>
                  )}
                  {isAdmin && (
                    <span className="text-xs bg-accent-purple/20 text-accent-purple px-2 py-0.5 rounded-full">
                      You are admin
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-surface-600/30">
            {/* Admin address */}
            <div className="p-3 rounded-lg bg-surface-700/30">
              <div className="text-xs text-gray-500 mb-1">Admin</div>
              <div className="flex items-center gap-2">
                <code className="text-sm text-gray-300 font-mono truncate">
                  {wsAdmin}
                </code>
                <button
                  onClick={() => copyToClipboard(wsAdmin, "admin")}
                  className="p-1 hover:bg-surface-600 rounded flex-shrink-0"
                >
                  {copied === "admin" ? (
                    <Check className="w-3 h-3 text-accent-green" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </button>
                <a
                  href={`https://testnet.arcscan.app/address/${wsAdmin}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:text-accent-blue/80 flex-shrink-0"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Workspace ID */}
            <div className="p-3 rounded-lg bg-surface-700/30">
              <div className="text-xs text-gray-500 mb-1">Workspace ID</div>
              <div className="flex items-center gap-2">
                <code className="text-sm text-gray-300 font-mono truncate">
                  {workspaceId}
                </code>
                <button
                  onClick={() =>
                    copyToClipboard(workspaceId || "", "wsId")
                  }
                  className="p-1 hover:bg-surface-600 rounded flex-shrink-0"
                >
                  {copied === "wsId" ? (
                    <Check className="w-3 h-3 text-accent-green" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card text-center py-8">
          <ShieldAlert className="w-10 h-10 text-accent-amber mx-auto mb-3" />
          <p className="text-gray-300 font-medium">Workspace not found</p>
          <p className="text-sm text-gray-500 mt-1">
            This workspace ID does not exist on-chain.
          </p>
        </div>
      )}

      {/* Access-gated content */}
      {isAdmin ? (
        <>
          {/* Compliance Lookup - CRE Workflow C */}
          <div className="card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Search className="w-5 h-5 text-accent-cyan" />
              Compliance Lookup
              <span className="text-xs bg-accent-blue/20 text-accent-blue px-2 py-0.5 rounded-full ml-2">
                CRE Workflow C
              </span>
            </h2>
            <p className="text-xs text-gray-400">
              Look up any wallet's KYC and AML compliance status. Triggers CRE
              Workflow C (Identity Audit) which fetches data via Confidential
              HTTP inside the TEE enclave. PII is encrypted with AES-256-GCM.
            </p>

            <div className="flex gap-3">
              <input
                type="text"
                value={lookupAddress}
                onChange={(e) => {
                  setLookupAddress(e.target.value);
                }}
                className="input-base flex-1 font-mono text-sm"
                placeholder="0x... wallet address"
              />
              <button
                onClick={handleLookup}
                disabled={
                  lookupPhase === "chain" ||
                  lookupPhase === "cre" ||
                  !lookupAddress
                }
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {lookupPhase === "chain" || lookupPhase === "cre" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {lookupPhase === "chain"
                  ? "Reading chain..."
                  : lookupPhase === "cre"
                  ? "Running CRE..."
                  : "Check"}
              </button>
            </div>

            {/* Flow tracker */}
            {lookupPhase !== "idle" && (
              <ComplianceFlowTracker steps={flowSteps} />
            )}

            {/* Results */}
            {lookupResult && (
              <div className="space-y-3">
                {/* On-chain verification status */}
                <div
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    lookupResult.isVerified
                      ? "bg-accent-green/10 border border-accent-green/20"
                      : "bg-accent-red/10 border border-accent-red/20"
                  }`}
                >
                  {lookupResult.isVerified ? (
                    <ShieldCheck className="w-5 h-5 text-accent-green" />
                  ) : (
                    <ShieldX className="w-5 h-5 text-accent-red" />
                  )}
                  <div>
                    <div className="text-sm font-medium">
                      {lookupResult.isVerified
                        ? "Verified - KYC credential active"
                        : "Not Verified"}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      {lookupAddress.slice(0, 20)}...
                    </div>
                  </div>
                </div>

                {/* KYC Data from CRE Workflow C */}
                {lookupResult.audit && (
                  <div className="p-4 rounded-lg bg-surface-700/30 border border-surface-600/50 space-y-3">
                    <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-accent-cyan" />
                      KYC Data - CRE Workflow C (Identity Audit)
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-gray-500">Authorized:</span>{" "}
                        <span
                          className={
                            lookupResult.audit.authorized
                              ? "text-accent-green"
                              : "text-accent-red"
                          }
                        >
                          {lookupResult.audit.authorized ? "Yes" : "No"}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Requester Role:</span>{" "}
                        <span className="text-gray-300">
                          {lookupResult.audit.requesterRole || "-"}
                        </span>
                      </div>
                      {lookupResult.audit.identity && (
                        <>
                          <div>
                            <span className="text-gray-500">KYC Status:</span>{" "}
                            <span className="text-gray-300">
                              {lookupResult.audit.identity.status}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500">Country:</span>{" "}
                            <span className="text-gray-300">
                              {lookupResult.audit.identity.country}
                            </span>
                          </div>
                        </>
                      )}
                      {lookupResult.audit.reason && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Reason:</span>{" "}
                          <span className="text-gray-300">
                            {lookupResult.audit.reason}
                          </span>
                        </div>
                      )}
                      {lookupResult.audit.encryptedIdentity && (
                        <div className="col-span-2">
                          <span className="text-gray-500">
                            Encrypted PII:
                          </span>{" "}
                          <code className="text-accent-purple text-[10px] break-all">
                            {lookupResult.audit.encryptedIdentity.slice(0, 60)}
                            ...
                          </code>
                          <DecryptButton encryptedHex={lookupResult.audit.encryptedIdentity} />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AML Screening Summary */}
                {lookupResult.audit && (
                  <div className="p-4 rounded-lg bg-surface-700/30 border border-surface-600/50 space-y-3">
                    <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-accent-amber" />
                      AML Screening
                    </div>
                    {lookupResult.audit.amlScreening ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-500">Risk Score:</span>{" "}
                          <span
                            className={
                              (lookupResult.audit.amlScreening.riskScore ?? 0) <= 3
                                ? "text-accent-green"
                                : (lookupResult.audit.amlScreening.riskScore ?? 0) <= 6
                                ? "text-accent-amber"
                                : "text-accent-red"
                            }
                          >
                            {lookupResult.audit.amlScreening.riskScore ?? "-"}/10
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-500">
                            Sanctions Hits:
                          </span>{" "}
                          <span
                            className={
                              (lookupResult.audit.amlScreening.sanctionsHits ?? 0) === 0
                                ? "text-accent-green"
                                : "text-accent-red"
                            }
                          >
                            {lookupResult.audit.amlScreening.sanctionsHits ?? 0}
                          </span>
                        </div>
                        {lookupResult.audit.amlScreening.exposureFlags &&
                          lookupResult.audit.amlScreening.exposureFlags.length > 0 && (
                            <div className="col-span-2">
                              <span className="text-gray-500">
                                Exposure Flags:
                              </span>{" "}
                              <span className="text-accent-amber">
                                {lookupResult.audit.amlScreening.exposureFlags.join(
                                  ", "
                                )}
                              </span>
                            </div>
                          )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        {lookupResult.audit.authorized
                          ? "No AML screening data returned for this wallet."
                          : "AML data restricted - insufficient access level."}
                      </div>
                    )}
                    <p className="text-[10px] text-gray-600 mt-1">
                      All data fetched via Confidential HTTP inside TEE. PII
                      encrypted with AES-256-GCM before leaving enclave.
                    </p>
                  </div>
                )}

                {/* Error */}
                {lookupResult.error && (
                  <div className="p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-sm text-accent-red">
                    {lookupResult.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Audit Trail — on-chain compliance reports */}
          <AuditTrail />
        </>
      ) : wsName ? (
        /* Non-admin restricted view */
        <div className="card flex flex-col items-center py-10 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-700/50 flex items-center justify-center">
            <Lock className="w-7 h-7 text-gray-500" />
          </div>
          <div className="text-center">
            <p className="text-gray-300 font-medium">Protocol Admin Only</p>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              Compliance lookup requires the workspace admin wallet. Connect
              with the admin address to access KYC and AML data.
            </p>
          </div>
          <div className="text-xs text-gray-600 font-mono">
            Admin: {wsAdmin?.slice(0, 12)}...{wsAdmin?.slice(-8)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
