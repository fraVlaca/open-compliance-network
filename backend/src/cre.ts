import { execSync } from "child_process";
import { CRE_CLI_PATH, PROJECT_ROOT, CRE_ENV, WORKFLOWS } from "./config";

// ---------------------------------------------------------------------------
// CRE Workflow Trigger — Simulation Mode
//
// In demo/hackathon mode, we shell out to `cre workflow simulate` which
// compiles the workflow to WASM and runs it locally. The workflow makes
// real API calls via Confidential HTTP (secrets from .env).
//
// In production, workflows are deployed to the CRE DON. The backend would
// call the CRE HTTP trigger gateway with a signed JWT instead of exec'ing
// a CLI command. See the production comments at the bottom of this file.
// ---------------------------------------------------------------------------

const CRE_TIMEOUT = 120_000; // 2 minutes — compilation can be slow first run

/**
 * Run a CRE workflow simulation and parse the JSON result.
 */
async function triggerWorkflow(
  workflowPath: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const payloadJson = JSON.stringify(payload);

  const cmd = [
    CRE_CLI_PATH,
    "workflow",
    "simulate",
    workflowPath,
    "--http-payload",
    `'${payloadJson}'`,
    "--non-interactive",
    "--trigger-index",
    "0",
    "--skip-type-checks",
    "-T",
    "staging-settings",
  ].join(" ");

  console.log(`[CRE] Triggering: ${workflowPath}`);
  console.log(`[CRE] Payload: ${payloadJson}`);

  const stdout = execSync(cmd, {
    encoding: "utf-8",
    cwd: PROJECT_ROOT,
    timeout: CRE_TIMEOUT,
    env: { ...process.env, ...CRE_ENV },
  });

  // Parse the simulation result from stdout.
  // CRE outputs: ✓ Workflow Simulation Result:\n"<escaped-json-string>"
  const match = stdout.match(
    /Workflow Simulation Result:\s*\n"(.+)"/
  );

  if (!match) {
    console.error("[CRE] Could not parse result from stdout:");
    console.error(stdout.slice(-500));
    throw new Error("CRE simulation did not produce a result");
  }

  // The result is a double-encoded JSON string: "\"{ ... }\""
  // First JSON.parse removes the outer quotes, second parses the actual object
  const innerJson = JSON.parse(`"${match[1]}"`);
  const result = JSON.parse(innerJson);

  console.log(`[CRE] Result:`, result);
  return result;
}

// ---------------------------------------------------------------------------
// Public API — one function per workflow
// ---------------------------------------------------------------------------

/**
 * Workflow D: Generate Sumsub access token.
 * CRE verifies integrator on-chain, calls Sumsub via Confidential HTTP.
 */
export async function generateToken(wallet: string) {
  return triggerWorkflow(WORKFLOWS.tokenGeneration, {
    walletAddress: wallet,
  });
}

/**
 * Workflow A: Verify identity + issue on-chain credential.
 * CRE pulls Sumsub status, checks Chainalysis, writes credential via onReport().
 */
export async function verifyIdentity(wallet: string) {
  return triggerWorkflow(WORKFLOWS.identityVerification, {
    walletAddress: wallet,
  });
}

/**
 * Workflow B: Per-trade compliance check.
 * Triggered by an on-chain ComplianceCheckRequested event.
 * CRE reads event data, checks Sumsub + Chainalysis, writes report via onReport().
 * In simulation: we pass the tx hash containing the event.
 */
export async function checkTradeCompliance(txHash: string, eventIndex: number = 0) {
  const cmd = [
    CRE_CLI_PATH,
    "workflow",
    "simulate",
    WORKFLOWS.perTradeCompliance,
    "--evm-tx-hash",
    txHash,
    "--evm-event-index",
    String(eventIndex),
    "--non-interactive",
    "--trigger-index",
    "0",
    "--skip-type-checks",
    "-T",
    "staging-settings",
  ].join(" ");

  console.log(`[CRE] Triggering per-trade compliance: tx=${txHash}`);

  const { execSync } = await import("child_process");
  const stdout = execSync(cmd, {
    encoding: "utf-8",
    cwd: PROJECT_ROOT,
    timeout: 120_000,
    env: { ...process.env, ...CRE_ENV },
  });

  const match = stdout.match(/Workflow Simulation Result:\s*\n"(.+)"/);
  if (!match) {
    console.error("[CRE] Could not parse result");
    throw new Error("CRE simulation did not produce a result");
  }

  const innerJson = JSON.parse(`"${match[1]}"`);
  const result = JSON.parse(innerJson);
  console.log(`[CRE] Per-trade result:`, result);
  return result;
}

/**
 * Workflow C: Fetch encrypted KYC audit data.
 * CRE verifies requester scoping, fetches PII via Confidential HTTP,
 * encrypts response with AES-GCM before returning.
 */
export async function auditIdentity(
  userWallet: string,
  auditReason: string,
  requesterWallet?: string
) {
  return triggerWorkflow(WORKFLOWS.identityAudit, {
    userWallet,
    requesterWallet: requesterWallet || userWallet,
    auditReason,
  });
}

// ---------------------------------------------------------------------------
// Production Mode (CRE DON HTTP Trigger)
// ---------------------------------------------------------------------------
//
// When workflows are deployed to the CRE DON, the backend calls the gateway
// via signed HTTP requests instead of exec'ing the CLI.
//
// import { createPrivateKey, createSign } from "crypto";
//
// const CRE_GATEWAY_URL = "https://gateway.chainlink-cre.io/trigger";
// const INTEGRATOR_PRIVATE_KEY = process.env.CRE_ETH_PRIVATE_KEY;
//
// async function signCRERequest(privateKey: string, workflowId: string, payload: object) {
//   // Build JWT: { header: { alg: "ES256" }, payload: { workflowId, payload, exp: now+300 } }
//   // Sign with ECDSA using the integrator's private key
//   // The CRE gateway verifies the signature against the workflow's authorizedKeys
//   const header = Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString("base64url");
//   const body = Buffer.from(JSON.stringify({
//     sub: workflowId,
//     payload,
//     iat: Math.floor(Date.now() / 1000),
//     exp: Math.floor(Date.now() / 1000) + 300,
//   })).toString("base64url");
//   const signature = createSign("SHA256").update(`${header}.${body}`).sign(privateKey, "base64url");
//   return `${header}.${body}.${signature}`;
// }
//
// async function triggerWorkflowProduction(workflowId: string, payload: object) {
//   const jwt = await signCRERequest(INTEGRATOR_PRIVATE_KEY, workflowId, payload);
//   const resp = await fetch(CRE_GATEWAY_URL, {
//     method: "POST",
//     headers: {
//       Authorization: `Bearer ${jwt}`,
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       jsonrpc: "2.0",
//       id: 1,
//       method: "trigger",
//       params: { workflow_id: workflowId, payload },
//     }),
//   });
//   if (!resp.ok) throw new Error(`CRE gateway error: ${resp.status}`);
//   return resp.json();
// }
