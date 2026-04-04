/**
 * Workflow B: Per-Trade Compliance Check
 *
 * Trigger: EVM Log (watches ComplianceCheckRequested event)
 * Flow: Decode event → IntegratorRegistry read → Sumsub check → Chainalysis x2 → Rules → writeReport + IPFS
 *
 * Note: Sumsub requires HMAC-SHA256 signing. Noble hashes used in WASM runtime.
 * Credentials in config for simulation; Vault DON in production.
 */
import {
  cre,
  Runner,
  type Runtime,
  getNetwork,
  encodeCallMsg,
} from "@chainlink/cre-sdk";
import {
  encodeAbiParameters,
  parseAbiParameters,
  parseAbi,
  keccak256,
  toHex,
  encodePacked,
  encodeFunctionData,
  decodeFunctionResult,
  decodeAbiParameters,
  type Address,
  type Hex,
} from "viem";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const configSchema = z.object({
  sumsubApiUrl: z.string(),
  sumsubAppToken: z.string(),
  sumsubSecretKey: z.string(),
  chainalysisApiUrl: z.string(),
  chainalysisApiKey: z.string(),
  reportConsumerAddress: z.string(),
  integratorRegistryAddress: z.string(),
  identityRegistryAddress: z.string(),
  credentialRegistryAddress: z.string(),
  chainSelectorName: z.string(),
  maxWalletRiskScore: z.number(),
  restrictedJurisdictions: z.array(z.string()),
});
type Config = z.infer<typeof configSchema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SumsubStatus { reviewStatus: string; reviewAnswer: string; sanctionsHit: boolean; pepStatus: boolean; jurisdiction: string; }
interface WalletRisk { riskScore: number; sanctionedExposure: number; darknetExposure: number; mixerExposure: number; }
interface ComplianceDecision { approved: boolean; riskScore: number; flags: string[]; reasoning: string; }
interface AuditRecord {
  tradeId: string; workspaceId: string; brokerAppId: string; sourceContract: string;
  trader: string; counterparty: string; asset: string; amount: string; timestamp: string;
  sumsub: SumsubStatus; traderWalletRisk: WalletRisk; counterpartyWalletRisk: WalletRisk;
  jurisdictionCheck: { allowed: boolean; jurisdiction: string; regulation: string; };
  decision: ComplianceDecision;
}

// ---------------------------------------------------------------------------
// Sumsub HMAC signing (Noble hashes — works in QuickJS WASM)
// ---------------------------------------------------------------------------
function sumsubSign(secretKey: string, ts: string, method: string, path: string, body: string = ""): string {
  const sig = hmac(sha256, new TextEncoder().encode(secretKey), new TextEncoder().encode(ts + method + path + body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function sumsubHeaders(config: Config, now: Date, method: string, path: string): { [key: string]: string } {
  const ts = Math.floor(now.getTime() / 1000).toString();
  return {
    "X-App-Token": config.sumsubAppToken,
    "X-App-Access-Sig": sumsubSign(config.sumsubSecretKey, ts, method, path),
    "X-App-Access-Ts": ts,
    Accept: "application/json",
  };
}

// ---------------------------------------------------------------------------
// Provider check functions
// ---------------------------------------------------------------------------
function checkSumsub(runtime: Runtime<Config>, http: any, wallet: Address, wsId: Hex, brokerAppId: Hex): SumsubStatus {
  const externalUserId = `${wsId}:${brokerAppId}:${wallet}`;
  const path = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
  const resp = http.sendRequest(runtime, {
    url: `${runtime.config.sumsubApiUrl}${path}`,
    method: "GET",
    headers: sumsubHeaders(runtime.config, runtime.now(), "GET", path),
  }).result();

  if (resp.statusCode !== 200) {
    return { reviewStatus: "not_found", reviewAnswer: "NONE", sanctionsHit: false, pepStatus: false, jurisdiction: "UNKNOWN" };
  }
  const data = JSON.parse(Buffer.from(resp.body).toString("utf-8"));
  return {
    reviewStatus: data.review?.reviewStatus ?? "unknown",
    reviewAnswer: data.review?.reviewResult?.reviewAnswer ?? "NONE",
    sanctionsHit: false, pepStatus: false,
    jurisdiction: data.info?.country ?? "UNKNOWN",
  };
}

function checkWalletRisk(runtime: Runtime<Config>, http: any, wallet: Address): WalletRisk {
  const resp = http.sendRequest(runtime, {
    url: `${runtime.config.chainalysisApiUrl}/entities/${wallet}`,
    method: "GET",
    headers: { Token: runtime.config.chainalysisApiKey, Accept: "application/json" },
  }).result();

  if (resp.statusCode !== 200) return { riskScore: 0, sanctionedExposure: 0, darknetExposure: 0, mixerExposure: 0 };
  const data = JSON.parse(Buffer.from(resp.body).toString("utf-8"));
  return { riskScore: data.riskScore ?? 0, sanctionedExposure: data.exposures?.sanctioned ?? 0, darknetExposure: data.exposures?.darknet ?? 0, mixerExposure: data.exposures?.mixer ?? 0 };
}

// ---------------------------------------------------------------------------
// Rules engine
// ---------------------------------------------------------------------------
function aggregateDecision(config: Config, sumsub: SumsubStatus, traderRisk: WalletRisk, counterpartyRisk: WalletRisk, jurisdictionAllowed: boolean): ComplianceDecision {
  const flags: string[] = [];
  let approved = true;
  if (sumsub.reviewAnswer !== "GREEN") { flags.push("KYC_NOT_APPROVED"); approved = false; }
  if (sumsub.sanctionsHit) { flags.push("SANCTIONS_HIT"); approved = false; }
  if (traderRisk.riskScore > config.maxWalletRiskScore) { flags.push("TRADER_HIGH_RISK"); approved = false; }
  if (counterpartyRisk.riskScore > config.maxWalletRiskScore) { flags.push("COUNTERPARTY_HIGH_RISK"); approved = false; }
  if (traderRisk.sanctionedExposure > 0 || counterpartyRisk.sanctionedExposure > 0) { flags.push("SANCTIONED_EXPOSURE"); approved = false; }
  if (!jurisdictionAllowed) { flags.push("RESTRICTED_JURISDICTION"); approved = false; }
  return { approved, riskScore: Math.min(Math.max(traderRisk.riskScore, counterpartyRisk.riskScore), 10), flags, reasoning: approved ? "All checks passed" : `Rejected: ${flags.join(", ")}` };
}

function determineRegulation(j: string): string {
  const eu = ["DE","FR","IT","ES","NL","BE","AT","PT","FI","IE","GR","LU","SI","SK","EE","LV","LT","CY","MT","HR","BG","RO","CZ","DK","SE","PL","HU"];
  if (eu.includes(j)) return "MiCA"; if (j === "US") return "SEC_CFTC"; if (j === "GB") return "FCA"; if (j === "SG") return "MAS"; return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Handler — triggered by EVM Log event
// ---------------------------------------------------------------------------
const onLogTrigger = (runtime: Runtime<Config>, log: any): string => {
  // All viem calls inside handler
  const REGISTRY_ABI = parseAbi(["function getIntegrator(address) view returns (bytes32, bytes32, uint8, bool)"]);
  const IDENTITY_ABI = parseAbi(["function getIdentity(address) view returns (bytes32)"]);
  const CREDENTIAL_ABI = parseAbi(["function getCredential(bytes32, bytes32) view returns (uint40, bytes)"]);
  const KYC_VERIFIED = keccak256(encodePacked(["string"], ["KYC_VERIFIED"]));

  // Decode event
  const tradeId = log.topics[1] as Hex;
  const trader = ("0x" + log.topics[2].slice(26)) as Address;
  const sourceContract = log.address as Address;
  const [counterparty, asset, amount] = decodeAbiParameters(
    parseAbiParameters("address, address, uint256"), log.data as Hex
  );

  runtime.log(`Per-trade check: trade=${tradeId}, trader=${trader}`);

  const network = getNetwork({ chainFamily: "evm", chainSelectorName: runtime.config.chainSelectorName, isTestnet: true });
  if (!network) throw new Error(`Network not found: ${runtime.config.chainSelectorName}`);
  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const http = new cre.capabilities.HTTPClient();
  const now = runtime.now();

  // 1. Read IntegratorRegistry
  let workspaceId: Hex = keccak256(toHex("default"));
  try {
    const regResult = evmClient.callContract(runtime, {
      call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000", to: runtime.config.integratorRegistryAddress, data: encodeFunctionData({ abi: REGISTRY_ABI, functionName: "getIntegrator", args: [sourceContract] }) }),
    }).result();
    const decoded = decodeFunctionResult({ abi: REGISTRY_ABI, functionName: "getIntegrator", data: regResult as unknown as Hex }) as [Hex, Hex, number, boolean];
    workspaceId = decoded[1];
  } catch { runtime.log("IntegratorRegistry lookup failed — using defaults"); }

  // 2. Read trader's brokerAppId from credential
  let brokerAppId: Hex = keccak256(toHex("unknown-broker"));
  try {
    const idResult = evmClient.callContract(runtime, {
      call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000", to: runtime.config.identityRegistryAddress, data: encodeFunctionData({ abi: IDENTITY_ABI, functionName: "getIdentity", args: [trader] }) }),
    }).result();
    const ccid = decodeFunctionResult({ abi: IDENTITY_ABI, functionName: "getIdentity", data: idResult as unknown as Hex }) as Hex;
    if (ccid !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const credResult = evmClient.callContract(runtime, {
        call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000", to: runtime.config.credentialRegistryAddress, data: encodeFunctionData({ abi: CREDENTIAL_ABI, functionName: "getCredential", args: [ccid, KYC_VERIFIED] }) }),
      }).result();
      const [, credData] = decodeFunctionResult({ abi: CREDENTIAL_ABI, functionName: "getCredential", data: credResult as unknown as Hex }) as [number, Hex];
      const decoded = decodeAbiParameters(parseAbiParameters("uint8, uint8, string, bytes32, bytes32"), credData);
      brokerAppId = decoded[3] as Hex;
    }
  } catch { runtime.log("Credential lookup failed — using default brokerAppId"); }

  // 3-4. Provider checks
  const sumsubStatus = checkSumsub(runtime, http, trader, workspaceId, brokerAppId);
  const traderRisk = checkWalletRisk(runtime, http, trader);
  const counterpartyRisk = checkWalletRisk(runtime, http, counterparty as Address);

  // 5-6. Rules + decision
  const jurisdictionAllowed = !runtime.config.restrictedJurisdictions.includes(sumsubStatus.jurisdiction);
  const decision = aggregateDecision(runtime.config, sumsubStatus, traderRisk, counterpartyRisk, jurisdictionAllowed);
  runtime.log(`Decision: approved=${decision.approved}, risk=${decision.riskScore}, flags=[${decision.flags.join(",")}]`);

  // 7. Build AuditRecord + hash
  const auditRecord: AuditRecord = {
    tradeId, workspaceId, brokerAppId, sourceContract, trader,
    counterparty: counterparty as string, asset: asset as string, amount: amount.toString(),
    timestamp: now.toISOString(), sumsub: sumsubStatus,
    traderWalletRisk: traderRisk, counterpartyWalletRisk: counterpartyRisk,
    jurisdictionCheck: { allowed: jurisdictionAllowed, jurisdiction: sumsubStatus.jurisdiction, regulation: determineRegulation(sumsubStatus.jurisdiction) },
    decision,
  };
  const auditJson = JSON.stringify(auditRecord);
  const auditHash = keccak256(toHex(auditJson));

  // 8. IPFS upload (Pinata) — skip if no key configured
  let ipfsCid = "";
  // TODO: Add Pinata upload when key is available

  // 9. Write ComplianceReport on-chain
  const reportPayload = encodeAbiParameters(
    parseAbiParameters("(bytes32, address, address, address, bool, uint8, bytes32, string, uint256)"),
    [{ 0: tradeId, 1: trader, 2: counterparty as Address, 3: sourceContract, 4: decision.approved, 5: decision.riskScore, 6: auditHash, 7: ipfsCid, 8: BigInt(Math.floor(now.getTime() / 1000)) }] as any
  );

  const report = runtime.report(reportPayload);
  evmClient.writeReport(runtime, runtime.config.reportConsumerAddress as Address, report, { gasLimit: "500000" }).result();

  runtime.log(`Compliance report written for trade ${tradeId}`);
  return JSON.stringify({ tradeId, approved: decision.approved, riskScore: decision.riskScore, auditHash });
};

// ---------------------------------------------------------------------------
// Init + main — EVM Log Trigger
// ---------------------------------------------------------------------------
// Helper: hex string → base64 (for protobuf bytes fields)
function hexToBase64(hex: string): string {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(h.substr(i * 2, 2), 16);
  return Buffer.from(bytes).toString("base64");
}

function initWorkflow(config: Config) {
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: config.chainSelectorName, isTestnet: true });
  if (!network) throw new Error(`Network not found: ${config.chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  // Event signature as base64-encoded bytes32
  const eventSig = keccak256(toHex("ComplianceCheckRequested(bytes32,address,address,address,uint256)"));
  const eventSigBase64 = hexToBase64(eventSig);

  return [
    cre.handler(
      evmClient.logTrigger({
        addresses: [],
        topics: [{ values: [eventSigBase64] }],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      onLogTrigger
    ),
  ];
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
