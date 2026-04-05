import { useState, useCallback, useEffect } from "react";
import { useIsVerified } from "./useComplianceStatus";
import { type Address } from "viem";

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL || "http://localhost:3001";

export type KYCStep =
  | "idle"
  | "loading-token"
  | "sumsub"
  | "verifying"
  | "polling"
  | "done"
  | "error";

interface KYCState {
  step: KYCStep;
  sumsubToken: string | null;
  errorMsg: string;
}

/**
 * KYC flow state machine hook.
 *
 * On mount: checks on-chain isVerified(). If already verified, skips to "done".
 * Otherwise: idle → loading-token → sumsub → verifying → polling → done
 *
 * Calls the @ocn/node-sdk backend which triggers CRE workflows:
 *   - POST /api/kyc/token  → Workflow D (token generation)
 *   - POST /api/kyc/verify → Workflow A (identity verification)
 */
export function useKYCFlow(walletAddress: Address | undefined) {
  const [state, setState] = useState<KYCState>({
    step: "idle",
    sumsubToken: null,
    errorMsg: "",
  });

  const { data: onChainVerified, refetch: refetchVerified } = useIsVerified(
    walletAddress
  );

  // On mount / wallet change: if already verified on-chain, skip to done
  useEffect(() => {
    if (onChainVerified === true && state.step === "idle") {
      setState({ step: "done", sumsubToken: null, errorMsg: "" });
    }
  }, [onChainVerified, state.step]);

  /**
   * Step 1: Request a Sumsub access token from the backend.
   * Backend triggers CRE Workflow D (Confidential HTTP → Sumsub).
   */
  const startKYC = useCallback(
    async (targetWallet?: string) => {
      const wallet = targetWallet || walletAddress;
      if (!wallet) return;

      setState({ step: "loading-token", sumsubToken: null, errorMsg: "" });

      try {
        const resp = await fetch(`${BACKEND_URL}/api/kyc/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        });

        const data = await resp.json();

        if (!resp.ok || data.error) {
          throw new Error(data.error || data.details || "Token generation failed");
        }

        if (!data.accessToken) {
          throw new Error("No access token in response");
        }

        setState({
          step: "sumsub",
          sumsubToken: data.accessToken,
          errorMsg: "",
        });
      } catch (err: any) {
        setState({
          step: "error",
          sumsubToken: null,
          errorMsg:
            err.message?.includes("fetch")
              ? "Backend not running. Start it with: cd backend && bun run src/server.ts"
              : err.message || "Failed to generate token",
        });
      }
    },
    [walletAddress]
  );

  /**
   * Step 2: Called when Sumsub iframe fires onComplete.
   * Triggers CRE Workflow A to pull status + issue credential.
   */
  const onSumsubComplete = useCallback(
    async (targetWallet?: string) => {
      const wallet = targetWallet || walletAddress;
      if (!wallet) return;

      setState((s) => ({ ...s, step: "verifying", sumsubToken: null }));

      try {
        const resp = await fetch(`${BACKEND_URL}/api/kyc/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet }),
        });

        const data = await resp.json();

        if (data.status === "verified") {
          setState((s) => ({ ...s, step: "done" }));
          refetchVerified();
          return;
        }

        // Not verified yet - start polling on-chain
        setState((s) => ({ ...s, step: "polling" }));

        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          const { data: nowVerified } = await refetchVerified();
          if (nowVerified || attempts >= 10) {
            clearInterval(poll);
            setState((s) => ({
              ...s,
              step: nowVerified ? "done" : "error",
              errorMsg: nowVerified
                ? ""
                : `KYC status: ${data.status || "not_approved"}. Sumsub review may still be pending.`,
            }));
          }
        }, 3000);
      } catch (err: any) {
        setState((s) => ({
          ...s,
          step: "error",
          errorMsg: err.message || "Verification failed",
        }));
      }
    },
    [walletAddress, refetchVerified]
  );

  const reset = useCallback(() => {
    setState({ step: "idle", sumsubToken: null, errorMsg: "" });
  }, []);

  return {
    step: state.step,
    sumsubToken: state.sumsubToken,
    errorMsg: state.errorMsg,
    isVerified: onChainVerified === true,
    startKYC,
    onSumsubComplete,
    reset,
  };
}
