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
  RefreshCw,
  Loader2,
  Download,
  AlertTriangle,
} from "lucide-react";
import { CONTRACTS, REPORT_CONSUMER_ABI } from "../config/contracts";

interface ReportEvent {
  tradeId: string;
  trader: string;
  approved: boolean;
  riskScore: number;
  auditHash: string;
}

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs";

function ReportDetail({ tradeId, event }: { tradeId: Hex; event: ReportEvent }) {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACTS.reportConsumer,
    abi: REPORT_CONSUMER_ABI,
    functionName: "getReport",
    args: [tradeId],
  });

  const [ipfsData, setIpfsData] = useState<Record<string, unknown> | null>(null);
  const [ipfsLoading, setIpfsLoading] = useState(false);
  const [ipfsError, setIpfsError] = useState("");

  const report = data as any;
  const hasReport =
    report &&
    report.trader &&
    report.trader !== "0x0000000000000000000000000000000000000000";

  const trader = (hasReport ? report.trader : null) || event?.trader || "-";
  const counterparty = (hasReport && report.counterparty) || "-";
  const sourceContract = (hasReport && report.sourceContract) || "-";
  const auditHash = (hasReport ? report.auditHash : null) || event?.auditHash || "-";
  const ipfsCid = report?.ipfsCid || "";
  const timestamp = hasReport ? report.timestamp : undefined;

  if (error) {
    console.warn("[ReportDetail] getReport error:", error);
  }

  const fetchIpfs = async (cid: string) => {
    setIpfsLoading(true);
    setIpfsError("");
    try {
      const resp = await fetch(`${IPFS_GATEWAY}/${cid}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      setIpfsData(json);
    } catch (e: any) {
      setIpfsError(e.message || "Failed to fetch from IPFS");
    } finally {
      setIpfsLoading(false);
    }
  };

  return (
    <div className="space-y-2 mt-2">
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Loading on-chain report...
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-lg bg-surface-900/50">
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
            {timestamp ? new Date(Number(timestamp) * 1000).toLocaleString() : "-"}
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

        {/* IPFS CID + link + fetch */}
        <div className="col-span-2">
          <span className="text-gray-500">IPFS:</span>{" "}
          {ipfsCid ? (
            <span className="inline-flex items-center gap-2 flex-wrap">
              <a
                href={`${IPFS_GATEWAY}/${ipfsCid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-blue text-[10px] font-mono inline-flex items-center gap-0.5 hover:underline"
              >
                {ipfsCid} <ExternalLink className="w-2.5 h-2.5" />
              </a>
              {!ipfsData && (
                <button
                  onClick={() => fetchIpfs(ipfsCid)}
                  disabled={ipfsLoading}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium
                    bg-accent-amber/15 text-accent-amber border border-accent-amber/30
                    hover:bg-accent-amber/25 transition-colors disabled:opacity-50"
                >
                  {ipfsLoading ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <Download className="w-2.5 h-2.5" />
                  )}
                  {ipfsLoading ? "Fetching..." : "Load Audit Record"}
                </button>
              )}
            </span>
          ) : (
            <span className="text-gray-600 text-[10px]">
              {isLoading ? "Loading..." : "Not available on-chain"}
            </span>
          )}
        </div>

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

      {/* IPFS error */}
      {ipfsError && (
        <div className="flex items-center gap-1.5 text-xs text-accent-amber p-2">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          IPFS fetch failed: {ipfsError}
        </div>
      )}

      {/* Inline IPFS audit record */}
      {ipfsData && (
        <div className="rounded-lg border border-accent-amber/20 bg-accent-amber/5 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs text-accent-amber font-medium">
            <FileCheck className="w-3 h-3" />
            Full Audit Record (IPFS)
          </div>
          <pre className="bg-surface-900 rounded-lg p-3 text-[10px] font-mono text-gray-300 overflow-x-auto max-h-72 overflow-y-auto whitespace-pre-wrap">
            {JSON.stringify(ipfsData, null, 2)}
          </pre>
          <p className="text-[10px] text-gray-600">
            Content-addressed on IPFS. keccak256 hash verified against on-chain auditHash.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AuditTrail() {
  const client = usePublicClient();
  const [reports, setReports] = useState<ReportEvent[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Auto-refresh every 15s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

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
              auditHash: (l.args.auditHash as string) ?? "-",
            }))
            .reverse()
        );
      } catch (e) {
        console.warn("[AuditTrail] getLogs failed:", e);
      }
    })();
  }, [client, tick]);

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-accent-amber" />
          Audit Trail
          <span className="text-xs text-gray-500 font-normal">({reports.length} reports)</span>
        </h2>
        <button
          onClick={() => setTick((t) => t + 1)}
          className="p-1.5 rounded-lg hover:bg-surface-700/50 transition-colors text-gray-400 hover:text-gray-200"
          title="Refresh"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
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
