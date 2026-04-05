/**
 * Workflow B: Per-Trade Compliance Check
 *
 * Trigger: EVM Log (watches ComplianceCheckRequested event)
 * Flow: Decode event → IntegratorRegistry read → Sumsub check → Chainalysis x2 → Rules → writeReport + IPFS
 *
 * Privacy: All Sumsub/Chainalysis API calls use ConfidentialHTTPClient.
 * App Token + API keys stay in Vault DON / TEE enclave via {{.key}} templates.
 * HMAC-SHA256 computed in handler, passed to enclave as plain header value.
 *
 * Qualifies for: Chainlink privacy standard track (Confidential HTTP + Vault DON secrets)
 */
import {
  cre,
  Runner,
  ConfidentialHTTPClient,
  handler,
  prepareReportRequest,
  encodeCallMsg,
  getNetwork,
  bytesToHex,
  type Runtime,
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
  getAddress,
  type Address,
  type Hex,
} from "viem";
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config - sumsubAppToken + chainalysisApiKey in Vault DON secrets
// ---------------------------------------------------------------------------
const configSchema = z.object({
  sumsubApiUrl: z.string(),
  sumsubSecretKey: z.string(),
  chainalysisApiUrl: z.string(),
  credentialConsumerAddress: z.string(),
  reportConsumerAddress: z.string(),
  integratorRegistryAddress: z.string(),
  identityRegistryAddress: z.string(),
  credentialRegistryAddress: z.string(),
  chainSelectorName: z.string(),
  maxWalletRiskScore: z.number(),
  restrictedJurisdictions: z.array(z.string()),
  owner: z.string(),
});
type Config = z.infer<typeof configSchema>;

// Types
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
// HMAC-SHA256 signing
// ---------------------------------------------------------------------------
function sumsubSign(secretKey: string, ts: string, method: string, path: string, body: string = ""): string {
  const sig = hmac(sha256, new TextEncoder().encode(secretKey), new TextEncoder().encode(ts + method + path + body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Confidential HTTP helpers
// ---------------------------------------------------------------------------
function confSumsubGet(client: ConfidentialHTTPClient, runtime: Runtime<Config>, url: string, hmacSig: string, ts: string) {
  return client.sendRequest(runtime, {
    vaultDonSecrets: [{ key: "sumsubAppToken", owner: runtime.config.owner }],
    request: {
      url, method: "GET",
      multiHeaders: {
        "X-App-Token": { values: ["{{.sumsubAppToken}}"] },
        "X-App-Access-Sig": { values: [hmacSig] },
        "X-App-Access-Ts": { values: [ts] },
        Accept: { values: ["application/json"] },
      },
    },
  }).result();
}

function confChainalysisGet(client: ConfidentialHTTPClient, runtime: Runtime<Config>, url: string) {
  return client.sendRequest(runtime, {
    vaultDonSecrets: [{ key: "chainalysisApiKey", owner: runtime.config.owner }],
    request: {
      url, method: "GET",
      multiHeaders: {
        Token: { values: ["{{.chainalysisApiKey}}"] },
        Accept: { values: ["application/json"] },
      },
    },
  }).result();
}

function respText(resp: { body: Uint8Array }): string {
  return new TextDecoder().decode(resp.body);
}

/**
 * Upload AuditRecord to IPFS via Pinata (Confidential HTTP — JWT in Vault DON).
 * Returns the IPFS CID (IpfsHash) or empty string on failure.
 */
function uploadToIPFS(client: ConfidentialHTTPClient, runtime: Runtime<Config>, auditRecord: AuditRecord, tradeId: string): string {
  try {
    const body = JSON.stringify({
      pinataContent: auditRecord,
      pinataMetadata: { name: `compliance-report-${tradeId.slice(0, 16)}` },
    });

    const resp = client.sendRequest(runtime, {
      vaultDonSecrets: [
        { key: "pinataApiKey", owner: runtime.config.owner },
        { key: "pinataSecretKey", owner: runtime.config.owner },
      ],
      request: {
        url: "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        method: "POST",
        multiHeaders: {
          pinata_api_key: { values: ["{{.pinataApiKey}}"] },
          pinata_secret_api_key: { values: ["{{.pinataSecretKey}}"] },
          "Content-Type": { values: ["application/json"] },
        },
        bodyString: body,
      },
    }).result();

    if (resp.statusCode === 200) {
      const data = JSON.parse(respText(resp));
      runtime.log(`IPFS upload: CID=${data.IpfsHash}`);
      return data.IpfsHash || "";
    }
    runtime.log(`IPFS upload failed: ${resp.statusCode} ${respText(resp).slice(0, 100)}`);
    return "";
  } catch (e) {
    runtime.log(`IPFS upload error: ${e}`);
    return "";
  }
}

// ---------------------------------------------------------------------------
// Provider checks via Confidential HTTP
// ---------------------------------------------------------------------------
function checkSumsub(client: ConfidentialHTTPClient, runtime: Runtime<Config>, wallet: Address, wsId: Hex, brokerAppId: Hex): SumsubStatus {
  const externalUserId = `${wsId}:${brokerAppId}:${wallet}`;
  const path = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
  const ts = Math.floor(runtime.now().getTime() / 1000).toString();
  const hmacSig = sumsubSign(runtime.config.sumsubSecretKey, ts, "GET", path);
  const resp = confSumsubGet(client, runtime, `${runtime.config.sumsubApiUrl}${path}`, hmacSig, ts);

  runtime.log(`checkSumsub: status=${resp.statusCode}, body=${respText(resp).slice(0, 200)}`);
  if (resp.statusCode !== 200) {
    return { reviewStatus: "not_found", reviewAnswer: "NONE", sanctionsHit: false, pepStatus: false, jurisdiction: "UNKNOWN" };
  }
  const data = JSON.parse(respText(resp));
  runtime.log(`checkSumsub: reviewStatus=${data.review?.reviewStatus}, reviewAnswer=${data.review?.reviewResult?.reviewAnswer}`);
  return {
    reviewStatus: data.review?.reviewStatus ?? "unknown",
    reviewAnswer: data.review?.reviewResult?.reviewAnswer ?? "NONE",
    sanctionsHit: false, pepStatus: false,
    jurisdiction: data.info?.country ?? "UNKNOWN",
  };
}

function checkWalletRisk(client: ConfidentialHTTPClient, runtime: Runtime<Config>, wallet: Address): WalletRisk {
  const resp = confChainalysisGet(client, runtime, `${runtime.config.chainalysisApiUrl}/entities/${wallet}`);
  if (resp.statusCode !== 200) return { riskScore: 0, sanctionedExposure: 0, darknetExposure: 0, mixerExposure: 0 };
  const data = JSON.parse(respText(resp));
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
// Handler - triggered by EVM Log event
// ---------------------------------------------------------------------------
const onLogTrigger = (runtime: Runtime<Config>, log: any): string => {
  const REGISTRY_ABI = parseAbi(["function getIntegrator(address) view returns (bytes32, bytes32, uint8, bool)"]);
  const IDENTITY_ABI = parseAbi(["function getIdentity(address) view returns (bytes32)"]);
  const CREDENTIAL_ABI = parseAbi(["function getCredential(bytes32, bytes32) view returns (uint40, bytes)"]);
  const KYC_VERIFIED = keccak256(encodePacked(["string"], ["KYC_VERIFIED"]));

  // Log fields are Uint8Array - convert to hex with bytesToHex
  const tradeId = bytesToHex(log.topics[1]) as Hex;
  const traderTopic = bytesToHex(log.topics[2]) as Hex;
  const trader = getAddress("0x" + traderTopic.slice(26)) as Address;
  const sourceContract = bytesToHex(log.address) as Address;
  const dataHex = bytesToHex(log.data) as Hex;
  const [counterparty, asset, amount] = decodeAbiParameters(
    parseAbiParameters("address, address, uint256"), dataHex
  );

  runtime.log(`Per-trade check: trade=${tradeId}, trader=${trader}`);

  const network = getNetwork({ chainFamily: "evm", chainSelectorName: runtime.config.chainSelectorName, isTestnet: true });
  if (!network) throw new Error(`Network not found: ${runtime.config.chainSelectorName}`);
  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const confHTTP = new ConfidentialHTTPClient();
  const now = runtime.now();

  // 1. Read IntegratorRegistry for the TRADER (not sourceContract)
  // The trader's registration has the correct workspaceId for Sumsub externalUserId lookup
  let workspaceId: Hex = keccak256(toHex("default"));
  try {
    const regResult = evmClient.callContract(runtime, {
      call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000" as Address, to: runtime.config.integratorRegistryAddress as Address, data: encodeFunctionData({ abi: REGISTRY_ABI, functionName: "getIntegrator", args: [trader] }) }),
    }).result();
    const decoded = decodeFunctionResult({ abi: REGISTRY_ABI, functionName: "getIntegrator", data: bytesToHex(regResult.data) as Hex }) as [Hex, Hex, number, boolean];
    if (decoded[3]) { workspaceId = decoded[1]; }
  } catch { runtime.log("IntegratorRegistry lookup failed - using defaults"); }

  // 2. Read trader's brokerAppId - first try IntegratorRegistry, then credential
  // Use the trader's own appId from IntegratorRegistry as the primary source
  // This matches what Workflow D used when creating the Sumsub applicant
  let brokerAppId: Hex = keccak256(toHex("self-onboard"));
  try {
    const traderRegResult = evmClient.callContract(runtime, {
      call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000" as Address, to: runtime.config.integratorRegistryAddress as Address, data: encodeFunctionData({ abi: REGISTRY_ABI, functionName: "getIntegrator", args: [trader] }) }),
    }).result();
    const traderReg = decodeFunctionResult({ abi: REGISTRY_ABI, functionName: "getIntegrator", data: bytesToHex(traderRegResult.data) as Hex }) as [Hex, Hex, number, boolean];
    if (traderReg[3]) { brokerAppId = traderReg[0]; }
  } catch { runtime.log("Trader IntegratorRegistry lookup failed"); }
  try {
    const idResult = evmClient.callContract(runtime, {
      call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000" as Address, to: runtime.config.identityRegistryAddress as Address, data: encodeFunctionData({ abi: IDENTITY_ABI, functionName: "getIdentity", args: [trader] }) }),
    }).result();
    const ccid = decodeFunctionResult({ abi: IDENTITY_ABI, functionName: "getIdentity", data: bytesToHex(idResult.data) as Hex }) as Hex;
    if (ccid !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const credResult = evmClient.callContract(runtime, {
        call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000" as Address, to: runtime.config.credentialRegistryAddress as Address, data: encodeFunctionData({ abi: CREDENTIAL_ABI, functionName: "getCredential", args: [ccid, KYC_VERIFIED] }) }),
      }).result();
      const [, credData] = decodeFunctionResult({ abi: CREDENTIAL_ABI, functionName: "getCredential", data: bytesToHex(credResult.data) as Hex }) as [number, Hex];
      const decoded = decodeAbiParameters(parseAbiParameters("uint8, uint8, string, bytes32, bytes32"), credData);
      brokerAppId = decoded[3] as Hex;
      // Also get workspaceId from credential if IntegratorRegistry lookup used defaults
      if (workspaceId === keccak256(toHex("default")) && decoded[4]) {
        workspaceId = decoded[4] as Hex;
      }
    }
  } catch { runtime.log("Credential lookup failed - using default brokerAppId"); }

  // 3-4. Provider checks via Confidential HTTP
  runtime.log(`Sumsub lookup: ws=${workspaceId.slice(0,16)}... broker=${brokerAppId.slice(0,16)}... trader=${trader}`);
  const sumsubStatus = checkSumsub(confHTTP, runtime, trader, workspaceId, brokerAppId);
  const traderRisk = checkWalletRisk(confHTTP, runtime, trader);
  const counterpartyRisk = checkWalletRisk(confHTTP, runtime, counterparty as Address);

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

  // 8. Upload AuditRecord to IPFS via Pinata (Confidential HTTP — JWT in Vault DON)
  const ipfsCid = uploadToIPFS(confHTTP, runtime, auditRecord, tradeId);
  const reportTs = BigInt(Math.floor(now.getTime() / 1000));

  // 8. Write ComplianceReport on-chain - use flat params (not tuple)
  const reportPayload = encodeAbiParameters(
    parseAbiParameters("bytes32, address, address, address, bool, uint8, bytes32, string, uint256"),
    [tradeId, trader, counterparty as Address, sourceContract, decision.approved, decision.riskScore, auditHash, ipfsCid, reportTs]
  );
  const report = runtime.report(prepareReportRequest(reportPayload)).result();
  evmClient.writeReport(runtime, {
    receiver: runtime.config.reportConsumerAddress,
    report,
    gasConfig: { gasLimit: "500000" },
  }).result();

  runtime.log(`Compliance report written for trade ${tradeId}`);
  return JSON.stringify({ tradeId, approved: decision.approved, riskScore: decision.riskScore, auditHash, ipfsCid });
};

// ---------------------------------------------------------------------------
// Init + main - EVM Log Trigger
// ---------------------------------------------------------------------------
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
  const eventSig = keccak256(toHex("ComplianceCheckRequested(bytes32,address,address,address,uint256)"));
  const eventSigBase64 = hexToBase64(eventSig);

  return [
    handler(
      evmClient.logTrigger({ addresses: [], topics: [{ values: [eventSigBase64] }], confidence: "CONFIDENCE_LEVEL_FINALIZED" }),
      onLogTrigger
    ),
  ];
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
