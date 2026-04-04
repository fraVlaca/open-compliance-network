# Implementation Plan: Trustless Compliance Engine (CRE + ACE)

## Context

Shared, verifiable compliance engine for institutional DeFi. CRE workflows call Sumsub/Chainalysis in TEE, write attestations on-chain. Protocol developers integrate with minimal code. The engine is an unopinionated **compliance oracle** — it produces data, protocols consume it however they want.

## Design Principles

1. **Simplest possible integration** — a protocol should be able to integrate with a single `require()` call or an ACE `runPolicy` modifier. Their choice.
2. **Unopinionated** — don't dictate how protocols consume compliance data. Support pull-based, async, cross-chain, same-contract, any pattern.
3. **Less gas, more flexibility** — the on-chain footprint should be minimal (store credentials + reports, not heavy framework logic).
4. **Cross-chain is the integrator's problem** — we write the report. They can submit it on the destination chain, use CCIP, or do whatever flow they want. We don't impose a cross-chain pattern.

## Architecture Overview

CRE workflows are event-driven, not REST APIs. Triggered by HTTP requests, on-chain events, or cron. Results written on-chain or via HTTP POST.

```
Frontend/SDK ──HTTP trigger──► Workflow A (identity)  ──writeReport──► ComplianceCredentialConsumer
                                                                        ├── IdentityRegistry
                                                                        └── CredentialRegistry

Protocol ──emit event──► Workflow B (per-trade) ──writeReport──► ComplianceReportConsumer
                                                  ──HTTP POST──► IPFS (Pinata)

Integrator ──HTTP trigger──► Workflow C (audit) ──encrypted──► Integrator
                                                  (Sumsub data, scoped by externalUserId + on-chain appId)
```

**Two contract consumers, both implementing `IReceiver`:**
- `ComplianceCredentialConsumer` — receives KYC credentials from Workflow A, writes to ACE registries
- `ComplianceReportConsumer` — receives per-trade reports from Workflow B, stores on-chain

**Protocols integrate at whatever level they want:**
```
Simplest:     require(consumer.isVerified(wallet))           // 1 line
ACE basic:    runPolicy modifier + CredentialRegistryPolicy  // ACE pattern
ACE advanced: CertifiedActionDONValidatorPolicy              // per-trade permits
Custom:       read ComplianceReportConsumer.getReport()      // build your own logic
```

## Workflows

### Workflow A: Identity Verification (HTTP Trigger)

**Trigger**: HTTP — frontend calls after user completes Sumsub SDK
**Why HTTP, not webhook**: Sumsub webhooks use HMAC-SHA256 signatures, not EVM keys. CRE HTTP triggers need EVM-signed requests. **Solution**: frontend-triggered. Workflow independently verifies via Sumsub API inside TEE — doesn't trust the frontend, just uses it as a trigger.

**Input**: `{ walletAddress, sumsubApplicantId }`
**Processing (TEE)**:
1. Confidential HTTP → Sumsub: get applicant status, KYC level, sanctions, PEP
2. Confidential HTTP → Chainalysis: wallet risk score
3. Compute CCID: `keccak256(abi.encodePacked("compliance-v1", walletAddress))`
4. Build credential: `abi.encode(kycLevel, riskScore, jurisdiction, expiresAt)`

**Output (on-chain)**: `writeReport()` → KeystoneForwarder → `ComplianceCredentialConsumer.onReport()`:
- Calls `IdentityRegistry.registerIdentity(ccid, wallet, context)`
- Calls `CredentialRegistry.registerCredential(ccid, KYC_VERIFIED, expiresAt, credentialData, context)`

**Output (off-chain)**: HTTP POST full details to audit DB

### Workflow B: Per-Trade Compliance (EVM Log Trigger)

**Trigger**: EVM Log — watches for `ComplianceCheckRequested(bytes32 tradeId, address trader, address counterparty, address asset, uint256 amount)`

**Input**: decoded from event
**Processing (TEE)**:
1. Confidential HTTP → Sumsub: trader KYC status, sanctions, PEP
2. Confidential HTTP → Chainalysis: trader wallet risk
3. Confidential HTTP → Chainalysis: counterparty wallet risk
4. Rules engine (workflow code): jurisdiction, asset eligibility, thresholds, structuring
5. Aggregate → approved/rejected
6. Assemble full AuditRecord, compute `auditHash = keccak256(AuditRecord)`

**Output (on-chain)**: `writeReport()` → `ComplianceReportConsumer.onReport()`:
- Stores `ComplianceReport { tradeId, trader, approved, riskScore, auditHash, timestamp }`
- Emits `ComplianceCheckCompleted(tradeId, trader, approved, auditHash)`

**Output (off-chain)**: HTTP POST full AuditRecord to audit DB

### Workflow C: Identity Audit for Integrators (HTTP Trigger)

**Trigger**: HTTP — integrator triggers with their authorized key
**Purpose**: Integrator needs to access KYC records for their scoped users. CRE checks on-chain registry to verify the integrator's role and appId, then fetches from Sumsub using the namespaced externalUserId (`{workspace}:{appId}:{wallet}`). Returns encrypted with the integrator's public key.

**Input**: `{ applicantId, integrator public key, auditReason }`
**Processing (TEE)**:
1. Read IntegratorRegistry on-chain: verify requester's role and appId
2. Verify the requested applicant's on-chain credential is tagged with the requester's appId (scoping check)
3. Confidential HTTP → Sumsub: GET applicant data using namespaced externalUserId
4. Encrypt response with integrator's provided public key (AES-GCM)

**Output**: Encrypted audit package returned to integrator. On-chain: optional audit-request attestation ("integrator X requested audit at timestamp T").

### Per-Trade Audit Access — NOT a CRE workflow

Integrators read per-trade compliance data directly:
1. Read `ComplianceReport` from chain (tradeId → report)
2. Get `auditHash` from the report
3. Fetch full AuditRecord from audit DB / decentralized storage using their integrator API key
4. Verify `keccak256(fetchedRecord) == on-chain auditHash`

No workflow needed. Standard event indexing + API call + hash verification.

## Smart Contracts

### Existing ACE (unchanged, use as-is)
- `PolicyEngine`, `IdentityRegistry`, `CredentialRegistry`, `TrustedIssuerRegistry`
- `CredentialRegistryIdentityValidatorPolicy` — optional, for protocols that want ACE-style integration
- `CertifiedActionDONValidatorPolicy` — **reference pattern** for `IReceiver.onReport()` (file: `/chainlink-ace/packages/policy-management/src/policies/CertifiedActionDONValidatorPolicy.sol`, lines 69-72)

### New Contracts

**1. `ComplianceCredentialConsumer`** (implements `IReceiver`, ERC165)
- Follows `CertifiedActionDONValidatorPolicy` pattern exactly
- `onReport(metadata, report)`:
  - Verify `msg.sender == keystoneForwarder`
  - Decode report → `{ walletAddress, ccid, credentialTypeId, expiresAt, credentialData }`
  - Call `IdentityRegistry.registerIdentity(ccid, walletAddress, context)`
  - Call `CredentialRegistry.registerCredential(ccid, credentialTypeId, expiresAt, credentialData, context)`
- Pinned: `s_expectedWorkflowId`, `s_keystoneForwarder`
- **Also exposes simple view**: `isVerified(address wallet) → bool` (reads CredentialRegistry directly)
- This `isVerified()` is the **1-line integration** for protocols that don't want ACE

**2. `ComplianceReportConsumer`** (implements `IReceiver`, ERC165)
- `onReport(metadata, report)`: decode + store ComplianceReport
- Storage: `mapping(bytes32 tradeId => ComplianceReport)`
- Views: `getReport(tradeId)`, `isApproved(tradeId)`
- Events: `ComplianceCheckCompleted(tradeId, trader, approved, auditHash)`
- Pinned: `s_expectedWorkflowId`, `s_keystoneForwarder`

**3. `SwapExtractor`** (implements `IExtractor`)
- For protocols using ACE integration: extracts `from`, `to`, `amount` from swap calldata
- Follows `/chainlink-ace/packages/policy-management/src/extractors/ERC20TransferExtractor.sol` pattern

**4. `DemoSwapProtocol`** (inherits `PolicyProtectedUpgradeable`)
- Hackathon demo showing both integration patterns:
  - `executeSwapSimple(counterparty, asset, amount)` — uses `require(consumer.isVerified(msg.sender))` (1 line)
  - `executeSwapACE(counterparty, asset, amount)` — uses `runPolicy` modifier (ACE pattern)
  - `requestComplianceCheck(counterparty, asset, amount)` — emits `ComplianceCheckRequested` for Workflow B

### Integration Patterns (protocol developer perspective)

**Pattern 1: Simplest (1 line)**
```solidity
function trade(...) external {
    require(credentialConsumer.isVerified(msg.sender), "Not compliant");
    // trade logic
}
```

**Pattern 2: ACE PolicyEngine**
```solidity
// inherit PolicyProtectedUpgradeable, add runPolicy modifier
function trade(...) external runPolicy {
    // trade logic — policy check is transparent
}
// operator configures: policyEngine.addPolicy(protocol, selector, credentialValidatorPolicy)
```

**Pattern 3: Async per-trade**
```solidity
function submitTrade(...) external {
    emit ComplianceCheckRequested(tradeId, msg.sender, counterparty, asset, amount);
    // trade is pending
}
function confirmTrade(bytes32 tradeId) external {
    require(reportConsumer.isApproved(tradeId), "Not approved");
    // execute trade
}
```

**Pattern 4: Cross-chain**
Protocol writes report on chain A. Uses CCIP or bridge to read it on chain B. We don't impose the cross-chain pattern — the report is just on-chain data.

## Spam Prevention & Fees

- **Workflow A (HTTP)**: Open authorized keys — any wallet triggers its own KYC. Natural deterrent: workflow short-circuits if Sumsub status isn't verified. No credential written for invalid requests.
- **Workflow B (EVM Log)**: Gas cost = natural spam prevention. Optionally `IntegratorRegistry.isRegistered()` check.
- **Workflow C (HTTP)**: Closed authorized keys — only registered integrator keys.
- **Fee model (hackathon)**: Engine operator covers CRE costs. Post-hackathon: subscription or per-check fee via IntegratorRegistry.

## File Structure

```
cannes2026/
  chainlink-ace/                        # Existing (unchanged)

  contracts/                            # New Solidity
    src/
      consumers/
        ComplianceCredentialConsumer.sol
        ComplianceReportConsumer.sol
      extractors/
        SwapExtractor.sol
      demo/
        DemoSwapProtocol.sol
    test/
      ComplianceCredentialConsumer.t.sol
      ComplianceReportConsumer.t.sol
      integration/
        EndToEnd.t.sol
    script/
      Deploy.s.sol
    foundry.toml
    remappings.txt

  workflows/
    identity-verification/              # Workflow A
      workflow.ts
      workflow.yaml
      config.json
      secrets.yaml
      .env
    per-trade-compliance/               # Workflow B
      workflow.ts
      workflow.yaml
      config.json
      secrets.yaml
      .env
    identity-audit/                     # Workflow C
      workflow.ts
      workflow.yaml
      config.json
      secrets.yaml
      .env

  documentation/                        # Existing (update with integration guide)
```

## Implementation Order

1. **Contracts**: ComplianceCredentialConsumer → ComplianceReportConsumer → SwapExtractor → DemoSwapProtocol → Deploy script → Tests
2. **Workflow A** (identity-verification): HTTP trigger + Confidential HTTP Sumsub/Chainalysis + writeReport to credential consumer
3. **Workflow B** (per-trade-compliance): EVM Log trigger + multi-provider checks + writeReport to report consumer + HTTP POST audit record
4. **Workflow C** (identity-audit): HTTP trigger + Confidential HTTP Sumsub + encrypt to integrator key
5. **End-to-end simulation**: `cre workflow simulate` + Foundry integration tests
6. **Demo frontend** (optional): Sumsub SDK + trigger UI

## Verification

- **Contracts**: `forge test` — unit tests per consumer, integration test: deploy ACE stack + consumers → register credential → trade with `isVerified()` → verify pass/fail
- **Workflows**: `cre workflow simulate <folder>` — Workflow A with `--http-payload '{"walletAddress":"0x...","applicantId":"..."}'`, Workflow B with test event tx hash
- **End-to-end**: Deploy to Sepolia → Workflow A → check CredentialRegistry → DemoSwapProtocol.executeSwapSimple → verify it passes. Non-KYC'd wallet → verify revert.
