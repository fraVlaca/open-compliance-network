import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type Address,
  type Hex,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  encodePacked,
  toHex,
  pad,
  concat,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  RPC_URL,
  CHAIN_ID,
  CONTRACTS,
  CREDENTIAL_CONSUMER_ABI,
  INTEGRATOR_REGISTRY_ABI,
} from "./config";

// ---------------------------------------------------------------------------
// Arc Testnet chain definition
// ---------------------------------------------------------------------------
const arcTestnet = defineChain({
  id: CHAIN_ID,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
});

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(RPC_URL),
});

// Wallet client for on-chain writes (credential issuance)
// In simulation mode, CRE's writeReport() doesn't land on the real chain,
// so the backend writes the credential directly using the deployer key.
// In production, CRE DON handles writes - this fallback is removed.
const deployerKey = process.env.CRE_ETH_PRIVATE_KEY as Hex | undefined;
const walletClient = deployerKey
  ? createWalletClient({
      account: privateKeyToAccount(`0x${deployerKey.replace("0x", "")}`),
      chain: arcTestnet,
      transport: http(RPC_URL),
    })
  : null;

// ---------------------------------------------------------------------------
// On-chain reads
// ---------------------------------------------------------------------------

export async function isVerified(wallet: Address): Promise<boolean> {
  return publicClient.readContract({
    address: CONTRACTS.credentialConsumer,
    abi: CREDENTIAL_CONSUMER_ABI,
    functionName: "isVerified",
    args: [wallet],
  });
}

export async function getIntegrator(wallet: Address) {
  const [appId, workspaceId, role, active] = await publicClient.readContract({
    address: CONTRACTS.integratorRegistry,
    abi: INTEGRATOR_REGISTRY_ABI,
    functionName: "getIntegrator",
    args: [wallet],
  });
  return { appId, workspaceId, role, active };
}

/**
 * Issue a KYC credential on-chain by calling onReport() directly.
 *
 * In simulation mode, CRE's writeReport() goes through a mock forwarder
 * that doesn't match the deployed consumer contract's keystoneForwarder.
 * This fallback writes the credential using the deployer key (which IS
 * set as the keystoneForwarder on the consumer contract).
 *
 * In production with CRE DON: this function is not needed - CRE writes via
 * the real KeystoneForwarder with DON threshold signatures.
 */
export async function issueCredential(wallet: Address): Promise<Hex | null> {
  if (!walletClient) {
    console.log("[chain] No deployer key - skipping credential write");
    return null;
  }

  const KYC_VERIFIED = keccak256(encodePacked(["string"], ["KYC_VERIFIED"]));
  const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

  // Build metadata (same layout as KeystoneForwarder)
  const workflowCid = ZERO_BYTES32;
  const workflowName = pad(toHex("demo-wf"), { size: 10, dir: "right" });
  const ownerBytes = walletClient.account.address.toLowerCase() as Hex;
  const reportName = "0x0001" as Hex;
  const metadata = concat([workflowCid, workflowName, ownerBytes, reportName]);

  // Build credential report
  const ccid = keccak256(encodePacked(["string", "address"], ["compliance-v1", wallet]));
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
  const credData = encodeAbiParameters(
    parseAbiParameters("uint8, uint8, string, bytes32, bytes32"),
    [2, 1, "UNKNOWN", ZERO_BYTES32, ZERO_BYTES32]
  );
  const report = encodeAbiParameters(
    parseAbiParameters("address, bytes32, bytes32, uint40, bytes"),
    [wallet, ccid, KYC_VERIFIED, expiresAt, credData]
  );

  const ONREPORT_ABI = [{
    name: "onReport", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "metadata", type: "bytes" }, { name: "report", type: "bytes" }],
    outputs: [],
  }] as const;

  const txHash = await walletClient.writeContract({
    address: CONTRACTS.credentialConsumer,
    abi: ONREPORT_ABI,
    functionName: "onReport",
    args: [metadata, report],
  });

  console.log(`[chain] Credential issued for ${wallet}: ${txHash}`);
  return txHash;
}

/**
 * Write a per-trade compliance report on-chain.
 * Same fallback as issueCredential - CRE simulation can't write,
 * so the backend writes directly.
 */
export async function issueTradeReport(
  tradeId: Hex,
  trader: Address,
  counterparty: Address,
  sourceContract: Address,
  approved: boolean,
  riskScore: number
): Promise<Hex | null> {
  if (!walletClient) return null;

  const auditHash = keccak256(toHex(JSON.stringify({ tradeId, approved, ts: Date.now() })));
  const timestamp = BigInt(Math.floor(Date.now() / 1000));
  const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex;

  const report = encodeAbiParameters(
    parseAbiParameters("bytes32, address, address, address, bool, uint8, bytes32, string, uint256"),
    [tradeId, trader, counterparty, sourceContract, approved, riskScore, auditHash, "", timestamp]
  );

  // Build metadata
  const workflowCid = ZERO_BYTES32;
  const workflowName = pad(toHex("trade-wf"), { size: 10, dir: "right" });
  const ownerBytes = walletClient.account.address.toLowerCase() as Hex;
  const reportName = "0x0001" as Hex;
  const metadata = concat([workflowCid, workflowName, ownerBytes, reportName]);

  const ONREPORT_ABI = [{
    name: "onReport", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "metadata", type: "bytes" }, { name: "report", type: "bytes" }],
    outputs: [],
  }] as const;

  const txHash = await walletClient.writeContract({
    address: CONTRACTS.reportConsumer,
    abi: ONREPORT_ABI,
    functionName: "onReport",
    args: [metadata, report],
  });

  console.log(`[chain] Trade report issued for ${tradeId}: approved=${approved}, tx=${txHash}`);
  return txHash;
}

export async function isActive(wallet: Address): Promise<boolean> {
  return publicClient.readContract({
    address: CONTRACTS.integratorRegistry,
    abi: INTEGRATOR_REGISTRY_ABI,
    functionName: "isActive",
    args: [wallet],
  });
}
