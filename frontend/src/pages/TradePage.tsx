import { useState, useEffect, useMemo } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, usePublicClient } from "wagmi";
import { parseUnits, formatUnits, type Address, parseAbiItem } from "viem";
import {
  ArrowRightLeft,
  Shield,
  ShieldCheck,
  ShieldX,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Download,
} from "lucide-react";
import { CONTRACTS, ESCROW_SWAP_ABI, ERC20_ABI } from "../config/contracts";
import { useIsVerified } from "../hooks/useComplianceStatus";
import ComplianceFlowTracker, { type FlowStep } from "../components/ComplianceFlowTracker";
import ProtocolMetrics from "../components/ProtocolMetrics";

const ORDER_STATUS = ["None", "Open", "Pending", "Filled", "Cancelled", "Rejected"] as const;
const STATUS_COLORS: Record<string, string> = {
  Open: "badge-pending",
  Filled: "badge-verified",
  Cancelled: "text-gray-500 bg-gray-500/10 text-xs font-medium px-2 py-0.5 rounded-full",
  Rejected: "badge-rejected",
  Pending: "bg-accent-blue/20 text-accent-blue text-xs font-medium px-2 py-0.5 rounded-full",
};

interface OrderEvent {
  orderId: string;
  maker: string;
  amountIn: bigint;
  blockNumber: bigint;
  filled: boolean;
}

export default function TradePage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const { data: isVerified, isLoading: verifyLoading } = useIsVerified(address);
  const [amount, setAmount] = useState("100");
  const [counterparty, setCounterparty] = useState("");
  const [fillOrderId, setFillOrderId] = useState("");
  const [orders, setOrders] = useState<OrderEvent[]>([]);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);

  // Approval
  const { writeContract: approve, data: approveTx } = useWriteContract();
  const { isLoading: approving, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveTx });

  // Create order
  const { writeContract: createOrder, data: createTx } = useWriteContract();
  const { isLoading: creating, isSuccess: createSuccess } = useWaitForTransactionReceipt({ hash: createTx });

  // Fill order
  const { writeContract: fillOrder, data: fillTx } = useWriteContract();
  const { isLoading: filling, isSuccess: fillSuccess } = useWaitForTransactionReceipt({ hash: fillTx });

  // USDC balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: CONTRACTS.usdc,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Fetch recent orders from events
  useEffect(() => {
    if (!client) return;
    async function fetchOrders() {
      try {
        const [createLogs, fillLogs] = await Promise.all([
          client!.getLogs({
            address: CONTRACTS.escrowSwap,
            event: parseAbiItem("event OrderCreated(bytes32 indexed orderId, address indexed maker, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut)"),
            fromBlock: 0n,
          }),
          client!.getLogs({
            address: CONTRACTS.escrowSwap,
            event: parseAbiItem("event OrderFilled(bytes32 indexed orderId, address indexed maker, address indexed taker)"),
            fromBlock: 0n,
          }),
        ]);

        const filledIds = new Set(fillLogs.map(l => l.args.orderId as string));

        const parsed = createLogs.map(l => ({
          orderId: l.args.orderId as string,
          maker: l.args.maker as string,
          amountIn: l.args.amountIn as bigint,
          blockNumber: l.blockNumber,
          filled: filledIds.has(l.args.orderId as string),
        })).reverse(); // newest first

        setOrders(parsed);
      } catch { /* silently fail */ }
    }
    fetchOrders();
  }, [client, createSuccess, fillSuccess]);

  // Refresh balance after tx
  useEffect(() => {
    if (createSuccess || fillSuccess || approveSuccess) refetchBalance();
  }, [createSuccess, fillSuccess, approveSuccess, refetchBalance]);

  // Flow tracker for create order
  useEffect(() => {
    if (creating) {
      setFlowSteps([
        { label: "Checking isVerified(wallet)", status: "done" },
        { label: "Compliance check passed", status: "done" },
        { label: "Creating escrow order on-chain...", status: "active" },
      ]);
    } else if (createSuccess && createTx) {
      setFlowSteps([
        { label: "Checking isVerified(wallet)", status: "done" },
        { label: "Compliance check passed", status: "done" },
        { label: "Escrow order created", status: "done", detail: createTx },
      ]);
    }
  }, [creating, createSuccess, createTx]);

  const handleApprove = () => {
    approve({
      address: CONTRACTS.usdc,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACTS.escrowSwap, parseUnits(amount || "0", 6)],
    });
  };

  const handleCreateOrder = () => {
    setFlowSteps([
      { label: "Checking isVerified(wallet)", status: "active" },
      { label: "Compliance check", status: "pending" },
      { label: "Creating escrow order", status: "pending" },
    ]);
    setTimeout(() => {
      createOrder({
        address: CONTRACTS.escrowSwap,
        abi: ESCROW_SWAP_ABI,
        functionName: "createOrder",
        args: [
          (counterparty || "0x0000000000000000000000000000000000000000") as Address,
          CONTRACTS.usdc,
          CONTRACTS.usdc,
          parseUnits(amount || "0", 6),
          parseUnits(amount || "0", 6),
        ],
      });
    }, 500);
  };

  const handleFillOrder = () => {
    if (!fillOrderId) return;
    fillOrder({
      address: CONTRACTS.escrowSwap,
      abi: ESCROW_SWAP_ABI,
      functionName: "fillOrder",
      args: [fillOrderId as `0x${string}`],
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trade</h1>
          <p className="text-gray-400 mt-1">USDC escrow swap with compliance gating on Arc</p>
        </div>
      </div>

      {/* Live metrics */}
      <ProtocolMetrics />

      {/* Compliance Status */}
      <div className="card flex items-center justify-between">
        <div className="flex items-center gap-4">
          {verifyLoading ? (
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          ) : isVerified ? (
            <ShieldCheck className="w-8 h-8 text-accent-green" />
          ) : (
            <ShieldX className="w-8 h-8 text-accent-red" />
          )}
          <div>
            <div className="font-medium">
              {verifyLoading ? "Checking..." : isVerified ? "Identity Verified" : "Not Verified"}
            </div>
            <div className="text-sm text-gray-400">
              {isVerified
                ? "Your wallet has a valid KYC credential. You can trade."
                : "Complete KYC verification on the Integrator page first."}
            </div>
          </div>
        </div>
        {isVerified && <span className="badge-verified">Verified</span>}
      </div>

      {/* Balance */}
      <div className="card">
        <div className="text-sm text-gray-400">USDC Balance</div>
        <div className="text-3xl font-bold mt-1">
          {balance && typeof balance === "bigint" ? formatUnits(balance, 6) : "0.00"}{" "}
          <span className="text-lg text-gray-400">USDC</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Create Order */}
        <div className="card space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-accent-blue" />
            Create Order
          </h2>

          {!isVerified && !verifyLoading && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20">
              <AlertCircle className="w-4 h-4 text-accent-red flex-shrink-0" />
              <p className="text-xs text-accent-red">KYC required. Go to Integrator page to verify.</p>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-sm text-gray-400 block mb-1">Amount (USDC)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-accent-blue" placeholder="100" />
            </div>
            <div>
              <label className="text-sm text-gray-400 block mb-1">Counterparty (0x0 = open)</label>
              <input type="text" value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
                className="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-accent-blue" placeholder="0x000...000" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={handleApprove} disabled={approving} className="btn-secondary text-sm flex items-center gap-1.5">
              {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {approving ? "Approving..." : "Approve"}
            </button>
            <button onClick={handleCreateOrder} disabled={!isVerified || creating} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
              {creating ? "Creating..." : "Create Order"}
            </button>
          </div>

          {flowSteps.length > 0 && <ComplianceFlowTracker steps={flowSteps} />}
        </div>

        {/* Fill Order */}
        <div className="card space-y-5">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Download className="w-5 h-5 text-accent-green" />
            Fill Order
          </h2>
          <p className="text-sm text-gray-400">
            Fill an existing order as LP/taker. Requires KYC verification.
          </p>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Order ID</label>
            <input type="text" value={fillOrderId} onChange={(e) => setFillOrderId(e.target.value)}
              className="w-full bg-surface-700 border border-surface-600 rounded-lg px-4 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-accent-blue" placeholder="0x..." />
          </div>
          <button onClick={handleFillOrder} disabled={!isVerified || filling || !fillOrderId} className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
            {filling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {filling ? "Filling..." : "Fill Order"}
          </button>
          {fillTx && (
            <div className="p-3 rounded-lg bg-accent-green/10 border border-accent-green/20">
              <p className="text-xs text-accent-green">
                Order filled!{" "}
                <a href={`https://testnet.arcscan.app/tx/${fillTx}`} target="_blank" rel="noopener noreferrer" className="underline">
                  View on ArcScan
                </a>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Order History */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-gray-400" />
          Recent Orders
          <span className="text-xs text-gray-500 font-normal">({orders.length})</span>
        </h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">No orders yet. Create one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-surface-600">
                  <th className="text-left py-2 font-medium">Order ID</th>
                  <th className="text-left py-2 font-medium">Maker</th>
                  <th className="text-right py-2 font-medium">Amount</th>
                  <th className="text-center py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 10).map((o) => (
                  <tr key={o.orderId} className="border-b border-surface-700/50 hover:bg-surface-700/30">
                    <td className="py-2.5 font-mono text-xs text-gray-300">
                      {o.orderId.slice(0, 10)}...{o.orderId.slice(-6)}
                    </td>
                    <td className="py-2.5 font-mono text-xs text-gray-400">
                      {o.maker.slice(0, 8)}...{o.maker.slice(-4)}
                    </td>
                    <td className="py-2.5 text-right">
                      {formatUnits(o.amountIn, 6)} USDC
                    </td>
                    <td className="py-2.5 text-center">
                      <span className={STATUS_COLORS[o.filled ? "Filled" : "Open"]}>
                        {o.filled ? "Filled" : "Open"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => setFillOrderId(o.orderId)}
                        className="text-xs text-accent-blue hover:underline"
                        title="Copy to fill"
                      >
                        {o.filled ? "—" : "Fill →"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="card-glass space-y-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">How Compliance Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { step: "1", title: "KYC Verification", desc: "CRE Workflow A verifies identity via Sumsub + Chainalysis in TEE. Credential written on-chain." },
            { step: "2", title: "Trade Gating", desc: "EscrowSwap checks require(isVerified(msg.sender)). One line of Solidity gates the entire protocol." },
            { step: "3", title: "Audit Trail", desc: "Full compliance record on IPFS. On-chain hash for integrity. Any party can fetch and verify." },
          ].map(({ step, title, desc }) => (
            <div key={step} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-blue/20 text-accent-blue flex items-center justify-center text-sm font-bold flex-shrink-0">{step}</div>
              <div>
                <div className="font-medium text-sm">{title}</div>
                <div className="text-xs text-gray-400 mt-1">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
