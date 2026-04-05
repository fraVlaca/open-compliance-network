# 12 - SDK & Developer Tooling

## Overview

The compliance engine offers developer tooling at three levels: a **Backend SDK** (`@ocn/node-sdk`) for integrators to orchestrate CRE workflows, a **Frontend SDK** (`@ocn/react`) for user-facing KYC flows, and **on-chain contracts** for smart contract integration. The goal is minimal integration effort - integrators never touch compliance providers directly.

## Architecture: Backend SDK + Frontend SDK

```
User's Browser             Integrator's Backend         CRE Workflows (TEE)          On-chain
(@ocn/react)               (@ocn/node-sdk)                     |                        |
                                   |                           |                        |
  "Get Verified" click             |                           |                        |
       |                           |                           |                        |
       |-- POST /api/kyc/token --> |                           |                        |
       |                           |-- HTTP trigger ---------> |                        |
       |                           |                           | Workflow D: Token Gen   |
       |                           |                           | verify integrator ----> | (EVM read)
       |                           |                           | Conf HTTP -> Sumsub     |
       |                           |                           | {{.sumsubAppToken}}     |
       |<-- { accessToken } -------| <-- token returned ------ |                        |
       |                           |                           |                        |
       |-- Sumsub iframe           |                           |                        |
       |   user completes KYC      |                           |                        |
       |   SDK fires onComplete    |                           |                        |
       |                           |                           |                        |
       |-- POST /api/kyc/verify -->|                           |                        |
       |                           |-- HTTP trigger ---------> |                        |
       |                           |                           | Workflow A: Verify      |
       |                           |                           | Conf HTTP -> Sumsub     |
       |                           |                           | Conf HTTP -> Chainalysis|
       |                           |                           | if GREEN: onReport() -> | credential
       |<-- { verified, txHash } --|                           |                        | written
       |                           |                           |                        |
       |-- poll isVerified() ------+---------------------------+----------------------> | (EVM read)
       |<-- true ------------------|                           |                        |
```

**Why this split:**
- **Sumsub API credentials never leave CRE's TEE.** The Backend SDK triggers CRE workflows - it never holds API keys.
- **No Sumsub webhooks needed.** The Frontend SDK detects KYC completion (Sumsub JS event), signals the Backend SDK, which triggers CRE Workflow A to PULL the status. Pure pull model.
- **Integrator's wallet = API key.** The backend authenticates by signing CRE HTTP trigger requests with the integrator's private key. CRE verifies this against the on-chain IntegratorRegistry.

## CRE Workflows

The engine runs **four CRE workflows**, all using Confidential HTTP for credential protection:

| Workflow | Trigger | Purpose | Writes On-chain? |
|----------|---------|---------|-----------------|
| **D: Token Generation** | HTTP | Generate Sumsub access token for iframe | No - returns token |
| **A: Identity Verification** | HTTP | Verify KYC status + issue credential | Yes - via onReport() |
| **B: Per-Trade Compliance** | EVM Log | Per-trade sanctions/risk check | Yes - via onReport() |
| **C: Identity Audit** | HTTP | Fetch KYC data for integrators (encrypted PII) | No - returns data |

### Confidential HTTP (Privacy Standard)

All four workflows use `ConfidentialHTTPClient` from the CRE SDK:
- **Sumsub App Token** injected via `{{.sumsubAppToken}}` template - resolved from Vault DON, never visible to workflow nodes
- **Chainalysis API Key** injected via `{{.chainalysisApiKey}}` template - same protection
- **HMAC-SHA256 signature** computed in handler code (needs the secret key for computation), passed as a regular header
- **Response encryption** (Workflow C): `encryptOutput: true` encrypts PII with AES-GCM before it leaves the TEE enclave

## Backend SDK (`@ocn/node-sdk`)

The Backend SDK is a thin orchestration layer that triggers CRE workflows. It holds NO provider credentials - all API calls go through CRE's Confidential HTTP.

### Routes

```
POST /api/kyc/token     -- Trigger Workflow D: generate Sumsub access token
POST /api/kyc/verify    -- Trigger Workflow A: verify KYC + issue credential
GET  /api/kyc/status/:wallet  -- Read isVerified() from chain
POST /api/compliance/check    -- Trigger Workflow B (for async per-trade)
GET  /api/audit/:wallet       -- Trigger Workflow C: fetch encrypted KYC data
```

### How Token Generation Works (Workflow D)

```
Backend calls Workflow D via CRE HTTP trigger:
  Input: { walletAddress, integratorAddress, appId }

Inside TEE:
  1. EVM read: IntegratorRegistry.getIntegrator(integratorAddress)
     -> Verify active == true, appId matches
  2. Build externalUserId: {workspaceId}:{appId}:{wallet}
     (namespace scoping - different integrators' users don't collide)
  3. Confidential HTTP POST -> Sumsub: create applicant
     X-App-Token: {{.sumsubAppToken}}  (from Vault DON)
  4. Confidential HTTP POST -> Sumsub: generate access token
     X-App-Token: {{.sumsubAppToken}}  (from Vault DON)

Returns: { accessToken, externalUserId, levelName }
No on-chain write.
```

### How Identity Verification Works (Workflow A)

```
Backend calls Workflow A via CRE HTTP trigger:
  Input: { walletAddress }

Inside TEE:
  1. EVM read: IntegratorRegistry - get broker appId, workspace
  2. Confidential HTTP GET -> Sumsub: pull applicant status
     If not found (404) -> create applicant
     If not GREEN -> return { status: "not_approved" }
  3. If GREEN: Confidential HTTP GET -> Chainalysis wallet risk
  4. Build KYC credential:
     - CCID (Cross-Chain Identifier)
     - KYC level, risk score, jurisdiction
     - Broker appId, workspace scoping
  5. runtime.report() -> evmClient.writeReport()
     -> credential written to ComplianceCredentialConsumer

On-chain result: isVerified(wallet) returns true
```

### How Per-Trade Compliance Works (Workflow B)

Workflow B is NOT triggered by the Backend SDK. It's triggered automatically by an on-chain event:

```
1. User calls swap() on protocol contract
2. Contract emits ComplianceCheckRequested(tradeId, trader, counterparty, asset, amount)
3. CRE DON detects event via EVM Log Trigger
4. Inside TEE:
   - Confidential HTTP -> Sumsub: KYC status for trader
   - Confidential HTTP -> Chainalysis: wallet risk for both parties
   - Rules engine: jurisdiction, sanctions, risk thresholds
   - Build audit record + keccak256 hash
5. runtime.report() -> evmClient.writeReport()
   -> ComplianceReportConsumer stores report
   -> Auto-callback: onComplianceApproved(tradeId) on protocol contract
   -> Trade executes
```

### How Identity Audit Works (Workflow C)

```
Backend calls Workflow C via CRE HTTP trigger:
  Input: { userWallet, auditReason, scope }

Inside TEE:
  1. EVM read: verify requester is active integrator
  2. EVM read: check credential scoping (role-based)
     - PROTOCOL: sees all users in workspace
     - BROKER: sees users they onboarded
     - LP: sees users in workspace
  3. Confidential HTTP GET -> Sumsub: fetch applicant data (PII)
     encryptOutput: true  (AES-GCM encryption)
  4. Return encrypted PII to integrator
     Integrator decrypts with their AES key

Returns: { authorized, encryptedIdentity, encryptionNote }
PII never leaves TEE unencrypted.
```

## Frontend SDK (`@ocn/react`)

The Frontend SDK communicates with the Backend SDK. It never touches CRE or Sumsub directly.

### Installation

```
npm install @ocn/react
```

### Usage

```tsx
import { KYCFlow, useVerificationStatus } from "@ocn/react";

function App() {
  const { isVerified } = useVerificationStatus(walletAddress);

  return (
    <KYCFlow
      backendUrl="https://your-backend.com"
      walletAddress={walletAddress}
      onVerified={() => console.log("User verified!")}
    />
  );
}
```

### What Happens Under the Hood

```
1. KYCFlow calls POST /api/kyc/token on the Backend SDK
2. Backend SDK triggers CRE Workflow D (token generation)
3. CRE returns Sumsub access token (via Confidential HTTP)
4. KYCFlow renders Sumsub iframe with that token
5. User completes KYC in iframe (documents, selfie)
6. Sumsub JS SDK fires onApplicantSubmitted
7. KYCFlow calls POST /api/kyc/verify on the Backend SDK
8. Backend SDK triggers CRE Workflow A (identity verification)
9. CRE pulls Sumsub status, checks Chainalysis, writes credential on-chain
10. KYCFlow polls isVerified(wallet) on-chain
11. When true: fires onVerified callback, shows "Verified" state
```

The integrator doesn't know about CRE, Sumsub, externalUserId namespacing, or credential registries. They install two packages and add one component.

### Package Structure

```
@ocn/react (Frontend SDK)
  KYCFlow              -- drop-in KYC widget (iframe + state machine)
  SumsubVerification   -- raw Sumsub iframe wrapper (low-level)
  useVerificationStatus -- hook: is this wallet verified?
  useKYCFlow           -- hook: manages KYC state machine
  useComplianceReport  -- hook: get per-trade compliance report

@ocn/node-sdk (Backend SDK)
  createServer()       -- Hono server with KYC routes
  triggerTokenGen()    -- calls CRE Workflow D
  triggerVerification()-- calls CRE Workflow A
  triggerAudit()       -- calls CRE Workflow C
  checkStatus()       -- reads isVerified() on-chain
```

## Smart Contract Integration

Already implemented via `@chainlink/ace` + the compliance engine's consumer contracts. No additional SDK needed.

### Integration Patterns

**Pattern 1 - Simplest (1 line):**
```solidity
require(consumer.isVerified(msg.sender), "Not compliant");
```

**Pattern 2 - ACE PolicyEngine:**
```solidity
function trade(...) external runPolicy { ... }
```

**Pattern 3 - Async per-trade with auto-callback:**
```solidity
emit ComplianceCheckRequested(tradeId, msg.sender, counterparty, asset, amount);
// CRE Workflow B checks -> auto-calls onComplianceApproved(tradeId)
```

The `EscrowSwap` contract demonstrates Patterns 1 and 3.

## Protocol Onboarding

### Getting Started Guide

```
Step 1: Register your protocol workspace
  -> Call IntegratorRegistry.createWorkspace("my-protocol")
  -> Save the returned workspace ID (bytes32)
  -> This is your namespace for all users, integrators, and trades

Step 2: Add compliance check to your contract
  -> Option A: require(consumer.isVerified(msg.sender))  // 1 line
  -> Option B: inherit PolicyProtected, add runPolicy     // ACE pattern
  -> Option C: emit ComplianceCheckRequested(...)          // async + auto-callback

Step 3: Run the Backend SDK
  -> npm install @ocn/node-sdk
  -> Configure with your wallet private key (signs CRE triggers)
  -> Start the server: routes for /api/kyc/token, /api/kyc/verify, etc.

Step 4: Install the Frontend SDK
  -> npm install @ocn/react
  -> Add <KYCFlow backendUrl="..." walletAddress={addr} />
  -> Users can now get verified through your frontend

Step 5: Register callback (if using async pattern)
  -> ComplianceReportConsumer.registerCallback(yourContract)
  -> Implement IComplianceCallback in your contract

Step 6: Done. Users get verified and trade.
```

## Integrator / LP Onboarding (Single Transaction)

Brokers and LPs join a workspace with one on-chain transaction:

```
Broker joins:
  IntegratorRegistry.joinWorkspace(workspaceId, BROKER)
  -> Broker's wallet is mapped to their appId
  -> CRE reads this when broker triggers KYC or requests audit data

LP joins:
  IntegratorRegistry.joinWorkspace(workspaceId, LP)
  -> LP's wallet is mapped to their appId
  -> CRE reads this when LP requests per-trade audit data
```

No CRE workflow is triggered by registration because:
- We use one master Sumsub account with externalUserId namespacing - nothing to set up at the provider level
- The on-chain registry IS the setup - CRE reads it later when processing requests
- The integrator's wallet IS their API key - no key generation needed

## Secrets & Privacy

All provider credentials are stored in CRE's Vault DON:
- **Sumsub App Token + Secret Key** - threshold-encrypted, decrypted only in TEE
- **Chainalysis API Key** - same protection
- **AES Encryption Key** - for response encryption in audit workflow

The Backend SDK holds NO provider credentials. It only has the integrator's wallet private key for signing CRE HTTP trigger requests.

```
secrets.yaml (Vault DON mapping):
  sumsubAppToken:    -> SUMSUB_APP_TOKEN_ALL
  sumsubSecretKey:   -> SUMSUB_SECRET_KEY_ALL
  chainalysisApiKey: -> CHAINALYSIS_API_KEY_ALL
  aesEncryptionKey:  -> AES_ENCRYPTION_KEY_ALL
```
