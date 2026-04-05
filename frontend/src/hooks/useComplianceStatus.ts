import { useReadContract } from "wagmi";
import {
  CONTRACTS,
  CREDENTIAL_CONSUMER_ABI,
  INTEGRATOR_REGISTRY_ABI,
} from "../config/contracts";
import { type Address } from "viem";

export function useIsVerified(wallet: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.credentialConsumer,
    abi: CREDENTIAL_CONSUMER_ABI,
    functionName: "isVerified",
    args: wallet ? [wallet] : undefined,
    chainId: 5042002, // Force Arc Testnet
    query: {
      enabled: !!wallet,
      refetchInterval: 10_000,
      staleTime: 5_000,
      gcTime: 0, // don't cache across page loads
    },
  });
}

export function useIntegrator(wallet: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.integratorRegistry,
    abi: INTEGRATOR_REGISTRY_ABI,
    functionName: "getIntegrator",
    args: wallet ? [wallet] : undefined,
    query: { enabled: !!wallet },
  });
}

export function useIsActive(wallet: Address | undefined) {
  return useReadContract({
    address: CONTRACTS.integratorRegistry,
    abi: INTEGRATOR_REGISTRY_ABI,
    functionName: "isActive",
    args: wallet ? [wallet] : undefined,
    query: { enabled: !!wallet },
  });
}

export const ROLE_NAMES = ["Protocol", "Broker", "LP"] as const;
