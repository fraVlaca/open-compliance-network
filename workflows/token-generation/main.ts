/**
 * Workflow D: Sumsub Access Token Generation
 *
 * Trigger: HTTP (integrator backend calls to get a Sumsub access token)
 * Flow: Verify integrator on-chain → Create applicant (Confidential HTTP) → Generate token → Return
 *
 * Privacy: Sumsub App Token in Vault DON via {{.sumsubAppToken}} — never leaves TEE enclave.
 * The integrator backend NEVER sees the Sumsub API credentials.
 * Only CRE has the Sumsub App Token and Secret Key.
 *
 * This workflow does NOT write on-chain — it returns the access token via HTTP response.
 *
 * Qualifies for: Chainlink privacy standard track
 * - Confidential HTTP for credential-secure API integration
 * - Vault DON secrets for API key protection
 * - Safe access to regulated KYC APIs
 */
import {
  cre,
  Runner,
  ConfidentialHTTPClient,
  handler,
  encodeCallMsg,
  bytesToHex,
  getNetwork,
  type Runtime,
  type HTTPPayload,
} from "@chainlink/cre-sdk";
import {
  parseAbi,
  keccak256,
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
// Config — sumsubAppToken in Vault DON secrets, NOT config
// ---------------------------------------------------------------------------
const configSchema = z.object({
  sumsubApiUrl: z.string(),
  sumsubLevelName: z.string(),
  sumsubSecretKey: z.string(),
  integratorRegistryAddress: z.string(),
  chainSelectorName: z.string(),
  owner: z.string(),
});
type Config = z.infer<typeof configSchema>;

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
function confSumsubRequest(
  client: ConfidentialHTTPClient, runtime: Runtime<Config>,
  url: string, method: string, hmacSig: string, ts: string, bodyString?: string
) {
  return client.sendRequest(runtime, {
    vaultDonSecrets: [{ key: "sumsubAppToken", owner: runtime.config.owner }],
    request: {
      url, method,
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

  const raw = new TextDecoder().decode(payload.input);
  const input = JSON.parse(raw) as { walletAddress: string; integratorAddress?: string; appId?: string };
  const wallet = input.walletAddress as Address;
  runtime.log(`Token generation: wallet=${wallet}`);

  // 1. Verify integrator on-chain (if provided)
  let brokerAppId: Hex = keccak256(toHex("self-onboard"));
  let wsId: Hex = keccak256(toHex("default"));

  if (input.integratorAddress) {
    const network = getNetwork({ chainFamily: "evm", chainSelectorName: runtime.config.chainSelectorName, isTestnet: true });
    if (!network) throw new Error(`Network not found: ${runtime.config.chainSelectorName}`);
    const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

    try {
      const callData = encodeFunctionData({ abi: REGISTRY_ABI, functionName: "getIntegrator", args: [input.integratorAddress as Address] });
      const regResult = evmClient.callContract(runtime, {
        call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000" as Address, to: runtime.config.integratorRegistryAddress as Address, data: callData }),
      }).result();
      const decoded = decodeFunctionResult({ abi: REGISTRY_ABI, functionName: "getIntegrator", data: bytesToHex(regResult.data) as Hex }) as [Hex, Hex, number, boolean];

      if (!decoded[3]) {
        return JSON.stringify({ error: "integrator_not_active", integratorAddress: input.integratorAddress });
      }
      if (input.appId && decoded[0] !== input.appId) {
        return JSON.stringify({ error: "appid_mismatch", expected: decoded[0], provided: input.appId });
      }
      brokerAppId = decoded[0];
      wsId = decoded[1];
      runtime.log(`Integrator verified: appId=${brokerAppId.slice(0, 16)}...`);
    } catch (e) {
      runtime.log(`IntegratorRegistry lookup failed: ${e}`);
      return JSON.stringify({ error: "integrator_lookup_failed" });
    }
  }

  // 2. Build externalUserId — must match Workflow A for applicant lookup
  const externalUserId = `${wsId}:${brokerAppId}:${wallet}`;
  runtime.log(`externalUserId=${externalUserId.slice(0, 40)}...`);

  // 3. Create/get Sumsub applicant via Confidential HTTP
  const confHTTP = new ConfidentialHTTPClient();
  const now = runtime.now();
  const ts = Math.floor(now.getTime() / 1000).toString();

  const getPath = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
  const getHmac = sumsubSign(runtime.config.sumsubSecretKey, ts, "GET", getPath);
  const existingResp = confSumsubRequest(confHTTP, runtime, `${runtime.config.sumsubApiUrl}${getPath}`, "GET", getHmac, ts);

  if (existingResp.statusCode === 404) {
    const createPath = `/resources/applicants?levelName=${runtime.config.sumsubLevelName}`;
    const createBody = JSON.stringify({ externalUserId, type: "individual" });
    const createHmac = sumsubSign(runtime.config.sumsubSecretKey, ts, "POST", createPath, createBody);
    const createResp = confSumsubRequest(confHTTP, runtime, `${runtime.config.sumsubApiUrl}${createPath}`, "POST", createHmac, ts, createBody);

    if (createResp.statusCode !== 201 && createResp.statusCode !== 200) {
      runtime.log(`Sumsub create failed: ${createResp.statusCode} ${respText(createResp).slice(0, 200)}`);
      return JSON.stringify({ error: "applicant_creation_failed", statusCode: createResp.statusCode });
    }
    runtime.log(`Applicant created`);
  } else if (existingResp.statusCode !== 200) {
    return JSON.stringify({ error: "sumsub_error", statusCode: existingResp.statusCode });
  } else {
    runtime.log(`Applicant exists`);
  }

  // 4. Generate access token via Confidential HTTP POST
  const tokenPath = `/resources/accessTokens/sdk`;
  const tokenBody = JSON.stringify({ userId: externalUserId, levelName: runtime.config.sumsubLevelName, ttlInSecs: 3600 });
  const tokenHmac = sumsubSign(runtime.config.sumsubSecretKey, ts, "POST", tokenPath, tokenBody);
  const tokenResp = confSumsubRequest(confHTTP, runtime, `${runtime.config.sumsubApiUrl}${tokenPath}`, "POST", tokenHmac, ts, tokenBody);

  if (tokenResp.statusCode !== 200 && tokenResp.statusCode !== 201) {
    runtime.log(`Token generation failed: ${tokenResp.statusCode} ${respText(tokenResp).slice(0, 200)}`);
    return JSON.stringify({ error: "token_generation_failed", statusCode: tokenResp.statusCode });
  }

  const tokenData = JSON.parse(respText(tokenResp)) as { token: string; userId: string };
  runtime.log(`Access token generated for ${tokenData.userId}`);

  return JSON.stringify({
    accessToken: tokenData.token,
    userId: tokenData.userId,
    externalUserId,
    levelName: runtime.config.sumsubLevelName,
  });
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
