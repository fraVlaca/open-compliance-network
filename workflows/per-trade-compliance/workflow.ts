/**
 * Workflow B: Per-Trade Compliance Check
 *
 * Trigger: EVM Log (watches ComplianceCheckRequested event from protocol contracts)
 *
 * Provider model: ONE master Sumsub account, ONE master Chainalysis key.
 *       Sumsub applicants looked up via namespaced externalUserId.
 *       Chainalysis results tagged with appIds in the audit record.
 *       Scoping data (workspaceId, brokerAppId, lpAppId) embedded in the
 *       on-chain report and off-chain audit record.
 *
 * Flow:
 *   1. Decode event → get tradeId, trader, counterparty, asset, amount
 *   2. Read IntegratorRegistry → get source contract's workspaceId
 *   3. Confidential HTTP → Sumsub: trader KYC status (namespaced lookup)
 *   4. Confidential HTTP → Chainalysis: trader + counterparty wallet risk
 *   5. Rules engine: jurisdiction, asset eligibility, thresholds
 *   6. Aggregate → approved/rejected
 *   7. writeReport → ComplianceReportConsumer (includes sourceContract for auto-callback)
 *   8. HTTP POST → audit DB (full AuditRecord with all appIds for scoping)
 */
import {
  handler,
  type Runtime,
  EVMClient,
  ConfidentialHTTPClient,
  type ConfidentialHTTPRequest,
  HTTPClient,
} from "@chainlink/cre-sdk";
import { z } from "zod";
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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ConfigSchema = z.object({
  sumsubApiUrl: z.string().url(),
  chainalysisApiUrl: z.string().url(),
  reportConsumerAddress: z.string(),
  integratorRegistryAddress: z.string(),
  identityRegistryAddress: z.string(),
  credentialRegistryAddress: z.string(),
  chainSelector: z.string(),
  maxWalletRiskScore: z.number(),
  restrictedJurisdictions: z.array(z.string()),
});
type Config = z.infer<typeof ConfigSchema>;

// NOTE: viem parseAbi/keccak256/encodePacked CANNOT be called at module scope -
// QuickJS WASM crashes on top-level viem computations. All moved inside handler.

// ---------------------------------------------------------------------------
// Provider response types
// ---------------------------------------------------------------------------
interface SumsubStatus {
  reviewStatus: string;
  reviewAnswer: string;
  sanctionsHit: boolean;
  pepStatus: boolean;
  jurisdiction: string;
}

interface WalletRisk {
  riskScore: number;
  sanctionedExposure: number;
  darknetExposure: number;
  mixerExposure: number;
}

interface ComplianceDecision {
  approved: boolean;
  riskScore: number;
  flags: string[];
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Audit record - includes all appIds for multi-tenant scoping
// ---------------------------------------------------------------------------
interface AuditRecord {
  tradeId: string;
  workspaceId: string;
  brokerAppId: string; // broker who onboarded the trader
  sourceContract: string; // protocol contract that emitted the event
  trader: string;
  counterparty: string;
  asset: string;
  amount: string;
  timestamp: string;
  sumsub: SumsubStatus;
  traderWalletRisk: WalletRisk;
  counterpartyWalletRisk: WalletRisk;
  jurisdictionCheck: {
    allowed: boolean;
    jurisdiction: string;
    regulation: string;
  };
  decision: ComplianceDecision;
}

// ---------------------------------------------------------------------------
// Main handler - triggered by EVM Log
// ---------------------------------------------------------------------------
async function onComplianceCheckRequested(
  config: Config,
  runtime: Runtime,
  log: { address: string; topics: string[]; data: string }
): Promise<void> {
  // viem functions must be called inside handler, not at module scope (QuickJS WASM limitation)
  const REGISTRY_ABI = parseAbi([
    "function getIntegrator(address wallet) view returns (bytes32 appId, bytes32 workspaceId, uint8 role, bool active)",
  ]);
  const CREDENTIAL_REGISTRY_ABI = parseAbi([
    "function getCredential(bytes32 ccid, bytes32 credentialTypeId) view returns (uint40 expiresAt, bytes credentialData)",
  ]);
  const IDENTITY_REGISTRY_ABI = parseAbi([
    "function getIdentity(address account) view returns (bytes32)",
  ]);
  const KYC_VERIFIED = keccak256(encodePacked(["string"], ["KYC_VERIFIED"]));
  // Decode event: ComplianceCheckRequested(bytes32 indexed tradeId, address indexed trader, address counterparty, address asset, uint256 amount)
  const tradeId = log.topics[1] as Hex;
  const trader = ("0x" + log.topics[2].slice(26)) as Address;
  const sourceContract = log.address as Address;

  const [counterparty, asset, amount] = decodeAbiParameters(
    parseAbiParameters("address counterparty, address asset, uint256 amount"),
    log.data as Hex
  );

  const evmClient = new EVMClient(config.chainSelector);
  const now = runtime.now();

  // -----------------------------------------------------------------------
  // 1. Read IntegratorRegistry to get the source contract's workspace context
  // -----------------------------------------------------------------------
  const registryResult = evmClient.callContract({
    to: config.integratorRegistryAddress as Address,
    data: encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "getIntegrator",
      args: [sourceContract],
    }),
  }).result();

  const [, workspaceId] = decodeFunctionResult({
    abi: REGISTRY_ABI,
    functionName: "getIntegrator",
    data: registryResult as Hex,
  }) as [Hex, Hex, number, boolean];

  // -----------------------------------------------------------------------
  // 2. Read trader's on-chain credential to get their brokerAppId
  //    This tells us which broker onboarded this trader
  // -----------------------------------------------------------------------
  const identityResult = evmClient.callContract({
    to: config.identityRegistryAddress as Address,
    data: encodeFunctionData({
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "getIdentity",
      args: [trader],
    }),
  }).result();

  const traderCcid = decodeFunctionResult({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getIdentity",
    data: identityResult as Hex,
  }) as Hex;

  // Read broker appId from credential data (embedded at KYC time by Workflow A)
  let brokerAppId: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
  if (traderCcid !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
    const credResult = evmClient.callContract({
      to: config.credentialRegistryAddress as Address,
      data: encodeFunctionData({
        abi: CREDENTIAL_REGISTRY_ABI,
        functionName: "getCredential",
        args: [traderCcid, KYC_VERIFIED as Hex],
      }),
    }).result();

    try {
      const [, credentialData] = decodeFunctionResult({
        abi: CREDENTIAL_REGISTRY_ABI,
        functionName: "getCredential",
        data: credResult as Hex,
      }) as [number, Hex];

      // credentialData = abi.encode(uint8 kycLevel, uint8 riskScore, string jurisdiction, bytes32 brokerAppId, bytes32 workspaceId)
      const decoded = decodeAbiParameters(
        parseAbiParameters("uint8, uint8, string, bytes32, bytes32"),
        credentialData
      );
      brokerAppId = decoded[3] as Hex;
    } catch {
      // Credential not found or decode failed - use default
    }
  }

  runtime.log(
    `Per-trade check: trade=${tradeId}, trader=${trader}, counterparty=${counterparty}, workspace=${workspaceId}`
  );

  // -----------------------------------------------------------------------
  // 3. Sumsub KYC status - uses namespaced externalUserId
  // -----------------------------------------------------------------------
  const sumsubStatus = checkSumsub(config, trader, workspaceId, brokerAppId);

  // -----------------------------------------------------------------------
  // 4. Chainalysis wallet risk - trader + counterparty (single master key)
  // -----------------------------------------------------------------------
  const traderRisk = checkWalletRisk(config, trader);
  const counterpartyRisk = checkWalletRisk(config, counterparty as Address);

  // -----------------------------------------------------------------------
  // 5. Jurisdiction + rules engine
  // -----------------------------------------------------------------------
  const jurisdictionAllowed =
    !config.restrictedJurisdictions.includes(sumsubStatus.jurisdiction);
  const regulation = determineRegulation(sumsubStatus.jurisdiction);

  // -----------------------------------------------------------------------
  // 6. Aggregate decision
  // -----------------------------------------------------------------------
  const decision = aggregateDecision(
    config, sumsubStatus, traderRisk, counterpartyRisk, jurisdictionAllowed
  );

  runtime.log(
    `Decision: approved=${decision.approved}, risk=${decision.riskScore}, flags=[${decision.flags.join(",")}]`
  );

  // -----------------------------------------------------------------------
  // 7. Build AuditRecord with all appIds for multi-tenant scoping
  // -----------------------------------------------------------------------
  const auditRecord: AuditRecord = {
    tradeId,
    workspaceId: workspaceId,
    brokerAppId: brokerAppId,
    sourceContract: sourceContract,
    trader,
    counterparty: counterparty as string,
    asset: asset as string,
    amount: amount.toString(),
    timestamp: now.toISOString(),
    sumsub: sumsubStatus,
    traderWalletRisk: traderRisk,
    counterpartyWalletRisk: counterpartyRisk,
    jurisdictionCheck: {
      allowed: jurisdictionAllowed,
      jurisdiction: sumsubStatus.jurisdiction,
      regulation,
    },
    decision,
  };

  const auditJson = JSON.stringify(auditRecord);
  const auditHash = keccak256(toHex(auditJson));

  // -----------------------------------------------------------------------
  // 8. Upload AuditRecord to IPFS via Pinata
  //    Stored publicly - integrity guaranteed by on-chain auditHash (DON-signed).
  //    Pinata API key protects the account, not the data.
  // -----------------------------------------------------------------------
  const pinataBody = JSON.stringify({
    pinataContent: auditRecord,
    pinataMetadata: { name: `audit-${tradeId}` },
  });

  const httpClient = new HTTPClient();
  const pinataResponse = httpClient
    .sendRequest({
      url: "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${runtime.getSecret("PINATA_JWT")}`,
      },
      body: pinataBody,
    })
    .result();

  let ipfsCid = "";
  if (pinataResponse.ok()) {
    const pinataData = pinataResponse.json() as { IpfsHash: string };
    ipfsCid = pinataData.IpfsHash;
    runtime.log(`AuditRecord pinned to IPFS: ${ipfsCid}`);
  } else {
    runtime.log(`Pinata upload failed: ${pinataResponse.statusCode} - continuing without IPFS`);
  }

  // -----------------------------------------------------------------------
  // 9. Write ComplianceReport on-chain (includes sourceContract for auto-callback + IPFS CID)
  // -----------------------------------------------------------------------
  const reportPayload = encodeAbiParameters(
    parseAbiParameters(
      "(bytes32 tradeId, address trader, address counterparty, address sourceContract, bool approved, uint8 riskScore, bytes32 auditHash, string ipfsCid, uint256 timestamp)"
    ),
    [{
      tradeId,
      trader,
      counterparty: counterparty as Address,
      sourceContract,
      approved: decision.approved,
      riskScore: decision.riskScore,
      auditHash,
      ipfsCid,
      timestamp: BigInt(Math.floor(now.getTime() / 1000)),
    }]
  );

  const report = runtime.report(reportPayload);
  evmClient
    .writeReport(config.reportConsumerAddress as Address, report, {
      gasLimit: "500000",
    })
    .result();

  runtime.log(`Compliance report written for trade ${tradeId}, IPFS: ${ipfsCid}`);
}

// ---------------------------------------------------------------------------
// Provider check functions - single master accounts, namespaced lookups
// ---------------------------------------------------------------------------

function checkSumsub(
  config: Config,
  wallet: Address,
  workspaceId: Hex,
  brokerAppId: Hex
): SumsubStatus {
  // Namespaced lookup: find the applicant by their scoped externalUserId
  const externalUserId = `${workspaceId}:${brokerAppId}:${wallet}`;
  const client = new ConfidentialHTTPClient();
  const req: ConfidentialHTTPRequest = {
    url: `${config.sumsubApiUrl}/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`,
    method: "GET",
    headers: {
      "X-App-Token": "{{.SUMSUB_APP_TOKEN}}",
      Accept: "application/json",
    },
    body: "",
    secrets: [{ name: "SUMSUB_APP_TOKEN" }, { name: "SUMSUB_SECRET_KEY" }],
    encryptOutput: true,
  };

  const response = client.sendRequest(req).result();

  if (response.statusCode !== 200) {
    return {
      reviewStatus: "not_found",
      reviewAnswer: "NONE",
      sanctionsHit: false,
      pepStatus: false,
      jurisdiction: "UNKNOWN",
    };
  }

  const data = JSON.parse(response.body);
  return {
    reviewStatus: data.review?.reviewStatus ?? "unknown",
    reviewAnswer: data.review?.reviewResult?.reviewAnswer ?? "NONE",
    sanctionsHit: false,
    pepStatus: false,
    jurisdiction: data.info?.country ?? "UNKNOWN",
  };
}

function checkWalletRisk(config: Config, wallet: Address): WalletRisk {
  // Single master Chainalysis key - no namespacing needed at provider level
  const client = new ConfidentialHTTPClient();
  const req: ConfidentialHTTPRequest = {
    url: `${config.chainalysisApiUrl}/entities/${wallet}`,
    method: "GET",
    headers: {
      Token: "{{.CHAINALYSIS_API_KEY}}",
      Accept: "application/json",
    },
    body: "",
    secrets: [{ name: "CHAINALYSIS_API_KEY" }],
    encryptOutput: true,
  };

  const response = client.sendRequest(req).result();

  if (response.statusCode !== 200) {
    return { riskScore: 0, sanctionedExposure: 0, darknetExposure: 0, mixerExposure: 0 };
  }

  const data = JSON.parse(response.body);
  return {
    riskScore: data.riskScore ?? 0,
    sanctionedExposure: data.exposures?.sanctioned ?? 0,
    darknetExposure: data.exposures?.darknet ?? 0,
    mixerExposure: data.exposures?.mixer ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Rules engine
// ---------------------------------------------------------------------------

function aggregateDecision(
  config: Config,
  sumsub: SumsubStatus,
  traderRisk: WalletRisk,
  counterpartyRisk: WalletRisk,
  jurisdictionAllowed: boolean
): ComplianceDecision {
  const flags: string[] = [];
  let approved = true;

  if (sumsub.reviewAnswer !== "GREEN") { flags.push("KYC_NOT_APPROVED"); approved = false; }
  if (sumsub.sanctionsHit) { flags.push("SANCTIONS_HIT"); approved = false; }
  if (sumsub.pepStatus) { flags.push("PEP_FLAGGED"); }
  if (traderRisk.riskScore > config.maxWalletRiskScore) { flags.push("TRADER_HIGH_RISK"); approved = false; }
  if (counterpartyRisk.riskScore > config.maxWalletRiskScore) { flags.push("COUNTERPARTY_HIGH_RISK"); approved = false; }
  if (traderRisk.sanctionedExposure > 0 || counterpartyRisk.sanctionedExposure > 0) { flags.push("SANCTIONED_EXPOSURE"); approved = false; }
  if (!jurisdictionAllowed) { flags.push("RESTRICTED_JURISDICTION"); approved = false; }

  return {
    approved,
    riskScore: Math.min(Math.max(traderRisk.riskScore, counterpartyRisk.riskScore), 10),
    flags,
    reasoning: approved ? "All checks passed" : `Rejected: ${flags.join(", ")}`,
  };
}

function determineRegulation(jurisdiction: string): string {
  const eu = ["DE","FR","IT","ES","NL","BE","AT","PT","FI","IE","GR","LU","SI","SK","EE","LV","LT","CY","MT","HR","BG","RO","CZ","DK","SE","PL","HU"];
  if (eu.includes(jurisdiction)) return "MiCA";
  if (jurisdiction === "US") return "SEC_CFTC";
  if (jurisdiction === "GB") return "FCA";
  if (jurisdiction === "SG") return "MAS";
  return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Wire it up - EVM Log Trigger
// ---------------------------------------------------------------------------
export function main() {
  const evmClient = new EVMClient("arc-testnet");

  const trigger = evmClient.logTrigger({
    addresses: [],
    topics: [
      keccak256(toHex("ComplianceCheckRequested(bytes32,address,address,address,uint256)")),
    ],
    confidenceLevel: "CONFIDENCE_LEVEL_FINALIZED",
  });

  handler(trigger, onComplianceCheckRequested);
}
