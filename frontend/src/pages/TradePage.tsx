import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from "wagmi";
import { parseUnits, formatUnits, type Address, parseAbiItem } from "viem";
import {
  ArrowRightLeft,
  ShieldCheck,
  ShieldX,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Shield,
} from "lucide-react";
import { CONTRACTS, ESCROW_SWAP_ABI, ERC20_ABI } from "../config/contracts";
import { useIsVerified } from "../hooks/useComplianceStatus";
import ProtocolMetrics from "../components/ProtocolMetrics";

const BACKEND_URL = (import.meta as any).env?.VITE_BACKEND_URL || "http://localhost:3001";

interface OrderEvent {
  orderId: string;
  maker: string;
  amountIn: bigint;
  filled: boolean;
}

type TradeStep = { label: string; status: "pending" | "active" | "done" | "error"; detail?: string };

export default function TradePage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const { data: isVerified, isLoading: verifyLoading } = useIsVerified(address);
  const [amount, setAmount] = useState("1");
  const [orders, setOrders] = useState<OrderEvent[]>([]);
  const [steps, setSteps] = useState<TradeStep[]>([]);
  const [fillSteps, setFillSteps] = useState<TradeStep[]>([]);
  const [fillingOrderId, setFillingOrderId] = useState<string | null>(null);

  // Approval
  const { writeContract: approve, data: approveTx } = useWriteContract();
  const { isLoading: approving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTx });

  // Create order
  const { writeContract: createOrder, data: createTx } = useWriteContract();
  const { isLoading: creating, isSuccess: createSuccess } = useWaitForTransactionReceipt({ hash: createTx });

  // Fill order (async — emits ComplianceCheckRequested for CRE)
  const { writeContract: fillOrder, data: fillTx } = useWriteContract();
  const { isLoading: filling, isSuccess: fillSuccess } = useWaitForTransactionReceipt({ hash: fillTx });

  // USDC balance + allowance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.usdc, abi: ERC20_ABI, functionName: "balanceOf",
    args: address ? [address] : undefined, query: { enabled: !!address },
  });
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACTS.usdc, abi: ERC20_ABI, functionName: "allowance",
    args: address ? [address, CONTRACTS.escrowSwap] : undefined, query: { enabled: !!address },
  });

  const amountWei = parseUnits(amount || "0", 6);
  const hasAllowance = typeof allowance === "bigint" && allowance >= amountWei && amountWei > 0n;

  // Fetch recent orders
  useEffect(() => {
    if (!client) return;
    (async () => {
      try {
        const latest = await client.getBlockNumber();
        const fromBlock = latest > 9000n ? latest - 9000n : 0n;
        const [createLogs, fillLogs] = await Promise.all([
          client.getLogs({ address: CONTRACTS.escrowSwap, event: parseAbiItem("event OrderCreated(bytes32 indexed orderId, address indexed maker, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)"), fromBlock }),
          client.getLogs({ address: CONTRACTS.escrowSwap, event: parseAbiItem("event OrderFilled(bytes32 indexed orderId, address indexed maker, address indexed taker)"), fromBlock }),
        ]);
        const filledIds = new Set(fillLogs.map(l => l.args.orderId as string));
        setOrders(createLogs.map(l => ({
          orderId: l.args.orderId as string, maker: l.args.maker as string,
          amountIn: l.args.amountIn as bigint, filled: filledIds.has(l.args.orderId as string),
        })).reverse());
      } catch {}
    })();
  }, [client, createSuccess, fillSuccess]);

  useEffect(() => {
    if (createSuccess || fillSuccess || approveSuccess) { refetchBalance(); refetchAllowance(); }
  }, [createSuccess, fillSuccess, approveSuccess, refetchBalance, refetchAllowance]);

  // --- Create Order flow with step tracking ---
  useEffect(() => {
    if (creating) {
      setSteps([
        { label: "Checking isVerified(wallet) on-chain", status: "done" },
        { label: "Depositing USDC into escrow", status: "active" },
        { label: "Order ready for compliance check", status: "pending" },
      ]);
    }
    if (createSuccess && createTx) {
      setSteps([
        { label: "isVerified(wallet) = true", status: "done" },
        { label: "USDC deposited into escrow", status: "done", detail: createTx },
        { label: "Order open — waiting for taker to fill", status: "done" },
      ]);
    }
  }, [creating, createSuccess, createTx]);

  // --- Fill Order flow: fillOrderAsync → CRE Workflow B ---
  useEffect(() => {
    if (fillSuccess && fillTx && fillingOrderId) {
      // fillOrderAsync succeeded → now trigger CRE Workflow B via backend
      setFillSteps([
        { label: "Taker USDC deposited into escrow", status: "done", detail: fillTx },
        { label: "ComplianceCheckRequested event emitted", status: "done" },
        { label: "CRE Workflow B: per-trade compliance check...", status: "active" },
        { label: "Trade settlement", status: "pending" },
      ]);

      // Trigger CRE Workflow B via backend
      // Try event indices 0-3 (fillOrderAsync emits Transfer events before ComplianceCheckRequested)
      (async () => {
        let data: any = null;
        let lastError = "";

        for (const eventIndex of [0, 1, 2, 3]) {
          try {
            const resp = await fetch(`${BACKEND_URL}/api/compliance/check`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ txHash: fillTx, eventIndex }),
            });
            const result = await resp.json();
            // Check if we got a real CRE result (has tradeId or approved field)
            if (result.tradeId || result.approved !== undefined) {
              data = result;
              break;
            }
            lastError = result.error || result.details || "Unknown error";
          } catch (err: any) {
            lastError = err.message;
          }
        }

        if (data) {
          const approved = data.approved === true;
          setFillSteps([
            { label: "Taker USDC deposited into escrow", status: "done", detail: fillTx },
            { label: "ComplianceCheckRequested event emitted", status: "done" },
            { label: `CRE Workflow B: ${approved ? "APPROVED" : "REJECTED"} — risk score: ${data.riskScore ?? 0}`, status: "done" },
            { label: approved
                ? "Trade settled via onComplianceApproved() auto-callback"
                : `Rejected: ${(data.flags || []).join(", ") || "KYC not approved"}`,
              status: approved ? "done" : "error" },
          ]);
        } else {
          setFillSteps([
            { label: "Taker USDC deposited into escrow", status: "done", detail: fillTx },
            { label: "ComplianceCheckRequested event emitted", status: "done" },
            { label: `CRE Workflow B: ${lastError.slice(0, 80)}`, status: "error" },
            { label: "Trade pending — CRE could not process event", status: "error" },
          ]);
        }
      })();
    }
  }, [fillSuccess, fillTx, fillingOrderId]);

  const handleApprove = () => {
    approve({
      address: CONTRACTS.usdc, abi: ERC20_ABI, functionName: "approve",
      args: [CONTRACTS.escrowSwap, BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")],
    });
  };

  const handleCreateOrder = () => {
    setSteps([{ label: "Checking isVerified(wallet) on-chain", status: "active" }]);
    createOrder({
      address: CONTRACTS.escrowSwap, abi: ESCROW_SWAP_ABI, functionName: "createOrder",
      args: [
        "0x0000000000000000000000000000000000000000" as Address,
        CONTRACTS.usdc, CONTRACTS.usdc,
        parseUnits(amount || "0", 6), parseUnits(amount || "0", 6),
      ],
    });
  };

  const handleFillAsync = (orderId: string) => {
    setFillingOrderId(orderId);
    setFillSteps([
      { label: "Depositing taker USDC + emitting ComplianceCheckRequested", status: "active" },
      { label: "ComplianceCheckRequested event", status: "pending" },
      { label: "CRE Workflow B: per-trade compliance check", status: "pending" },
      { label: "Trade settlement", status: "pending" },
    ]);
    fillOrder({
      address: CONTRACTS.escrowSwap, abi: ESCROW_SWAP_ABI, functionName: "fillOrderAsync",
      args: [orderId as `0x${string}`],
    });
  };

  const StepTracker = ({ steps: s }: { steps: TradeStep[] }) => (
    <div className="space-y-2 p-3 rounded-lg bg-surface-700/20 border border-surface-600/30">
      {s.map((step, i) => (
        <div key={i} className="flex items-start gap-2">
          {step.status === "done" ? <CheckCircle2 className="w-4 h-4 text-accent-green flex-shrink-0 mt-0.5" /> :
           step.status === "active" ? <Loader2 className="w-4 h-4 text-accent-blue animate-spin flex-shrink-0 mt-0.5" /> :
           step.status === "error" ? <ShieldX className="w-4 h-4 text-accent-red flex-shrink-0 mt-0.5" /> :
           <div className="w-4 h-4 rounded-full border border-gray-600 flex-shrink-0 mt-0.5" />}
          <div>
            <p className={`text-xs ${step.status === "done" ? "text-accent-green" : step.status === "active" ? "text-accent-blue" : step.status === "error" ? "text-accent-red" : "text-gray-500"}`}>
              {step.label}
            </p>
            {step.detail && (
              <a href={`https://testnet.arcscan.app/tx/${step.detail}`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-gray-500 hover:text-accent-blue font-mono inline-flex items-center gap-0.5">
                {step.detail.slice(0, 14)}... <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Trade</h1>
          <p className="text-gray-400 text-xs mt-0.5">USDC escrow swap with on-chain compliance gating</p>
        </div>
        {verifyLoading ? <span className="badge-pending">Checking...</span> :
         isVerified ? <span className="badge-verified flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> KYC Verified</span> :
         <span className="badge-rejected flex items-center gap-1"><ShieldX className="w-3 h-3" /> Not Verified</span>}
      </div>

      <ProtocolMetrics />

      {!isVerified && !verifyLoading && (
        <div className="card flex items-start gap-3 border-accent-red/30">
          <AlertCircle className="w-5 h-5 text-accent-red flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-accent-red">KYC Required</p>
            <p className="text-xs text-gray-400 mt-1">
              Go to <strong>Integrator</strong> page to verify. The contract calls <code className="text-accent-blue">require(isVerified(msg.sender))</code>.
            </p>
          </div>
        </div>
      )}

      {/* Create Order */}
      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-accent-blue" />
          Create Escrow Order
        </h2>
        <p className="text-xs text-gray-400">
          Deposit USDC into escrow. Contract checks <code className="text-accent-green">isVerified(msg.sender)</code> — your on-chain KYC credential from CRE Workflow A.
        </p>

        <div>
          <label className="text-sm text-gray-400 block mb-1">Amount (USDC)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-base" placeholder="1" />
        </div>

        {!hasAllowance ? (
          <button onClick={handleApprove} disabled={approving} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50 w-full">
            {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {approving ? "Approving USDC..." : "1. Approve USDC"}
          </button>
        ) : (
          <button onClick={handleCreateOrder} disabled={!isVerified || creating} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50 w-full">
            {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
            {creating ? "Creating..." : "Create Order"}
          </button>
        )}
        {hasAllowance && <p className="text-xs text-accent-green flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> USDC approved</p>}

        {steps.length > 0 && <StepTracker steps={steps} />}
      </div>

      {/* Order Book + Fill */}
      <div className="card space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent-purple" />
          Order Book — Per-Trade Compliance
          <span className="text-xs bg-accent-purple/20 text-accent-purple px-2 py-0.5 rounded-full">CRE Workflow B</span>
        </h2>
        <p className="text-xs text-gray-400">
          Clicking <strong>Fill (Async)</strong> calls <code>fillOrderAsync()</code> which emits <code>ComplianceCheckRequested</code>.
          The backend triggers CRE Workflow B — Confidential HTTP to Sumsub + Chainalysis — then auto-callback settles the trade.
        </p>

        {orders.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No orders yet. Create one above.</p>
        ) : (
          <div className="space-y-2">
            {orders.slice(0, 10).map((o) => (
              <div key={o.orderId} className="flex items-center justify-between p-3 rounded-lg bg-surface-700/30 hover:bg-surface-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${o.filled ? "bg-accent-green" : "bg-accent-blue animate-pulse"}`} />
                  <div>
                    <div className="font-mono text-xs text-gray-300">{o.orderId.slice(0, 10)}...{o.orderId.slice(-6)}</div>
                    <div className="text-xs text-gray-500">{o.maker.slice(0, 8)}...{o.maker.slice(-4)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{formatUnits(o.amountIn, 6)} USDC</span>
                  {o.filled ? (
                    <span className="badge-verified text-xs">Filled</span>
                  ) : fillingOrderId === o.orderId && (filling || fillSteps.length > 0) ? (
                    <span className="text-xs text-accent-blue flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking...</span>
                  ) : (
                    <button
                      onClick={() => handleFillAsync(o.orderId)}
                      disabled={!isVerified || filling}
                      className="btn-primary text-xs py-1 px-3 disabled:opacity-50"
                    >
                      Fill (Async)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {fillSteps.length > 0 && <StepTracker steps={fillSteps} />}
      </div>

      {/* How it works */}
      <div className="card-glass space-y-3">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Two Compliance Patterns</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-accent-green/20 text-accent-green flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
            <div>
              <div className="font-medium text-sm">Synchronous (Create Order)</div>
              <div className="text-gray-400 mt-0.5"><code>require(isVerified(msg.sender))</code> — reads on-chain KYC credential. Instant, no CRE at trade time.</div>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-accent-purple/20 text-accent-purple flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
            <div>
              <div className="font-medium text-sm">Async Per-Trade (Fill Order)</div>
              <div className="text-gray-400 mt-0.5"><code>fillOrderAsync()</code> emits event → CRE Workflow B runs Sumsub + Chainalysis checks in TEE → auto-callback settles.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
