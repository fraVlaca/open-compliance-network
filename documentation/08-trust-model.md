# 08 - Trust Model & Verification

## What CRE Cryptographically Guarantees

### The Verification Chain

Every compliance decision can be independently verified through six layers:

```
Layer 1: SOURCE CODE
  The compliance workflow is open source (e.g., on GitHub).
  Anyone can read every line of the compliance rules.
  → Verifies: WHAT code is supposed to run

Layer 2: WORKFLOW ID (binary hash)
  workflowId = hash(compiled WASM binary + configuration)
  Anyone can compile the source and verify the hash matches.
  → Verifies: the deployed code matches the source

Layer 3: ON-CHAIN REGISTRY
  The workflow is registered in Chainlink's Workflow Registry contract.
  The Compliance Consumer Contract pins s_expectedWorkflowId.
  → Verifies: which workflow is authorized to produce reports

Layer 4: DON CONSENSUS
  21 independent Chainlink nodes execute the workflow.
  BFT consensus: ≥ 2/3 must agree on the result.
  → Verifies: the code was executed correctly

Layer 5: THRESHOLD SIGNATURE
  The DON signs the report with a threshold key.
  KeystoneForwarder verifies the signature on-chain.
  → Verifies: the report came from the authorized DON

Layer 6: AUDIT HASH
  auditHash = keccak256(full AuditRecord)
  Stored on-chain alongside the ComplianceReport.
  → Verifies: the off-chain audit data hasn't been tampered with
```

### What This Proves

- The Chainlink DON (21 independent nodes) reached consensus that the compliance result is `approved: true`
- The report is signed by a threshold signature - on-chain contracts can verify it came from the DON
- The workflow that produced the report matches a specific, verifiable binary hash
- The off-chain audit record matches the on-chain hash (integrity proof)
- The provider credentials never left the TEE (hardware isolation)

### What This Does NOT Prove

- It does NOT prove that Sumsub's server specifically returned "verified" (no ZK proof of the TLS session)
- It does NOT prove the HTTP interaction happened with the real Sumsub API (no TLS attestation)
- The trust model is: **"Trust the Chainlink DON honest majority"** - if ≥ 2/3 of nodes are honest, the result is correct

However: if the workflow code is open source and the workflow ID matches, the only code path to `approved: true` goes through the actual Sumsub/Chainalysis APIs. This is a **logical proof by code transparency**, not a cryptographic proof of the HTTP call.

## Workflow Immutability

### Can the workflow be changed?

The workflow owner CAN update the workflow via `cre workflow update`. However:

1. Updating produces a **new workflow ID** (new binary hash)
2. The Compliance Consumer Contract still expects the OLD workflow ID
3. Reports from the new workflow are **rejected** by the consumer contract
4. To accept the new workflow, the consumer contract must be updated (visible on-chain)

### Making the system fully immutable

After configuration, the contract owner can **renounce ownership**:

```
Step 1: Deploy Compliance Consumer Contract
Step 2: Set s_expectedWorkflowId = 0x7a3b...
Step 3: Set s_expectedAuthor = deployer address
Step 4: Set s_forwarderAddress = KeystoneForwarder
Step 5: Renounce ownership → NOBODY can change these values
```

After renouncing:
- The workflow ID is permanently pinned
- Even the original deployer cannot change which code is accepted
- The system is fully immutable

### The trust spectrum

```
Most flexible                                  Most trustworthy

Owned contract         Timelock/multisig        Renounced ownership
+ updatable workflow   + public delay           + immutable contract
                       + community review
                       before changes

"We can fix bugs"      "Changes are visible     "Nobody can change
                       7 days before they        this. Ever."
                       take effect"
```

## Credential Security (TEE)

### How secrets are protected

Provider credentials (Sumsub App Token, Chainalysis API Key, etc.) are stored in the CRE Vault DON:

- **At rest:** threshold-encrypted across DON nodes using Distributed Key Generation (DKG)
- **At execution:** decrypted only inside the TEE / secure enclave
- **After execution:** cleared from enclave memory
- **For the operator:** not extractable (no `cre secrets read` command exists)

### Confidential HTTP vs Confidential Compute

| | Confidential HTTP (available now) | Confidential Compute (2026) |
|---|---|---|
| What's in TEE | The HTTP call only | The ENTIRE workflow |
| Secrets | Protected in TEE | Protected in TEE |
| API response | Encrypted before leaving enclave | Never leaves enclave |
| Workflow processing | May run outside TEE | Runs inside TEE |
| PII exposure | Transient in node memory | Only in enclave memory |
| Node operator access | Cannot see secrets; may see API responses | Cannot see anything |

Confidential Compute (Early Access 2026) is the target for production deployment. With it, PII from provider responses exists only in enclave memory for milliseconds and is never accessible to node operators.

## DECO - Future Enhancement (ZK + TLS Attestation)

Chainlink DECO is a privacy-preserving protocol that uses zero-knowledge proofs on TLS session data. When integrated into CRE (planned for 2026):

- **ZK proof** that a TLS session occurred with a specific server (e.g., `api.sumsub.com`)
- **Mathematical guarantee** that the response contained specific data (e.g., `status: "active"`)
- **Privacy-preserving:** the full response is never revealed - only the proven property
- **No trust assumption needed** for the HTTP part (pure math, not honest majority)

With DECO, the trust model upgrades from:
```
"Trust ≥ 2/3 of DON nodes executed correctly"
```
to:
```
"Mathematical proof that the data came from the provider's server"
```

Same workflow code. Same architecture. Stronger cryptographic guarantees. No code changes needed.

## Comparison: Trust Models

| Trust Level | Architecture | Trust Assumption | Verifiable? |
|---|---|---|---|
| Weakest | Your centralized backend | "Trust one server operator" | No - trust the operator |
| Stronger | Backend + SOC2 audit | "Trust the operator + auditor" | Annually, not per-trade |
| Stronger | CRE (current) | "Trust ≥ 2/3 of 21 DON nodes" | Yes - per-trade, on-chain |
| Strongest | CRE + DECO (future) | "Trust math (ZK proofs)" | Yes - cryptographic proof |

## The Self-Binding Property

Building on CRE with open-source code and pinned workflow IDs creates a **self-binding** commitment:

- The operator cannot selectively approve/reject trades without changing the code
- Changing the code changes the workflow ID (visible on-chain)
- The consumer contract rejects unknown workflow IDs
- All parties see the same rules applied equally

This is structurally different from a centralized system where the operator promises not to cheat. Here, the operator has **removed their own ability to cheat** - and anyone can verify this by reading the on-chain configuration and the open-source code.

## PII and Data Processing

### Where PII exists in the system

| Location | PII Present? | Duration | Who can access? |
|---|---|---|---|
| Sumsub servers | Yes (documents, selfie) | Per Sumsub retention policy | Sumsub account holders |
| TEE enclave memory | Yes (API responses) | Milliseconds during execution | Nobody (hardware isolated) |
| Node operator memory | No (with Confidential Compute) | N/A | N/A |
| On-chain report | No | Permanent | Public |
| IPFS (Pinata) | AuditRecords (risk scores, decisions, not PII) | Pinned + optional Arweave mirror | Public, content-addressed, hash-verified |
| Blockchain | No | Permanent | Public |

### GDPR posture

- The protocol operator needs DPAs with integrators (standard for any compliance service)
- With Confidential Compute, PII processing happens in hardware-isolated enclaves
- The operator holds the Sumsub master account (with restricted dashboard role for non-PII admin tasks, or full access if running the compliance engine actively)
- On-chain data contains no PII - only compliance decisions and audit hashes
