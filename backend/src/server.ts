import { Hono } from "hono";
import { cors } from "hono/cors";
import { type Address } from "viem";
import { PORT } from "./config";
import { isVerified, getIntegrator } from "./chain";
import { generateToken, verifyIdentity, checkTradeCompliance, auditIdentity } from "./cre";

const app = new Hono();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use("/*", cors({ origin: "*" }));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/health", (c) => c.json({ status: "ok", service: "@ocn/node-sdk" }));

// ---------------------------------------------------------------------------
// POST /api/kyc/token — Generate Sumsub access token via CRE Workflow D
//
// The backend triggers CRE which:
// 1. Verifies the integrator on-chain (IntegratorRegistry)
// 2. Calls Sumsub via Confidential HTTP (App Token in Vault DON)
// 3. Returns the access token (no on-chain write)
//
// The frontend uses this token to render the Sumsub iframe.
// ---------------------------------------------------------------------------
app.post("/api/kyc/token", async (c) => {
  const body = await c.req.json<{ wallet: string }>();
  if (!body.wallet) return c.json({ error: "wallet is required" }, 400);

  try {
    const result = await generateToken(body.wallet);

    if ("error" in result) {
      return c.json(result, 400);
    }

    return c.json({
      accessToken: result.accessToken,
      userId: result.userId,
      externalUserId: result.externalUserId,
    });
  } catch (err: any) {
    console.error("[/api/kyc/token] Error:", err.message);
    return c.json(
      { error: "Token generation failed", details: err.message?.slice(0, 200) },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// POST /api/kyc/verify — Verify KYC + issue credential via CRE Workflow A
//
// Called after the user completes the Sumsub iframe. The backend triggers CRE which:
// 1. Pulls Sumsub applicant status (Confidential HTTP)
// 2. Checks Chainalysis wallet risk (Confidential HTTP)
// 3. If approved: writes KYC credential on-chain via onReport()
//
// The frontend then polls isVerified() to confirm the credential landed.
// ---------------------------------------------------------------------------
app.post("/api/kyc/verify", async (c) => {
  const body = await c.req.json<{ wallet: string }>();
  if (!body.wallet) return c.json({ error: "wallet is required" }, 400);

  try {
    const result = await verifyIdentity(body.wallet);
    return c.json(result);
  } catch (err: any) {
    console.error("[/api/kyc/verify] Error:", err.message);
    return c.json(
      { error: "Verification failed", details: err.message?.slice(0, 200) },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// GET /api/kyc/status/:wallet — Read on-chain verification status
//
// Pure viem read — no CRE needed. Reads isVerified() from
// ComplianceCredentialConsumer on Arc Testnet.
// ---------------------------------------------------------------------------
app.get("/api/kyc/status/:wallet", async (c) => {
  const wallet = c.req.param("wallet") as Address;

  try {
    const verified = await isVerified(wallet);
    return c.json({ wallet, isVerified: verified });
  } catch (err: any) {
    console.error("[/api/kyc/status] Error:", err.message);
    return c.json({ wallet, isVerified: false, error: err.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/integrator/:wallet — Read integrator registration from chain
// ---------------------------------------------------------------------------
app.get("/api/integrator/:wallet", async (c) => {
  const wallet = c.req.param("wallet") as Address;

  try {
    const info = await getIntegrator(wallet);
    return c.json({ wallet, ...info });
  } catch (err: any) {
    return c.json({ wallet, active: false, error: err.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/compliance/check — Per-trade compliance via CRE Workflow B
//
// After fillOrderAsync() emits ComplianceCheckRequested on-chain, the frontend
// sends the tx hash here. The backend triggers CRE Workflow B simulation which:
// 1. Reads the event from the tx receipt
// 2. Checks Sumsub KYC status via Confidential HTTP
// 3. Checks Chainalysis wallet risk via Confidential HTTP
// 4. Writes compliance report on-chain via onReport()
// 5. Auto-callback settles the trade (onComplianceApproved)
// ---------------------------------------------------------------------------
app.post("/api/compliance/check", async (c) => {
  const body = await c.req.json<{ txHash: string; eventIndex?: number }>();
  if (!body.txHash) return c.json({ error: "txHash is required" }, 400);

  try {
    const result = await checkTradeCompliance(body.txHash, body.eventIndex ?? 0);
    return c.json(result);
  } catch (err: any) {
    console.error("[/api/compliance/check] Error:", err.message);
    return c.json(
      { error: "Compliance check failed", details: err.message?.slice(0, 200) },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// GET /api/audit/:wallet — Fetch encrypted KYC data via CRE Workflow C
//
// Triggers Workflow C which:
// 1. Verifies the requester is a registered integrator
// 2. Checks role-based scoping (Protocol > Broker > LP)
// 3. Fetches PII from Sumsub via Confidential HTTP
// 4. Encrypts response with AES-GCM (encryptOutput: true)
// 5. Returns encrypted PII — caller decrypts with their AES key
// ---------------------------------------------------------------------------
app.get("/api/audit/:wallet", async (c) => {
  const wallet = c.req.param("wallet");
  const auditReason = c.req.query("reason") || "compliance inquiry";

  try {
    const result = await auditIdentity(wallet, auditReason);
    return c.json(result);
  } catch (err: any) {
    console.error("[/api/audit] Error:", err.message);
    return c.json(
      { error: "Audit failed", details: err.message?.slice(0, 200) },
      500
    );
  }
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
console.log(`@ocn/node-sdk starting on port ${PORT}`);
console.log(`CRE workflows triggered via simulation (demo mode)`);
console.log(`On-chain reads: Arc Testnet (chain ID 5042002)`);

export default {
  port: PORT,
  fetch: app.fetch,
};
