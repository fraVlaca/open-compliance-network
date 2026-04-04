# 03 — Solution Overview: Unified Trustless Compliance Engine

## What We Build

A shared compliance engine that orchestrates all per-trade compliance checks (KYC, sanctions, wallet risk, jurisdiction, Travel Rule) across existing providers (Sumsub, Chainalysis, Notabene), runs them once per trade inside a Trusted Execution Environment on Chainlink CRE, and produces a verifiable, unified audit trail accessible by all counterparties.

## The Core Idea

**We don't replace Sumsub, Chainalysis, or Notabene. We orchestrate them.**

The compliance checks exist. The providers exist. What's missing is:
- A single execution that covers all checks atomically per trade
- A shared result that all parties can trust without re-running checks
- A unified audit trail that combines all provider data per trade
- Verifiable execution that proves the checks actually ran

## How It Works — High Level

```
Trade submitted on-chain
        |
        v
Compliance Engine Contract
  emits: ComplianceCheckRequested(trader, counterparty, asset, amount)
        |
        v
CRE Workflow (runs inside TEE on Chainlink DON)
  |-- Sumsub:      KYC status, sanctions, PEP           (Confidential HTTP)
  |-- Chainalysis:  Wallet risk, counterparty, exposure  (Confidential HTTP)
  |-- Notabene:     Travel Rule data exchange             (Confidential HTTP)
  |-- Rules Engine: Jurisdiction, asset, thresholds       (Workflow code)
  |
  Combines all results into ComplianceReport
  Hashes the full audit record
        |
        v
Two outputs:
  1. ON-CHAIN:  ComplianceReport (approved/rejected, risk score, audit hash)
  2. OFF-CHAIN: Full AuditRecord to IPFS via Pinata (ipfsCid stored on-chain)
        |
        v
Defi Protocol reads on-chain result
  approved? --> execute trade
  rejected? --> revert
        |
        v
All parties (LP, broker, custodian) can:
  - Read on-chain attestation (public, immutable)
  - Fetch full audit record from IPFS by CID, verify against on-chain hash
  - Sync to their internal compliance systems
```

## What Each Party Gets

### The Defi Protocol (operator)
- Compliance gating on every trade — no manual intervention
- One set of provider credentials (in TEE, not on your servers)
- Full audit trail for regulatory inquiries
- Open-source compliance rules that all counterparties can verify

### Liquidity Providers
- No need for their own Sumsub, Chainalysis, or Notabene accounts
- Same compliance coverage as if they ran checks themselves
- Access to the same audit trail (role-scoped)
- Can sync compliance events to their internal systems
- Can verify that checks ran via on-chain attestation + open-source code

### Brokers / Integrators
- Plug into the compliance engine instead of building their own
- Access KYC/AML data for their users via CRE workflows (scoped by on-chain APP-ID, encrypted to their key)
- Full audit trail access for their trades
- Reduced compliance engineering burden

### Custodians
- Consume compliance attestations for the assets they custody
- Access to audit records for any trade involving their held assets
- Can demonstrate to regulators that pre-trade compliance was verified

### Regulators (during audit)
- One complete, unified compliance record per trade
- All provider data combined (KYC + sanctions + wallet risk + jurisdiction)
- Point-in-time evidence (what was true when the decision was made)
- On-chain integrity proof (hash cannot be tampered with retroactively)
- Consistent across all parties (everyone points to the same report)

## What Changes for Users

| Before (fragmented) | After (unified engine) |
|---|---|
| KYC'd 4 times by 4 parties | KYC'd once, result shared |
| Different verification flows per party | One consistent experience |
| Days-long onboarding per counterparty | Instant verification re-use |
| Compliance blocks trades unpredictably | Deterministic pre-trade gating |

## The Analogy

**Chainlink price feeds** made it so every DeFi protocol doesn't need their own oracle infrastructure for asset prices. They all read from the same decentralized feed.

**This compliance engine** does the same for regulatory compliance. Every counterparty reads from the same decentralized compliance check instead of running their own.

## Why Arc (Circle) First

The compliance engine is deployed on Arc as a foundational DeFi building block for the ecosystem. Arc is purpose-built for institutional finance — USDC-native gas, Circle's full-stack platform, and regulatory-first design. This is the chain where compliance infrastructure matters most.

Any protocol deploying on Arc can integrate compliance with 1 line of Solidity. The EscrowSwap demo uses USDC for escrow-based swaps with compliance gating — the natural primitive for Arc's stablecoin-first economy. Instead of every Arc protocol independently building compliance stacks, they share one engine. Credentials use ACE's Cross-Chain Identifiers (CCIDs), making compliance status portable across EVM chains via CCIP.

Arc's vision is an Economic OS for global-scale finance. Institutional adoption requires compliance. Open Compliance Layer provides that compliance as a decentralized, verifiable, shared primitive.
