import { createPublicClient, http, defineChain, type Address } from "viem";
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

export async function isActive(wallet: Address): Promise<boolean> {
  return publicClient.readContract({
    address: CONTRACTS.integratorRegistry,
    abi: INTEGRATOR_REGISTRY_ABI,
    functionName: "isActive",
    args: [wallet],
  });
}
