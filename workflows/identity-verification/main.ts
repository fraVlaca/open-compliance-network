/**
 * Workflow A: Identity Verification
 *
 * Trigger: HTTP (integrator backend calls after user completes Sumsub iframe)
 * Flow: IntegratorRegistry read → Sumsub verify (Confidential HTTP) → Chainalysis risk (Confidential HTTP) → writeReport
 *
 * Privacy: Sumsub App Token injected via {{.sumsubAppToken}} - stays in Vault DON / TEE enclave.
 * Chainalysis API key injected via {{.chainalysisApiKey}} - stays in Vault DON.
 * HMAC-SHA256 computed in handler (needs secret key), passed as plain header value.
 *
 * Qualifies for: Chainlink privacy standard track (Confidential HTTP + Vault DON secrets)
 */
import {
  cre,
  Runner,
  ConfidentialHTTPClient,
  ok,
  bytesToHex,
  handler,
  prepareReportRequest,
  encodeCallMsg,
  getNetwork,
  type Runtime,
  type HTTPPayload,
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
// Config - sumsubAppToken + chainalysisApiKey in Vault DON secrets, NOT config
// sumsubSecretKey in config for HMAC computation.
// Production: runtime.getSecret("sumsubSecretKey")
// ---------------------------------------------------------------------------
const configSchema = z.object({
  sumsubApiUrl: z.string(),
  sumsubLevelName: z.string(),
  sumsubSecretKey: z.string(),
  chainalysisApiUrl: z.string(),
  consumerContractAddress: z.string(),
  integratorRegistryAddress: z.string(),
  chainSelectorName: z.string(),
  owner: z.string(),
});
type Config = z.infer<typeof configSchema>;

// ---------------------------------------------------------------------------
// HMAC-SHA256 signing (Noble hashes - works in QuickJS WASM)
// ---------------------------------------------------------------------------
function sumsubSign(secretKey: string, ts: string, method: string, path: string, body: string = ""): string {
  const sig = hmac(sha256, new TextEncoder().encode(secretKey), new TextEncoder().encode(ts + method + path + body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Confidential HTTP helpers - credentials stay in TEE enclave
// ---------------------------------------------------------------------------
function confSumsubRequest(
  client: ConfidentialHTTPClient, runtime: Runtime<Config>,
  url: string, method: string, hmacSig: string, ts: string, bodyString?: string
) {
  return client.sendRequest(runtime, {
    vaultDonSecrets: [{ key: "sumsubAppToken", owner: runtime.config.owner }],
    request: {
      url,
      method,
      multiHeaders: {
        "X-App-Token": { values: ["{{.sumsubAppToken}}"] },
        "X-App-Access-Sig": { values: [hmacSig] },
        "X-App-Access-Ts": { values: [ts] },
        Accept: { values: ["application/json"] },
        "Content-Type": { values: ["application/json"] },
      },
      ...(bodyString ? { bodyString } : {}),
    },
  }).result();
}

function confChainalysisGet(client: ConfidentialHTTPClient, runtime: Runtime<Config>, url: string) {
  return client.sendRequest(runtime, {
    vaultDonSecrets: [{ key: "chainalysisApiKey", owner: runtime.config.owner }],
    request: {
      url,
      method: "GET",
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
    call: encodeCallMsg({
      from: "0x0000000000000000000000000000000000000000" as Address,
      to: runtime.config.integratorRegistryAddress as Address,
      data: callData,
    }),
  }).result();

  let brokerAppId: Hex = keccak256(toHex("self-onboard"));
  let wsId: Hex = keccak256(toHex("default"));
  try {
    const decoded = decodeFunctionResult({ abi: REGISTRY_ABI, functionName: "getIntegrator", data: bytesToHex(regResult.data) as Hex }) as [Hex, Hex, number, boolean];
    if (decoded[3]) { brokerAppId = decoded[0]; wsId = decoded[1]; }
  } catch { runtime.log("IntegratorRegistry lookup failed - using defaults"); }

  const externalUserId = `${wsId}:${brokerAppId}:${wallet}`;
  runtime.log(`externalUserId=${externalUserId.slice(0, 50)}...`);
  runtime.log(`wsId=${wsId.slice(0,16)}... brokerAppId=${brokerAppId.slice(0,16)}...`);

  // 2. Sumsub KYC check via Confidential HTTP
  const confHTTP = new ConfidentialHTTPClient();
  const now = runtime.now();
  const ts = Math.floor(now.getTime() / 1000).toString();

  const getPath = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
  const getHmac = sumsubSign(runtime.config.sumsubSecretKey, ts, "GET", getPath);
  const getResp = confSumsubRequest(confHTTP, runtime, `${runtime.config.sumsubApiUrl}${getPath}`, "GET", getHmac, ts);

  runtime.log(`Sumsub GET status: ${getResp.statusCode}`);

  if (getResp.statusCode === 404) {
    const createPath = `/resources/applicants?levelName=${runtime.config.sumsubLevelName}`;
    const createBody = JSON.stringify({ externalUserId, type: "individual" });
    const createHmac = sumsubSign(runtime.config.sumsubSecretKey, ts, "POST", createPath, createBody);
    const createResp = confSumsubRequest(confHTTP, runtime, `${runtime.config.sumsubApiUrl}${createPath}`, "POST", createHmac, ts, createBody);

    runtime.log(`Sumsub create: ${createResp.statusCode} ${respText(createResp).slice(0, 200)}`);
    return JSON.stringify({ status: "applicant_created", wallet, sumsubStatus: createResp.statusCode });
  }

  if (getResp.statusCode !== 200) {
    runtime.log(`Sumsub error: ${getResp.statusCode} ${respText(getResp).slice(0, 200)}`);
    return JSON.stringify({ status: "sumsub_error", statusCode: getResp.statusCode, wallet });
  }

  const applicant = JSON.parse(respText(getResp)) as {
    id: string;
    review: { reviewStatus: string; reviewResult?: { reviewAnswer: string } };
    info?: { country?: string };
  };

  runtime.log(`Sumsub applicant: id=${applicant.id}, status=${applicant.review.reviewStatus}`);

  if (!(applicant.review.reviewStatus === "completed" && applicant.review.reviewResult?.reviewAnswer === "GREEN")) {
    return JSON.stringify({ status: "not_approved", wallet, reviewStatus: applicant.review.reviewStatus });
  }

  // 3. Chainalysis wallet risk via Confidential HTTP
  const chResp = confChainalysisGet(confHTTP, runtime, `${runtime.config.chainalysisApiUrl}/entities/${wallet}`);
  const riskScore = chResp.statusCode === 200 ? (JSON.parse(respText(chResp)).riskScore ?? 0) : 0;
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

  // prepareReportRequest converts hex payload to the format runtime.report() expects
  const reportReq = prepareReportRequest(reportPayload);
  const report = runtime.report(reportReq).result();
  const writeResult = evmClient.writeReport(runtime, {
    receiver: runtime.config.consumerContractAddress,
    report,
    gasConfig: { gasLimit: "500000" },
  }).result();

  // Log the write result - check if tx actually submitted
  const txHash = writeResult.txHash ? bytesToHex(writeResult.txHash) : "none";
  runtime.log(`writeReport result: txStatus=${writeResult.txStatus}, txHash=${txHash}, error=${writeResult.errorMessage || "none"}`);
  runtime.log(`Credential issued: wallet=${wallet}, risk=${riskScore}, jurisdiction=${jurisdiction}`);
  return JSON.stringify({ status: "verified", wallet, riskScore, jurisdiction });
};

// ---------------------------------------------------------------------------
// Init + main
// ---------------------------------------------------------------------------
function initWorkflow(config: Config) {
  const httpTrigger = new cre.capabilities.HTTPCapability();
  return [handler(httpTrigger.trigger({}), onHttpTrigger)];
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();
