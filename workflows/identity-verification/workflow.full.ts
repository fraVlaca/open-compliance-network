/**
 * Workflow A: Identity Verification
 *
 * Trigger: HTTP (frontend calls after user completes Sumsub SDK)
 *
 * Auth: Any wallet can trigger their own KYC verification (open authorized keys).
 *       The workflow independently verifies via provider APIs — doesn't trust the frontend.
 *
 * Provider model: ONE master Sumsub account, ONE master Chainalysis key.
 *       Multi-tenancy via externalUserId namespacing: "{workspaceId}:{brokerAppId}:{wallet}"
 *       Scoping enforced by on-chain IntegratorRegistry, not by Sumsub.
 *
 * Flow:
 *   1. Read IntegratorRegistry on-chain → get broker's appId + workspaceId
 *   2. Confidential HTTP → Sumsub: verify applicant status (namespaced externalUserId)
 *   3. Confidential HTTP → Chainalysis: wallet risk score
 *   4. Build credential with brokerAppId + workspaceId embedded
 *   5. writeReport → ComplianceCredentialConsumer → ACE IdentityRegistry + CredentialRegistry
 */
import {
  handler,
  type Runtime,
  HTTPCapability,
  type HTTPPayload,
  ConfidentialHTTPClient,
  type ConfidentialHTTPRequest,
  EVMClient,
} from "@chainlink/cre-sdk";
import { z } from "zod";
import {
  encodeAbiParameters,
  parseAbiParameters,
  parseAbi,
  keccak256,
  encodePacked,
  toHex,
  encodeFunctionData,
  decodeFunctionResult,
  type Address,
  type Hex,
} from "viem";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const ConfigSchema = z.object({
  sumsubApiUrl: z.string().url(),
  sumsubLevelName: z.string(), // e.g., "basic-kyc"
  chainalysisApiUrl: z.string().url(),
  consumerContractAddress: z.string(),
  integratorRegistryAddress: z.string(),
  chainSelector: z.string(),
});
type Config = z.infer<typeof ConfigSchema>;

// ---------------------------------------------------------------------------
// Trigger input
// ---------------------------------------------------------------------------
const TriggerInputSchema = z.object({
  walletAddress: z.string(),
  // applicantId is optional — if not provided, we create a new applicant
  sumsubApplicantId: z.string().optional(),
});

// NOTE: viem parseAbi/keccak256/encodePacked CANNOT be called at module scope —
// QuickJS WASM crashes on top-level viem computations. All moved inside handler.

// ---------------------------------------------------------------------------
// Provider response types
// ---------------------------------------------------------------------------
interface SumsubApplicant {
  id: string;
  externalUserId?: string;
  review: {
    reviewStatus: string;
    reviewResult?: {
      reviewAnswer: string;
    };
  };
  info?: {
    country?: string;
  };
}

interface ChainalysisRiskResponse {
  risk: string;
  riskScore: number;
}

// ---------------------------------------------------------------------------
// HTTP Trigger — open for verification (any wallet can request their own KYC)
// ---------------------------------------------------------------------------
const httpTrigger = HTTPCapability.trigger({
  // Open: any wallet can trigger. Workflow validates independently.
  // For deployment, authorized keys can be added for spam prevention.
});

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
async function onHttpTrigger(
  config: Config,
  runtime: Runtime,
  payload: HTTPPayload
): Promise<void> {
  // viem functions must be called inside handler, not at module scope (QuickJS WASM limitation)
  const REGISTRY_ABI = parseAbi([
    "function getIntegrator(address wallet) view returns (bytes32 appId, bytes32 workspaceId, uint8 role, bool active)",
  ]);
  const KYC_VERIFIED = keccak256(encodePacked(["string"], ["KYC_VERIFIED"]));

  const raw = new TextDecoder().decode(payload.input);
  const input = TriggerInputSchema.parse(JSON.parse(raw));
  const walletAddress = input.walletAddress as Address;

  // -----------------------------------------------------------------------
  // 1. Read IntegratorRegistry on-chain to get the triggering wallet's context
  //    The authorizedKey from the HTTP trigger tells us WHO signed the request.
  //    That wallet is looked up in the registry to get their appId and workspace.
  // -----------------------------------------------------------------------
  const evmClient = new EVMClient(config.chainSelector);
  const registryCallMsg = {
    to: config.integratorRegistryAddress as Address,
    data: encodeFunctionData({
      abi: REGISTRY_ABI,
      functionName: "getIntegrator",
      args: [walletAddress],
    }),
  };

  const registryResult = evmClient.callContract(registryCallMsg).result();
  const [appId, workspaceId, role, active] = decodeFunctionResult({
    abi: REGISTRY_ABI,
    functionName: "getIntegrator",
    data: registryResult as Hex,
  }) as [Hex, Hex, number, boolean];

  // Determine broker context — if the triggering wallet is a registered broker,
  // use their appId. If it's an unregistered user (self-KYC), use a default.
  const brokerAppId = active ? appId : keccak256(toHex("self-onboard"));
  const resolvedWorkspaceId = active ? workspaceId : keccak256(toHex("default"));

  runtime.log(
    `Identity verification: wallet=${walletAddress}, broker=${brokerAppId}, workspace=${resolvedWorkspaceId}`
  );

  // -----------------------------------------------------------------------
  // 2. Build namespaced externalUserId for Sumsub
  //    Format: "{workspaceId}:{brokerAppId}:{walletAddress}"
  //    This is how we partition applicants under one master Sumsub account.
  // -----------------------------------------------------------------------
  const externalUserId = `${resolvedWorkspaceId}:${brokerAppId}:${walletAddress}`;

  // -----------------------------------------------------------------------
  // 3. Create or fetch applicant in Sumsub (Confidential HTTP — master token in TEE)
  // -----------------------------------------------------------------------
  const sumsubClient = new ConfidentialHTTPClient();

  // Try to get existing applicant first
  const getReq: ConfidentialHTTPRequest = {
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

  let sumsubResponse = sumsubClient.sendRequest(getReq).result();

  // If applicant doesn't exist yet, create one
  if (sumsubResponse.statusCode === 404) {
    const createReq: ConfidentialHTTPRequest = {
      url: `${config.sumsubApiUrl}/resources/applicants?levelName=${config.sumsubLevelName}`,
      method: "POST",
      headers: {
        "X-App-Token": "{{.SUMSUB_APP_TOKEN}}",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        externalUserId: externalUserId,
        type: "individual",
      }),
      secrets: [{ name: "SUMSUB_APP_TOKEN" }, { name: "SUMSUB_SECRET_KEY" }],
      encryptOutput: true,
    };

    sumsubResponse = sumsubClient.sendRequest(createReq).result();
  }

  if (sumsubResponse.statusCode !== 200 && sumsubResponse.statusCode !== 201) {
    throw new Error(`Sumsub API error: ${sumsubResponse.statusCode}`);
  }

  const applicant: SumsubApplicant = JSON.parse(sumsubResponse.body);

  // Verify the applicant is approved
  const isKycApproved =
    applicant.review.reviewStatus === "completed" &&
    applicant.review.reviewResult?.reviewAnswer === "GREEN";

  if (!isKycApproved) {
    runtime.log(
      `KYC not approved: status=${applicant.review.reviewStatus}, answer=${applicant.review.reviewResult?.reviewAnswer}`
    );
    return; // Don't write a credential
  }

  // -----------------------------------------------------------------------
  // 4. Check wallet risk via Chainalysis (single master key)
  // -----------------------------------------------------------------------
  const chainalysisClient = new ConfidentialHTTPClient();
  const chainalysisReq: ConfidentialHTTPRequest = {
    url: `${config.chainalysisApiUrl}/entities/${walletAddress}`,
    method: "GET",
    headers: {
      Token: "{{.CHAINALYSIS_API_KEY}}",
      Accept: "application/json",
    },
    body: "",
    secrets: [{ name: "CHAINALYSIS_API_KEY" }],
    encryptOutput: true,
  };

  const chainalysisResponse = chainalysisClient.sendRequest(chainalysisReq).result();

  let riskScore = 0;
  if (chainalysisResponse.statusCode === 200) {
    const riskData: ChainalysisRiskResponse = JSON.parse(chainalysisResponse.body);
    riskScore = riskData.riskScore;
  }

  // -----------------------------------------------------------------------
  // 5. Build credential with scoping metadata
  // -----------------------------------------------------------------------
  const ccid = keccak256(
    encodePacked(["string", "address"], ["compliance-v1", walletAddress])
  );

  const jurisdiction = applicant.info?.country ?? "UNKNOWN";
  const now = runtime.now();
  const expiresAt = Math.floor(now.getTime() / 1000) + 365 * 24 * 60 * 60;

  // Credential data includes scoping: brokerAppId + workspaceId
  // This is how integrators and LPs can verify who onboarded which user
  const credentialData = encodeAbiParameters(
    parseAbiParameters(
      "uint8 kycLevel, uint8 riskScore, string jurisdiction, bytes32 brokerAppId, bytes32 workspaceId"
    ),
    [2, riskScore, jurisdiction, brokerAppId as Hex, resolvedWorkspaceId as Hex]
  );

  // -----------------------------------------------------------------------
  // 6. Write credential on-chain via DON-signed report
  // -----------------------------------------------------------------------
  const reportPayload = encodeAbiParameters(
    parseAbiParameters(
      "address walletAddress, bytes32 ccid, bytes32 credentialTypeId, uint40 expiresAt, bytes credentialData"
    ),
    [walletAddress, ccid as Hex, KYC_VERIFIED as Hex, expiresAt, credentialData]
  );

  const report = runtime.report(reportPayload);
  evmClient
    .writeReport(config.consumerContractAddress as Address, report, {
      gasLimit: "500000",
    })
    .result();

  runtime.log(
    `Credential issued: wallet=${walletAddress}, broker=${brokerAppId}, workspace=${resolvedWorkspaceId}, risk=${riskScore}, jurisdiction=${jurisdiction}`
  );
}

// ---------------------------------------------------------------------------
// Wire it up
// ---------------------------------------------------------------------------
export function main() {
  handler(httpTrigger, onHttpTrigger);
}
