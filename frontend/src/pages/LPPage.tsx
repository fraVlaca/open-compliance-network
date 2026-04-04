import { useState, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  TrendingUp,
  UserPlus,
  Search,
  FileCheck,
  ExternalLink,
  Loader2,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { type Address } from "viem";
import { CONTRACTS, INTEGRATOR_REGISTRY_ABI, REPORT_CONSUMER_ABI } from "../config/contracts";
import { useIntegrator, useIsVerified, ROLE_NAMES } from "../hooks/useComplianceStatus";
import { useReadContract } from "wagmi";

export default function LPPage() {
  const { address } = useAccount();
  const { data: integrator, refetch } = useIntegrator(address);
  const [workspaceId, setWorkspaceId] = useState("");
  const [tradeId, setTradeId] = useState("");
  const [lookupAddress, setLookupAddress] = useState("");
  const [confirmedLookup, setConfirmedLookup] = useState<Address | undefined>();

  const { writeContract, data: tx } = useWriteContract();
  const { isLoading, isSuccess } = useWaitForTransactionReceipt({ hash: tx });

  useEffect(() => {
    if (isSuccess) refetch();
  }, [isSuccess, refetch]);

  const [appId, wsId, role, active] = (integrator as [string, string, number, boolean]) ?? [];
  const isRegistered = active === true;

  // Trade report lookup
  const { data: report, refetch: refetchReport } = useReadContract({
    address: CONTRACTS.reportConsumer,
    abi: REPORT_CONSUMER_ABI,
    functionName: "getReport",
    args: tradeId ? [tradeId as `0x${string}`] : undefined,
    query: { enabled: false },
  });

  // Only queries when confirmedLookup is set (on button click)
  const { data: userVerified } = useIsVerified(confirmedLookup);

  const handleJoin = () => {
    if (!workspaceId) return;
    writeContract({
      address: CONTRACTS.integratorRegistry,
      abi: INTEGRATOR_REGISTRY_ABI,
      functionName: "joinWorkspace",
      args: [workspaceId as `0x${string}`, 2], // role: LP
    });
  };

  const handleLookupTrade = () => {
    if (tradeId) refetchReport();
  };

  const handleLookupUser = () => {
    if (lookupAddress) setConfirmedLookup(lookupAddress as Address);
  };

  const reportData = report as {
    tradeId: string;
    trader: Address;
    counterparty: Address;
    approved: boolean;
    riskScore: number;
    auditHash: string;
    ipfsCid: string;
    timestamp: bigint;
  } | undefined;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-accent-green" />
          LP Dashboard
        </h1>
        <p className="text-gray-400 mt-1">
          Join a workspace as LP, check user compliance, and access trade audit
          trails
        </p>
      </div>

      {isRegistered ? (
        <>
          {/* Status */}
          <div className="card flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent-green/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-accent-green" />
            </div>
            <div className="flex-1">
              <div className="font-medium">{ROLE_NAMES[role]} — Active</div>
              <div className="text-sm text-gray-400 font-mono">
                APP-ID: {appId?.slice(0, 16)}...
              </div>
            </div>
            <span className="badge-verified">{ROLE_NAMES[role]}</span>
          </div>

          {/* User Compliance Check */}
          <div className="card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent-blue" />
              Check User Compliance
            </h2>
            <p className="text-sm text-gray-400">
              Verify that a counterparty has a valid KYC credential before
              filling their order.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={lookupAddress}
                onChange={(e) => setLookupAddress(e.target.value)}
                className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-accent-blue"
                placeholder="0x... wallet address"
              />
              <button onClick={handleLookupUser} className="btn-primary">
                <Search className="w-4 h-4" />
              </button>
            </div>
            {lookupAddress && userVerified !== undefined && (
              <div
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  userVerified
                    ? "bg-accent-green/10 border border-accent-green/20"
                    : "bg-accent-red/10 border border-accent-red/20"
                }`}
              >
                {userVerified ? (
                  <ShieldCheck className="w-5 h-5 text-accent-green" />
                ) : (
                  <ShieldX className="w-5 h-5 text-accent-red" />
                )}
                <span className="text-sm">
                  {userVerified ? "Verified — safe to trade" : "Not verified"}
                </span>
              </div>
            )}
          </div>

          {/* Trade Audit Trail */}
          <div className="card space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-accent-amber" />
              Trade Audit Trail
            </h2>
            <p className="text-sm text-gray-400">
              Look up the compliance report for any trade. The full audit record
              is on IPFS — fetch by CID and verify against the on-chain hash.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={tradeId}
                onChange={(e) => setTradeId(e.target.value)}
                className="flex-1 bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-accent-blue"
                placeholder="0x... trade ID"
              />
              <button onClick={handleLookupTrade} className="btn-primary">
                <Search className="w-4 h-4" />
              </button>
            </div>

            {reportData && reportData.timestamp > 0n && (
              <div className="space-y-3 p-4 rounded-lg bg-surface-700/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    Compliance Report
                  </span>
                  {reportData.approved ? (
                    <span className="badge-verified">Approved</span>
                  ) : (
                    <span className="badge-rejected">Rejected</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-400">Trader:</span>
                    <div className="font-mono text-xs truncate">
                      {reportData.trader}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Counterparty:</span>
                    <div className="font-mono text-xs truncate">
                      {reportData.counterparty}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Risk Score:</span>
                    <div>{reportData.riskScore}/10</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Timestamp:</span>
                    <div>
                      {new Date(
                        Number(reportData.timestamp) * 1000
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Audit Hash + IPFS */}
                <div className="pt-3 border-t border-surface-600 space-y-2">
                  <div>
                    <span className="text-xs text-gray-400">Audit Hash:</span>
                    <div className="font-mono text-xs truncate text-gray-300">
                      {reportData.auditHash}
                    </div>
                  </div>
                  {reportData.ipfsCid && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        IPFS Record:
                      </span>
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${reportData.ipfsCid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent-blue hover:underline flex items-center gap-1"
                      >
                        {reportData.ipfsCid.slice(0, 20)}...
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Join Workspace */
        <div className="card space-y-6 max-w-lg">
          <h2 className="text-lg font-semibold">Join as Liquidity Provider</h2>
          <p className="text-sm text-gray-400">
            Enter the workspace ID to register as an LP. You'll be able to check
            compliance status of traders and access audit trails for trades you
            fill.
          </p>
          <div>
            <label className="text-sm text-gray-400 block mb-1">
              Workspace ID
            </label>
            <input
              type="text"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-accent-blue"
              placeholder="0x411f2547..."
            />
          </div>
          <button
            onClick={handleJoin}
            disabled={!workspaceId || isLoading}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <UserPlus className="w-4 h-4" />
            )}
            {isLoading ? "Joining..." : "Join as LP"}
          </button>
        </div>
      )}
    </div>
  );
}
