import { usePublicClient } from "wagmi";
import { useState, useEffect } from "react";
import { parseAbiItem } from "viem";
import { CONTRACTS } from "../config/contracts";
import { ShieldCheck, ArrowRightLeft, Users } from "lucide-react";

export default function ProtocolMetrics() {
  const client = usePublicClient();
  const [credentials, setCredentials] = useState(0);
  const [trades, setTrades] = useState(0);
  const [integrators, setIntegrators] = useState(0);

  useEffect(() => {
    if (!client) return;

    async function fetchMetrics() {
      try {
        const [credLogs, tradeLogs, intLogs] = await Promise.all([
          client!.getLogs({
            address: CONTRACTS.credentialConsumer,
            event: parseAbiItem("event CredentialIssued(address indexed wallet, bytes32 indexed ccid, bytes32 credentialTypeId, uint40 expiresAt)"),
            fromBlock: 0n,
          }),
          client!.getLogs({
            address: CONTRACTS.reportConsumer,
            event: parseAbiItem("event ComplianceCheckCompleted(bytes32 indexed tradeId, address indexed trader, bool approved, uint8 riskScore, bytes32 auditHash)"),
            fromBlock: 0n,
          }),
          client!.getLogs({
            address: CONTRACTS.integratorRegistry,
            event: parseAbiItem("event IntegratorJoined(bytes32 indexed workspaceAppId, bytes32 indexed integratorAppId, address indexed wallet, uint8 role)"),
            fromBlock: 0n,
          }),
        ]);
        setCredentials(credLogs.length);
        setTrades(tradeLogs.length);
        setIntegrators(intLogs.length);
      } catch {
        // Silently fail — metrics are nice-to-have
      }
    }

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [client]);

  const metrics = [
    { icon: ShieldCheck, label: "Credentials Issued", value: credentials, color: "text-accent-green" },
    { icon: ArrowRightLeft, label: "Trades Checked", value: trades, color: "text-accent-blue" },
    { icon: Users, label: "Integrators", value: integrators, color: "text-accent-purple" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {metrics.map(({ icon: Icon, label, value, color }) => (
        <div key={label} className="card-glass flex items-center gap-3 py-4">
          <Icon className={`w-5 h-5 ${color}`} />
          <div>
            <div className="text-xl font-bold">{value}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
