import { useState, useEffect } from "react";
import { usePublicClient, useReadContract } from "wagmi";
import { parseAbiItem, type Hex } from "viem";
import {
  FileCheck,
  ShieldCheck,
  ShieldX,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Hash,
  Globe,
} from "lucide-react";
import { CONTRACTS, REPORT_CONSUMER_ABI } from "../config/contracts";

interface ReportEvent {
  tradeId: string;
  trader: string;
  approved: boolean;
  riskScore: number;
  auditHash: string;
}

function ReportDetail({ tradeId, event }: { tradeId: Hex; event: ReportEvent }) {
  const { data } = useReadContract({
    address: CONTRACTS.reportConsumer,
    abi: REPORT_CONSUMER_ABI,
    functionName: "getReport",
    args: [tradeId],
  });

  // Use event data as fallback if getReport returns empty/zeroed struct
  const report = data as any;
  const isEmptyReport =
    !report ||
    !report.trader ||
    report.trader === "0x0000000000000000000000000000000000000000";
  const trader = (!isEmptyReport && report.trader) || event?.trader || "—";
  const counterparty = (!isEmptyReport && report.counterparty) || "—";
  const sourceContract = (!isEmptyReport && report.sourceContract) || "—";
  const auditHash = (!isEmptyReport && report.auditHash) || event?.auditHash || "—";
  const ipfsCid = (!isEmptyReport && report.ipfsCid) || "";
  const timestamp = !isEmptyReport ? report.timestamp : undefined;

  return (
    <div className="grid grid-cols-2 gap-2 text-xs mt-2 p-3 rounded-lg bg-surface-900/50">
      <div>
        <span className="text-gray-500">Trader:</span>{" "}
        <span className="font-mono text-gray-300">
          {typeof trader === "string" && trader.length > 10
            ? `${trader.slice(0, 10)}...${trader.slice(-6)}`
            : trader}
        </span>
      </div>
      <div>
        <span className="text-gray-500">Counterparty:</span>{" "}
        <span className="font-mono text-gray-300">
          {typeof counterparty === "string" && counterparty.length > 10
            ? `${counterparty.slice(0, 10)}...${counterparty.slice(-6)}`
            : counterparty}
        </span>
      </div>
      <div>
        <span className="text-gray-500">Source Contract:</span>{" "}
        <span className="font-mono text-gray-300">
          {typeof sourceContract === "string" && sourceContract.length > 10
            ? `${sourceContract.slice(0, 10)}...${sourceContract.slice(-6)}`
            : sourceContract}
        </span>
      </div>
      <div>
        <span className="text-gray-500">Timestamp:</span>{" "}
        <span className="text-gray-300">
          {timestamp ? new Date(Number(timestamp) * 1000).toLocaleString() : "—"}
        </span>
      </div>
      <div className="col-span-2">
        <span className="text-gray-500">Audit Hash:</span>{" "}
        <span className="font-mono text-accent-cyan text-[10px] break-all">{auditHash}</span>
      </div>
      <div className="col-span-2">
        <span className="text-gray-500">Trade ID:</span>{" "}
        <span className="font-mono text-gray-400 text-[10px] break-all">{tradeId}</span>
      </div>
      {ipfsCid && (
        <div className="col-span-2">
          <span className="text-gray-500">IPFS:</span>{" "}
          <a
            href={`https://gateway.pinata.cloud/ipfs/${ipfsCid}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue text-[10px] font-mono inline-flex items-center gap-0.5 hover:underline"
          >
            {ipfsCid} <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}
      {!ipfsCid && (
        <div className="col-span-2">
          <span className="text-gray-500">IPFS:</span>{" "}
          <span className="text-gray-600 text-[10px]">Not uploaded (Pinata integration pending)</span>
        </div>
      )}
      <div className="col-span-2">
        <a
          href={`https://testnet.arcscan.app/address/${CONTRACTS.reportConsumer}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-blue text-[10px] inline-flex items-center gap-0.5 hover:underline"
        >
          View on ArcScan <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>
    </div>
  );
}

export default function AuditTrail() {
  const client = usePublicClient();
  const [reports, setReports] = useState<ReportEvent[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    (async () => {
      try {
        const latest = await client.getBlockNumber();
        const fromBlock = latest > 9000n ? latest - 9000n : 0n;
        const logs = await client.getLogs({
          address: CONTRACTS.reportConsumer,
          event: parseAbiItem(
            "event ComplianceCheckCompleted(bytes32 indexed tradeId, address indexed trader, bool approved, uint8 riskScore, bytes32 auditHash)"
          ),
          fromBlock,
        });
        setReports(
          logs
            .filter((l) => l.args.tradeId && l.args.trader)
            .map((l) => ({
              tradeId: l.args.tradeId as string,
              trader: l.args.trader as string,
              approved: l.args.approved as boolean,
              riskScore: Number(l.args.riskScore ?? 0),
              auditHash: (l.args.auditHash as string) ?? "—",
            }))
            .reverse()
        );
      } catch {
        /* silently fail */
      }
    })();
  }, [client]);

  return (
    <div className="card space-y-4">
      <h2 className="font-semibold flex items-center gap-2">
        <FileCheck className="w-5 h-5 text-accent-amber" />
        Audit Trail
        <span className="text-xs text-gray-500 font-normal">({reports.length} reports)</span>
      </h2>
      <p className="text-xs text-gray-400">
        Per-trade compliance reports from CRE Workflow B. On-chain data is public and hash-verified.
        Full AuditRecords stored on IPFS (when available).
      </p>

      {reports.length === 0 ? (
        <div className="text-center py-6">
          <Hash className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No compliance reports yet</p>
          <p className="text-xs text-gray-600 mt-1">Reports appear after per-trade compliance checks via CRE Workflow B</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.tradeId} className="rounded-lg bg-surface-700/30 hover:bg-surface-700/50 transition-colors">
              <button
                onClick={() => setExpanded(expanded === r.tradeId ? null : r.tradeId)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="flex items-center gap-3">
                  {r.approved ? (
                    <ShieldCheck className="w-4 h-4 text-accent-green flex-shrink-0" />
                  ) : (
                    <ShieldX className="w-4 h-4 text-accent-red flex-shrink-0" />
                  )}
                  <div>
                    <div className="font-mono text-xs text-gray-300">
                      {r.tradeId.slice(0, 10)}...{r.tradeId.slice(-6)}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      {r.trader.slice(0, 8)}...{r.trader.slice(-4)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    r.approved
                      ? "bg-accent-green/20 text-accent-green"
                      : "bg-accent-red/20 text-accent-red"
                  }`}>
                    {r.approved ? "Approved" : "Rejected"}
                  </span>
                  <span className="text-xs text-gray-400">Risk: {r.riskScore}</span>
                  {expanded === r.tradeId ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </button>
              {expanded === r.tradeId && (
                <div className="px-3 pb-3">
                  <ReportDetail tradeId={r.tradeId as Hex} event={r} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-surface-700/30 flex items-start gap-2">
          <Globe className="w-4 h-4 text-accent-cyan flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-medium">On-chain (public)</div>
            <div className="text-[10px] text-gray-500">ComplianceReport + auditHash, DON-signed</div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-700/30 flex items-start gap-2">
          <FileCheck className="w-4 h-4 text-accent-amber flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-medium">IPFS (hash-verified)</div>
            <div className="text-[10px] text-gray-500">Full AuditRecord, content-addressed</div>
          </div>
        </div>
      </div>
    </div>
  );
}
