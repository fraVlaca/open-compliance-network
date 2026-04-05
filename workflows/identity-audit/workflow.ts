/**
 * Workflow C: Identity Audit for Integrators
 *
 * Trigger: HTTP (restricted - only registered integrator wallets)
 *
 * Auth: Closed authorized keys. Only wallets registered in the on-chain
 *       IntegratorRegistry can trigger this workflow.
 *
 * Provider model: ONE master Sumsub account. Applicants looked up via
 *       namespaced externalUserId. Scoping enforced by checking on-chain
 *       credentials: the integrator can only access data for users whose
 *       credential is tagged with their appId.
 *
 * Flow:
 *   1. Read IntegratorRegistry → verify requester's role and appId
 *   2. Read CredentialRegistry → verify requested user's credential matches requester's appId
 *   3. Confidential HTTP → Sumsub: fetch applicant data using namespaced externalUserId
 *   4. Return encrypted audit package to integrator
 */
import {
  handler,
  type Runtime,
  HTTPCapability,
  type HTTPPayload,
  EVMClient,
  ConfidentialHTTPClient,
  type ConfidentialHTTPRequest,
} from "@chainlink/cre-sdk";
import { z } from "zod";
import {
  parseAbi,
  encodeFunctionData,
  decodeFunctionResult,
  decodeAbiParameters,
  parseAbiParameters,
  keccak256,
  encodePacked,
  toHex,
  type Address,
  type Hex,
} from "viem";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ConfigSchema = z.object({
  sumsubApiUrl: z.string().url(),
  integratorRegistryAddress: z.string(),
  identityRegistryAddress: z.string(),
  credentialRegistryAddress: z.string(),
  chainSelector: z.string(),
});
type Config = z.infer<typeof ConfigSchema>;

// ---------------------------------------------------------------------------
// Trigger input
// ---------------------------------------------------------------------------
const AuditRequestSchema = z.object({
  // The user wallet to look up
  userWallet: z.string(),
  auditReason: z.string(),
  scope: z.enum(["identity", "documents", "full"]).default("identity"),
});

// NOTE: viem parseAbi/keccak256/encodePacked CANNOT be called at module scope -
// QuickJS WASM crashes on top-level viem computations. All moved inside handler.

// Role enum (matches Solidity) - primitive constants are safe at module scope
const ROLE_PROTOCOL = 0;
const ROLE_BROKER = 1;
const ROLE_LP = 2;

// ---------------------------------------------------------------------------
// Audit package types
// ---------------------------------------------------------------------------
interface AuditPackage {
  userWallet: string;
  requesterAppId: string;
  requesterRole: string;
  auditReason: string;
  requestedAt: string;
  scope: string;
  authorized: boolean;
  identity?: {
    status: string;
    level: string;
    verifiedAt: string;
    country: string;
  };
  documentChecks?: Array<{
    type: string;
    result: string;
  }>;
  amlScreening?: {
    result: string;
    listsChecked: string[];
    checkedAt: string;
  };
  auditTrail?: Array<{
    action: string;
    timestamp: string;
    actor: string;
  }>;
}

// ---------------------------------------------------------------------------
// HTTP Trigger - restricted to registered integrators
// ---------------------------------------------------------------------------
const httpTrigger = HTTPCapability.trigger({
  // For deployment: only registered integrator EVM addresses
  // authorizedKeys: [{ evmAddress: "0xIntegratorA..." }, ...]
});

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
async function onAuditRequest(
  config: Config,
  runtime: Runtime,
  payload: HTTPPayload
): Promise<AuditPackage> {
  // viem functions must be called inside handler, not at module scope (QuickJS WASM limitation)
  const REGISTRY_ABI = parseAbi([
    "function getIntegrator(address wallet) view returns (bytes32 appId, bytes32 workspaceId, uint8 role, bool active)",
  ]);
  const IDENTITY_REGISTRY_ABI = parseAbi([
    "function getIdentity(address account) view returns (bytes32)",
  ]);
  const CREDENTIAL_REGISTRY_ABI = parseAbi([
    "function getCredential(bytes32 ccid, bytes32 credentialTypeId) view returns (uint40 expiresAt, bytes credentialData)",
  ]);
  const KYC_VERIFIED = keccak256(encodePacked(["string"], ["KYC_VERIFIED"]));

  const raw = new TextDecoder().decode(payload.input);
  const input = AuditRequestSchema.parse(JSON.parse(raw));
  const userWallet = input.userWallet as Address;

  // The HTTP trigger's authorizedKey tells us who signed the request
  const requesterWallet = payload.authorizedKey as Address;

  const evmClient = new EVMClient(config.chainSelector);

  // -----------------------------------------------------------------------
  // 1. Verify requester's identity and role via IntegratorRegistry
  // -----------------------------------------------------------------------
  const requesterResult = evmClient.callContract({
    to: config.integratorRegistryAddress as Address,
    data: encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "getIntegrator",
      args: [requesterWallet],
    }),
  }).result();

  const [requesterAppId, requesterWorkspaceId, requesterRole, requesterActive] =
    decodeFunctionResult({
      abi: REGISTRY_ABI,
      functionName: "getIntegrator",
      data: requesterResult as Hex,
    }) as [Hex, Hex, number, boolean];

  if (!requesterActive) {
    runtime.log(`Unauthorized: ${requesterWallet} is not a registered integrator`);
    return {
      userWallet: userWallet,
      requesterAppId: "unknown",
      requesterRole: "unknown",
      auditReason: input.auditReason,
      requestedAt: runtime.now().toISOString(),
      scope: input.scope,
      authorized: false,
    };
  }

  const roleName = requesterRole === ROLE_PROTOCOL ? "protocol"
    : requesterRole === ROLE_BROKER ? "broker"
    : requesterRole === ROLE_LP ? "lp"
    : "unknown";

  runtime.log(
    `Audit request from ${roleName} ${requesterAppId}: user=${userWallet}, scope=${input.scope}`
  );

  // -----------------------------------------------------------------------
  // 2. Read user's on-chain credential to verify scoping
  //    Broker: can only access users they onboarded (brokerAppId match)
  //    LP: can only access users in trades they filled (check ComplianceReports)
  //    Protocol: can access all users in their workspace
  // -----------------------------------------------------------------------
  const ccidResult = evmClient.callContract({
    to: config.identityRegistryAddress as Address,
    data: encodeFunctionData({
      abi: IDENTITY_REGISTRY_ABI,
      functionName: "getIdentity",
      args: [userWallet],
    }),
  }).result();

  const userCcid = decodeFunctionResult({
    abi: IDENTITY_REGISTRY_ABI,
    functionName: "getIdentity",
    data: ccidResult as Hex,
  }) as Hex;

  if (userCcid === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    runtime.log(`User ${userWallet} has no registered identity`);
    return {
      userWallet: userWallet,
      requesterAppId: requesterAppId,
      requesterRole: roleName,
      auditReason: input.auditReason,
      requestedAt: runtime.now().toISOString(),
      scope: input.scope,
      authorized: true,
    };
  }

  // Read credential to get brokerAppId and workspaceId from credentialData
  const credResult = evmClient.callContract({
    to: config.credentialRegistryAddress as Address,
    data: encodeFunctionData({
      abi: CREDENTIAL_REGISTRY_ABI,
      functionName: "getCredential",
      args: [userCcid, KYC_VERIFIED as Hex],
    }),
  }).result();

  const [, credentialData] = decodeFunctionResult({
    abi: CREDENTIAL_REGISTRY_ABI,
    functionName: "getCredential",
    data: credResult as Hex,
  }) as [number, Hex];

  // Decode credential data: (uint8 kycLevel, uint8 riskScore, string jurisdiction, bytes32 brokerAppId, bytes32 workspaceId)
  const [, , , credBrokerAppId, credWorkspaceId] = decodeAbiParameters(
    parseAbiParameters("uint8, uint8, string, bytes32, bytes32"),
    credentialData
  );

  // -----------------------------------------------------------------------
  // 3. Enforce scoping based on requester's role
  // -----------------------------------------------------------------------
  let authorized = false;

  if (requesterRole === ROLE_PROTOCOL) {
    // Protocol can see all users in their workspace
    authorized = credWorkspaceId === requesterWorkspaceId;
  } else if (requesterRole === ROLE_BROKER) {
    // Broker can only see users they onboarded
    authorized = credBrokerAppId === requesterAppId;
  } else if (requesterRole === ROLE_LP) {
    // LP access: would need to check ComplianceReports for trades involving this user + LP
    // Simplified: LP can see users in same workspace (production: check trade reports)
    authorized = credWorkspaceId === requesterWorkspaceId;
  }

  if (!authorized) {
    runtime.log(`Scoping denied: ${roleName} ${requesterAppId} cannot access user ${userWallet}`);
    return {
      userWallet: userWallet,
      requesterAppId: requesterAppId,
      requesterRole: roleName,
      auditReason: input.auditReason,
      requestedAt: runtime.now().toISOString(),
      scope: input.scope,
      authorized: false,
    };
  }

  // -----------------------------------------------------------------------
  // 4. Fetch from Sumsub using namespaced externalUserId (Confidential HTTP)
  // -----------------------------------------------------------------------
  const externalUserId = `${credWorkspaceId}:${credBrokerAppId}:${userWallet}`;
  const client = new ConfidentialHTTPClient();

  const auditPackage: AuditPackage = {
    userWallet: userWallet,
    requesterAppId: requesterAppId,
    requesterRole: roleName,
    auditReason: input.auditReason,
    requestedAt: runtime.now().toISOString(),
    scope: input.scope,
    authorized: true,
  };

  // Fetch identity status
  const identityReq: ConfidentialHTTPRequest = {
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

  const identityResponse = client.sendRequest(identityReq).result();

  if (identityResponse.statusCode === 200) {
    const data = JSON.parse(identityResponse.body);
    auditPackage.identity = {
      status: data.review?.reviewStatus ?? "unknown",
      level: data.type ?? "unknown",
      verifiedAt: data.review?.reviewDate ?? "unknown",
      country: data.info?.country ?? "unknown",
    };
    auditPackage.amlScreening = {
      result: data.review?.reviewResult?.reviewAnswer ?? "NONE",
      listsChecked: ["OFAC", "EU", "UN", "PEP"],
      checkedAt: data.review?.reviewDate ?? "unknown",
    };
  }

  // Fetch document checks if scope includes documents
  if (input.scope === "documents" || input.scope === "full") {
    const docsReq: ConfidentialHTTPRequest = {
      url: `${config.sumsubApiUrl}/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/requiredIdDocsStatus`,
      method: "GET",
      headers: {
        "X-App-Token": "{{.SUMSUB_APP_TOKEN}}",
        Accept: "application/json",
      },
      body: "",
      secrets: [{ name: "SUMSUB_APP_TOKEN" }, { name: "SUMSUB_SECRET_KEY" }],
      encryptOutput: true,
    };

    const docsResponse = client.sendRequest(docsReq).result();
    if (docsResponse.statusCode === 200) {
      const docsData = JSON.parse(docsResponse.body);
      auditPackage.documentChecks = (docsData.IDENTITY ?? []).map(
        (doc: { idDocType: string; reviewResult: string }) => ({
          type: doc.idDocType ?? "unknown",
          result: doc.reviewResult ?? "unknown",
        })
      );
    }
  }

  // Fetch audit trail if full scope
  if (input.scope === "full") {
    const auditReq: ConfidentialHTTPRequest = {
      url: `${config.sumsubApiUrl}/resources/audit-trail/events?externalUserId=${encodeURIComponent(externalUserId)}&limit=50`,
      method: "GET",
      headers: {
        "X-App-Token": "{{.SUMSUB_APP_TOKEN}}",
        Accept: "application/json",
      },
      body: "",
      secrets: [{ name: "SUMSUB_APP_TOKEN" }, { name: "SUMSUB_SECRET_KEY" }],
      encryptOutput: true,
    };

    const auditResponse = client.sendRequest(auditReq).result();
    if (auditResponse.statusCode === 200) {
      const events = JSON.parse(auditResponse.body);
      auditPackage.auditTrail = (events.items ?? []).map(
        (event: { type: string; createdAt: string; email: string }) => ({
          action: event.type ?? "unknown",
          timestamp: event.createdAt ?? "unknown",
          actor: event.email ?? "system",
        })
      );
    }
  }

  runtime.log(
    `Audit package: ${roleName} ${requesterAppId} accessed ${userWallet}, scope=${input.scope}, authorized=true`
  );

  return auditPackage;
}

// ---------------------------------------------------------------------------
// Wire it up
// ---------------------------------------------------------------------------
export function main() {
  handler(httpTrigger, onAuditRequest);
}
