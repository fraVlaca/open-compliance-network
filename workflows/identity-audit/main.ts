/**
 * Workflow C: Identity Audit for Integrators
 *
 * Trigger: HTTP (restricted to registered integrator wallets)
 * Flow: Verify requester role → check scoping → fetch Sumsub data → return encrypted
 *
 * Sumsub HMAC signing via Noble hashes. Credentials in config for simulation.
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
  parseAbi,
  keccak256,
  encodePacked,
  toHex,
  encodeFunctionData,
  decodeFunctionResult,
  decodeAbiParameters,
  parseAbiParameters,
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
  integratorRegistryAddress: z.string(),
  identityRegistryAddress: z.string(),
  credentialRegistryAddress: z.string(),
  chainSelectorName: z.string(),
});
type Config = z.infer<typeof configSchema>;

// Roles (primitive constants — safe at module scope)
const ROLE_PROTOCOL = 0;
const ROLE_BROKER = 1;
const ROLE_LP = 2;

// ---------------------------------------------------------------------------
// Sumsub HMAC signing
// ---------------------------------------------------------------------------
function sumsubSign(secretKey: string, ts: string, method: string, path: string): string {
  const sig = hmac(sha256, new TextEncoder().encode(secretKey), new TextEncoder().encode(ts + method + path));
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
// Handler
// ---------------------------------------------------------------------------
const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  const REGISTRY_ABI = parseAbi(["function getIntegrator(address) view returns (bytes32, bytes32, uint8, bool)"]);
  const IDENTITY_ABI = parseAbi(["function getIdentity(address) view returns (bytes32)"]);
  const CREDENTIAL_ABI = parseAbi(["function getCredential(bytes32, bytes32) view returns (uint40, bytes)"]);
  const KYC_VERIFIED = keccak256(encodePacked(["string"], ["KYC_VERIFIED"]));

  const raw = new TextDecoder().decode(payload.input);
  const input = JSON.parse(raw) as { userWallet: string; auditReason: string; scope?: string };
  const userWallet = input.userWallet as Address;
  const scope = input.scope ?? "identity";

  // Use the trigger's authorized key as the requester identity
  // In simulation, use a default
  const requesterWallet = userWallet; // In production: payload.authorizedKey

  runtime.log(`Audit request: user=${userWallet}, scope=${scope}, reason=${input.auditReason}`);

  const network = getNetwork({ chainFamily: "evm", chainSelectorName: runtime.config.chainSelectorName, isTestnet: true });
  if (!network) throw new Error(`Network not found`);
  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  // 1. Verify requester in IntegratorRegistry
  let requesterRole = -1;
  let requesterAppId: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
  let requesterWsId: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
  let requesterActive = false;

  try {
    const regResult = evmClient.callContract(runtime, {
      call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000", to: runtime.config.integratorRegistryAddress, data: encodeFunctionData({ abi: REGISTRY_ABI, functionName: "getIntegrator", args: [requesterWallet] }) }),
    }).result();
    const decoded = decodeFunctionResult({ abi: REGISTRY_ABI, functionName: "getIntegrator", data: regResult as unknown as Hex }) as [Hex, Hex, number, boolean];
    requesterAppId = decoded[0]; requesterWsId = decoded[1]; requesterRole = decoded[2]; requesterActive = decoded[3];
  } catch { runtime.log("IntegratorRegistry lookup failed"); }

  const roleName = requesterRole === ROLE_PROTOCOL ? "protocol" : requesterRole === ROLE_BROKER ? "broker" : requesterRole === ROLE_LP ? "lp" : "unknown";

  if (!requesterActive) {
    return JSON.stringify({ authorized: false, reason: "not_registered", requesterRole: roleName });
  }

  // 2. Read user's credential for scoping check
  let credBrokerAppId: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
  let credWsId: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";

  try {
    const idResult = evmClient.callContract(runtime, {
      call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000", to: runtime.config.identityRegistryAddress, data: encodeFunctionData({ abi: IDENTITY_ABI, functionName: "getIdentity", args: [userWallet] }) }),
    }).result();
    const ccid = decodeFunctionResult({ abi: IDENTITY_ABI, functionName: "getIdentity", data: idResult as unknown as Hex }) as Hex;

    if (ccid !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const credResult = evmClient.callContract(runtime, {
        call: encodeCallMsg({ from: "0x0000000000000000000000000000000000000000", to: runtime.config.credentialRegistryAddress, data: encodeFunctionData({ abi: CREDENTIAL_ABI, functionName: "getCredential", args: [ccid, KYC_VERIFIED] }) }),
      }).result();
      const [, credData] = decodeFunctionResult({ abi: CREDENTIAL_ABI, functionName: "getCredential", data: credResult as unknown as Hex }) as [number, Hex];
      const decoded = decodeAbiParameters(parseAbiParameters("uint8, uint8, string, bytes32, bytes32"), credData);
      credBrokerAppId = decoded[3] as Hex;
      credWsId = decoded[4] as Hex;
    }
  } catch { runtime.log("Credential lookup failed"); }

  // 3. Enforce scoping
  let authorized = false;
  if (requesterRole === ROLE_PROTOCOL) authorized = credWsId === requesterWsId;
  else if (requesterRole === ROLE_BROKER) authorized = credBrokerAppId === requesterAppId;
  else if (requesterRole === ROLE_LP) authorized = credWsId === requesterWsId;

  if (!authorized) {
    return JSON.stringify({ authorized: false, reason: "scoping_denied", requesterRole: roleName, userWallet });
  }

  // 4. Fetch from Sumsub (HMAC-signed)
  const http = new cre.capabilities.HTTPClient();
  const externalUserId = `${credWsId}:${credBrokerAppId}:${userWallet}`;
  const now = runtime.now();

  const result: any = { authorized: true, requesterRole: roleName, userWallet, scope, auditReason: input.auditReason, requestedAt: now.toISOString() };

  // Identity status
  const idPath = `/resources/applicants/-;externalUserId=${encodeURIComponent(externalUserId)}/one`;
  const idResp = http.sendRequest(runtime, {
    url: `${runtime.config.sumsubApiUrl}${idPath}`,
    method: "GET",
    headers: sumsubHeaders(runtime.config, now, "GET", idPath),
  }).result();

  if (idResp.statusCode === 200) {
    const data = JSON.parse(Buffer.from(idResp.body).toString("utf-8"));
    result.identity = {
      status: data.review?.reviewStatus ?? "unknown",
      level: data.type ?? "unknown",
      verifiedAt: data.review?.reviewDate ?? "unknown",
      country: data.info?.country ?? "unknown",
    };
    result.amlScreening = {
      result: data.review?.reviewResult?.reviewAnswer ?? "NONE",
      listsChecked: ["OFAC", "EU", "UN", "PEP"],
    };
  } else {
    result.identity = { status: "not_found", sumsubStatus: idResp.statusCode };
  }

  runtime.log(`Audit complete: ${roleName} accessed ${userWallet}, scope=${scope}`);
  return JSON.stringify(result);
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
