/**
 * Workflow A: Identity Verification
 *
 * Trigger: HTTP (frontend calls after user completes Sumsub SDK)
 * Flow: IntegratorRegistry read → Sumsub verify (HMAC-signed) → Chainalysis risk → writeReport credential
 *
 * Sumsub requires HMAC-SHA256 request signing (X-App-Access-Sig).
 * Noble hashes (@noble/hashes) is used for HMAC in the QuickJS WASM runtime.
 * In production: secrets from Vault DON. In simulation: from config for demo.
 */
import {
  cre,
  Runner,
  type Runtime,
  type HTTPPayload,
  getNetwork,
  encodeCallMsg,
} from "@chainlink/cre-sdk";
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
import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config — includes Sumsub credentials for simulation (Vault DON in production)
// ---------------------------------------------------------------------------
const configSchema = z.object({
  sumsubApiUrl: z.string(),
  sumsubLevelName: z.string(),
  sumsubAppToken: z.string(),
  sumsubSecretKey: z.string(),
  chainalysisApiUrl: z.string(),
  chainalysisApiKey: z.string(),
  consumerContractAddress: z.string(),
  integratorRegistryAddress: z.string(),
  chainSelectorName: z.string(),
});

type Config = z.infer<typeof configSchema>;

// ---------------------------------------------------------------------------
// Sumsub HMAC-SHA256 signing (using Noble hashes — works in QuickJS WASM)
// ---------------------------------------------------------------------------
function sumsubSign(secretKey: string, ts: string, method: string, path: string, body: string = ""): string {
  const signingString = ts + method + path + body;
  const sig = hmac(sha256, new TextEncoder().encode(secretKey), new TextEncoder().encode(signingString));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function sumsubHeaders(config: Config, now: Date, method: string, path: string, body: string = ""): { [key: string]: string } {
  const ts = Math.floor(now.getTime() / 1000).toString();
  const sig = sumsubSign(config.sumsubSecretKey, ts, method, path, body);
  return {
    "X-App-Token": config.sumsubAppToken,
    "X-App-Access-Sig": sig,
    "X-App-Access-Ts": ts,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const REGISTRY_ABI = parseAbi([
    "function getIntegrator(address) view returns (bytes32, bytes32, uint8, bool)",
  ]);
  const KYC_VERIFIED = keccak256(encodePacked(["string"], ["KYC_VERIFIED"]));

  const raw = new TextDecoder().decode(payload.input);
  const { walletAddress } = JSON.parse(raw) as { walletAddress: string };
  const wallet = walletAddress as Address;
  runtime.log(`Identity verification: wallet=${wallet}`);

  // 1. Read IntegratorRegistry on-chain
  const network = getNetwork({ chainFamily: "evm", chainSelectorName: runtime.config.chainSelectorName, isTestnet: true });
  if (!network) throw new Error(`Network not found: ${runtime.config.chainSelectorName}`);

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const callData = encodeFunctionData({ abi: REGISTRY_ABI, functionName: "getIntegrator", args: [wallet] });
  const regResult = evmClient.callContract(runtime, {
    call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000", to: runtime.config.integratorRegistryAddress, data: callData }),
  }).result();

  let brokerAppId: Hex = keccak256(toHex("self-onboard"));
  let wsId: Hex = keccak256(toHex("default"));
  try {
    const decoded = decodeFunctionResult({ abi: REGISTRY_ABI, functionName: "getIntegrator", data: regResult as unknown as Hex }) as [Hex, Hex, number, boolean];
    if (decoded[3]) { brokerAppId = decoded[0]; wsId = decoded[1]; }
  } catch { runtime.log("IntegratorRegistry lookup failed — using defaults"); }

  const externalUserId = `${wsId}:${brokerAppId}:${wallet}`;

  // 2. Sumsub KYC check (regular HTTP with HMAC signing via Noble hashes)
  const http = new cre.capabilities.HTTPClient();
  const now = runtime.now();

  // Try to get existing applicant
  const getPath = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
  const getResp = http.sendRequest(runtime, {
    url: `${runtime.config.sumsubApiUrl}${getPath}`,
    method: "GET",
    headers: sumsubHeaders(runtime.config, now, "GET", getPath),
  }).result();

  runtime.log(`Sumsub GET status: ${getResp.statusCode}`);

  if (getResp.statusCode === 404) {
    // Create applicant
    const createPath = `/resources/applicants?levelName=${runtime.config.sumsubLevelName}`;
    const createBody = JSON.stringify({ externalUserId, type: "individual" });
    const createResp = http.sendRequest(runtime, {
      url: `${runtime.config.sumsubApiUrl}${createPath}`,
      method: "POST",
      body: Buffer.from(createBody).toString("base64"),
      headers: sumsubHeaders(runtime.config, now, "POST", createPath, createBody),
    }).result();

    runtime.log(`Sumsub create: ${createResp.statusCode} ${Buffer.from(createResp.body).toString("utf-8").slice(0, 200)}`);
    return JSON.stringify({ status: "applicant_created", wallet, sumsubStatus: createResp.statusCode });
  }

  if (getResp.statusCode !== 200) {
    const errBody = Buffer.from(getResp.body).toString("utf-8").slice(0, 200);
    runtime.log(`Sumsub error: ${getResp.statusCode} ${errBody}`);
    return JSON.stringify({ status: "sumsub_error", statusCode: getResp.statusCode, wallet });
  }

  const applicant = JSON.parse(Buffer.from(getResp.body).toString("utf-8")) as {
    id: string;
    review: { reviewStatus: string; reviewResult?: { reviewAnswer: string } };
    info?: { country?: string };
  };

  runtime.log(`Sumsub applicant: id=${applicant.id}, status=${applicant.review.reviewStatus}`);

  if (!(applicant.review.reviewStatus === "completed" && applicant.review.reviewResult?.reviewAnswer === "GREEN")) {
    return JSON.stringify({ status: "not_approved", wallet, reviewStatus: applicant.review.reviewStatus });
  }

  // 3. Chainalysis wallet risk (simple API key auth)
  const chResp = http.sendRequest(runtime, {
    url: `${runtime.config.chainalysisApiUrl}/entities/${wallet}`,
    method: "GET",
    headers: {
      Token: runtime.config.chainalysisApiKey,
      Accept: "application/json",
    },
  }).result();

  const riskScore = chResp.statusCode === 200 ? (JSON.parse(Buffer.from(chResp.body).toString("utf-8")).riskScore ?? 0) : 0;
  runtime.log(`Chainalysis risk: ${riskScore} (status ${chResp.statusCode})`);

  // 4. Build credential + write on-chain
  const ccid = keccak256(encodePacked(["string", "address"], ["compliance-v1", wallet]));
  const jurisdiction = applicant.info?.country ?? "UNKNOWN";
  const expiresAt = Math.floor(now.getTime() / 1000) + 365 * 24 * 60 * 60;

  const credData = encodeAbiParameters(
    parseAbiParameters("uint8, uint8, string, bytes32, bytes32"),
    [2, riskScore, jurisdiction, brokerAppId, wsId]
  );
  const reportPayload = encodeAbiParameters(
    parseAbiParameters("address, bytes32, bytes32, uint40, bytes"),
    [wallet, ccid as Hex, KYC_VERIFIED, expiresAt, credData]
  );

  const report = runtime.report(reportPayload);
  evmClient.writeReport(runtime, runtime.config.consumerContractAddress as Address, report, { gasLimit: "500000" }).result();

  runtime.log(`Credential issued: wallet=${wallet}, risk=${riskScore}, jurisdiction=${jurisdiction}`);
  return JSON.stringify({ status: "verified", wallet, riskScore, jurisdiction });
};

// ---------------------------------------------------------------------------
// Init + main
// ---------------------------------------------------------------------------
function initWorkflow(config: Config) {
  const httpTrigger = new cre.capabilities.HTTPCapability();
  return [cre.handler(httpTrigger.trigger({}), onHttpTrigger)];
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
