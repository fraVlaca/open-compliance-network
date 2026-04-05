import { useState, useCallback } from "react";

export type LookupPhase = "idle" | "chain" | "cre" | "done";

export interface AuditResult {
  authorized: boolean;
  requesterRole?: string;
  reason?: string;
  encryptedIdentity?: string;
  encryptionNote?: string;
  identity?: {
    status: string;
    country: string;
  };
  amlScreening?: {
    riskScore?: number;
    sanctionsHits?: number;
    exposureFlags?: string[];
  };
}

export interface LookupResult {
  wallet?: string;
  isVerified?: boolean;
  audit?: AuditResult;
  error?: string;
}

const BACKEND_URL =
  (import.meta as any).env?.VITE_BACKEND_URL || "http://localhost:3001";

export function useComplianceLookup() {
  const [lookupAddress, setLookupAddress] = useState("");
  const [lookupPhase, setLookupPhase] = useState<LookupPhase>("idle");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  const handleLookup = useCallback(async () => {
    if (!lookupAddress) return;
    setLookupResult(null);

    // Phase 1: Quick on-chain check
    setLookupPhase("chain");
    try {
      const statusResp = await fetch(
        `${BACKEND_URL}/api/kyc/status/${lookupAddress}`
      );
      const statusData = await statusResp.json();
      setLookupResult(statusData);

      // Phase 2: CRE Workflow C — full compliance audit
      setLookupPhase("cre");
      const auditResp = await fetch(
        `${BACKEND_URL}/api/audit/${lookupAddress}?reason=compliance+lookup`
      );
      const auditData = await auditResp.json();
      setLookupResult((prev) => ({ ...prev, audit: auditData }));
      setLookupPhase("done");
    } catch (err: any) {
      setLookupResult((prev) => ({
        ...prev,
        wallet: lookupAddress,
        error: err.message,
      }));
      setLookupPhase("done");
    }
  }, [lookupAddress]);

  const reset = useCallback(() => {
    setLookupAddress("");
    setLookupPhase("idle");
    setLookupResult(null);
  }, []);

  return {
    lookupAddress,
    setLookupAddress,
    lookupPhase,
    lookupResult,
    handleLookup,
    reset,
  };
}
