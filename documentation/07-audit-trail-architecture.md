# 07 - Audit Trail Architecture

## Design Principle

The audit trail must capture **point-in-time evidence** - what was true when the compliance decision was made, not what is true at the time of the audit. If Chainalysis says a wallet's risk score is 2.1 at trade time and later changes it to 7.8, the audit record must show 2.1 - that's what the decision was based on.

## Two Types of Compliance Data

The system stores two fundamentally different types of data with different access patterns:

```
TYPE 1: Per-trade audit records (non-PII)
  Contains: risk scores, compliance decisions, flags, jurisdiction checks
  Does NOT contain: passport photos, names, addresses, document images
  Storage: IPFS (public, content-addressed)
  Retrieval: direct fetch by CID - no CRE workflow needed
  Integrity: on-chain auditHash (DON-signed, immutable)

TYPE 2: KYC/AML identity data (PII)
  Contains: verification status, document check results, sanctions details
  Lives in: Sumsub (the provider, not our storage)
  Retrieval: CRE Workflow C (Confidential HTTP in TEE, scoped by appId)
  Access: only authorized integrators, encrypted to their key
```

This separation is intentional. Per-trade records are compliance decisions - not sensitive in the same way PII is. Identity data stays with the identity provider (Sumsub) and is only accessed on-demand through the TEE.

## Storage Architecture

### Layer 1: On-Chain Attestation (immutable, DON-signed)

Stored in the ComplianceReportConsumer contract via DON-signed report:

```
ComplianceReport {
    tradeId:        bytes32    // unique trade identifier
    trader:         address    // trader's wallet
    counterparty:   address    // counterparty's wallet
    sourceContract: address    // protocol that emitted the event (for auto-callback)
    approved:       bool       // the compliance decision
    riskScore:      uint8      // 0-10 scale
    auditHash:      bytes32    // keccak256(full AuditRecord) - integrity anchor
    ipfsCid:        string     // IPFS content identifier for the full AuditRecord
    timestamp:      uint256    // block timestamp
}

Report metadata (verified by KeystoneForwarder):
    workflowId:    bytes32    // hash of the workflow binary
    workflowName:  bytes10    // human-readable name
    workflowOwner: address    // deployer
```

**Properties:**
- Immutable - cannot be altered after writing
- Public - anyone can read
- Verifiable - DON threshold signature proves authenticity
- Compact - decision + audit hash + IPFS CID, no PII

### Layer 2: IPFS (full per-trade audit record)

The complete AuditRecord is uploaded to IPFS via Pinata at trade time by CRE Workflow B. Stored publicly - integrity guaranteed by the on-chain auditHash.

```
AuditRecord {
    // Scoping metadata (for multi-tenant filtering)
    tradeId: "0xabc..."
    workspaceId: "0x7a3b..."         // which protocol workspace
    brokerAppId: "0x9f2e..."         // which broker onboarded the trader
    sourceContract: "0x1234..."      // which protocol contract emitted the event

    // Trade details
    trader: "0xABC..."
    counterparty: "0xDEF..."
    asset: "0x3600..."               // USDC on Arc
    amount: "100000000"
    timestamp: "2026-04-04T14:30:00Z"

    // Sumsub results (from Confidential HTTP in TEE)
    sumsub: {
        reviewStatus: "completed",
        reviewAnswer: "GREEN",
        sanctionsHit: false,
        pepStatus: false,
        jurisdiction: "DE"
    }

    // Chainalysis results (from Confidential HTTP in TEE)
    traderWalletRisk: {
        riskScore: 2.1,
        sanctionedExposure: 0,
        darknetExposure: 0,
        mixerExposure: 0
    }
    counterpartyWalletRisk: {
        riskScore: 1.8,
        sanctionedExposure: 0,
        darknetExposure: 0,
        mixerExposure: 0
    }

    // Jurisdiction rules (from workflow code, open source)
    jurisdictionCheck: {
        allowed: true,
        jurisdiction: "DE",
        regulation: "MiCA"
    }

    // Aggregated decision
    decision: {
        approved: true,
        riskScore: 2,
        flags: [],
        reasoning: "All checks passed."
    }
}
```

**Why IPFS, not a database:**
- No server to maintain or trust - consistent with the "no backend" philosophy
- Content-addressed - the CID is derived from the content, tamper-evident by design
- Pinata pins the data for availability - free tier sufficient for hackathon
- Anyone with the CID can fetch - no API keys needed for reads
- On-chain auditHash provides a second integrity check independent of IPFS

**Why not encrypted:**
- The AuditRecord contains compliance decisions and risk scores - not PII
- No passport photos, names, addresses, or document images
- The same level of sensitivity as a credit rating - public is acceptable
- PII lives in Sumsub and is accessed via CRE Workflow C (Confidential HTTP in TEE)

### Layer 3: Sumsub (KYC/AML identity data - PII)

PII never enters the audit trail. It stays in Sumsub and is accessed on-demand:

```
KYC/AML data retrieval (Workflow C):
  Integrator signs request → CRE verifies on-chain scoping →
  Confidential HTTP to Sumsub in TEE → returns to integrator

The Sumsub API credentials never leave the TEE.
The PII is fetched on-demand, not stored by the engine.
```

## How the Audit Trail is Created (Workflow B)

```
Trade submitted → ComplianceCheckRequested event
        │
        ▼
CRE Workflow B (TEE):
  1. Sumsub check (Confidential HTTP)
  2. Chainalysis check x2 (Confidential HTTP)
  3. Jurisdiction rules
  4. Aggregate decision
        │
        ▼
  5. Build AuditRecord (all results combined)
  6. auditHash = keccak256(JSON.stringify(AuditRecord))
        │
        ├── 7. Upload AuditRecord to IPFS via Pinata
        │      POST https://api.pinata.cloud/pinning/pinJSONToIPFS
        │      → returns IPFS CID (e.g., "QmXyz...")
        │
        └── 8. Write on-chain: ComplianceReport { auditHash, ipfsCid, ... }
               via DON-signed writeReport → KeystoneForwarder → Consumer
```

## How the Audit Trail is Retrieved

### Per-Trade Audit Record (non-PII) - Direct IPFS Fetch

No CRE workflow needed. Any integrator reads directly:

```
1. Read on-chain: ComplianceReportConsumer.getReport(tradeId)
   → returns: { auditHash, ipfsCid, approved, riskScore, ... }

2. Fetch from IPFS: GET https://gateway.pinata.cloud/ipfs/{ipfsCid}
   → returns: full AuditRecord JSON

3. Verify integrity: keccak256(fetchedRecord) === on-chain auditHash?
   YES → data is authentic, untampered, produced by the DON
   NO  → data was modified or corrupted, reject it
```

**No API key, no authentication, no CRE workflow.** The data is public on IPFS. The on-chain hash proves it hasn't been tampered with. IPFS's content addressing provides a second layer - the CID itself is a hash of the content.

### KYC/AML Identity Data (PII) - CRE Workflow C

PII requires scoped access through the TEE:

```
Integrator signs HTTP request with their wallet
  { userWallet: "0xABC", scope: "identity" }
        │
        ▼
CRE Workflow C (HTTP Trigger):
  1. Read IntegratorRegistry → verify role + appId
  2. Read CredentialRegistry → verify user's brokerAppId matches requester
  3. If unauthorized → return { authorized: false }
  4. Confidential HTTP → Sumsub (TEE): fetch identity data
     Uses namespaced externalUserId: {workspace}:{broker}:{wallet}
  5. Return data to integrator (via CRE gateway response)
```

## Tamper Protection

The audit trail is tamper-proof through three independent mechanisms:

```
1. DON Consensus: 21 independent nodes agreed on the auditHash.
   A single node cannot forge a different hash.

2. On-chain immutability: The auditHash is stored in a DON-signed report
   on-chain. Nobody can change it after the fact.

3. IPFS content addressing: The CID is derived from the content.
   Modifying the content produces a different CID that won't match.

To tamper with an audit record, an attacker would need to:
  - Corrupt ≥14 of 21 DON nodes (to forge the hash)
  - AND rewrite the blockchain (to change the on-chain report)
  - AND break IPFS content addressing (mathematically impossible)
```

## Role-Based Access

### Per-Trade Audit Records (IPFS - public)

Since per-trade records are on IPFS (public), any party can fetch them. The scoping is informational - the records contain `workspaceId` and `brokerAppId` fields that allow integrators to filter for their own data:

```
Protocol: reads all records WHERE workspaceId matches their workspace
Broker:   reads records WHERE brokerAppId matches (their onboarded users' trades)
LP:       reads records WHERE their trades appear (filter by counterparty/sourceContract)
Regulator: reads any record (public data)
```

The filtering happens client-side. The data is public, but each party knows which records are relevant to them via the embedded appIds.

### KYC/AML Identity Data (Workflow C - scoped)

Identity data access is enforced server-side by CRE Workflow C:

| Role | Access | Enforcement |
|---|---|---|
| **Broker** | Only users they onboarded (`brokerAppId` match) | CRE checks on-chain credential |
| **LP** | Only users in trades they filled | CRE checks on-chain reports |
| **Protocol** | All users in their workspace (`workspaceId` match) | CRE checks workspace admin |
| **Regulator** | Full access (via protocol admin) | Protocol grants access |

## Real-Time Event Subscription

Integrators subscribe to on-chain events directly via any EVM WebSocket provider:

```
// Standard EVM event subscription (ethers.js / viem / Alchemy / Infura)

watchEvent.ComplianceCheckCompleted({
  // Filter by indexed fields
}, {
  onLogs: (logs) => {
    const { tradeId, trader, approved, riskScore, auditHash } = logs[0].args;

    // Fetch full record from IPFS if needed
    const report = await fetchFromIPFS(ipfsCid);

    // Verify integrity
    assert(keccak256(report) === auditHash);

    // Sync to internal system
    await syncToInternalDB(report);
  }
});
```

No backend WebSocket server needed. The scoping data (`workspaceId`, `brokerAppId`) is in the AuditRecord, allowing client-side filtering.

## MiCA Compliance: 5-Year Retention

MiCA requires 5-year retention of all compliance actions:

- **On-chain:** ComplianceReport is immutable and permanent - exists as long as the chain exists
- **IPFS:** Pinata pinning keeps records available. For guaranteed permanence, records can also be mirrored to Arweave (content-addressed, permanent storage)
- **Integrity:** On-chain auditHash ensures records remain unaltered over the full retention period - any modification is detectable

## Comparison: Fragmented vs Unified Audit

| Scenario | Fragmented (today) | Unified (this engine) |
|----------|-------------------|----------------------|
| Regulator asks LP for compliance evidence | LP provides their partial view | LP points to on-chain report + IPFS record |
| Regulator asks protocol for same trade | Protocol provides different partial view | Same record - identical data, same hash |
| Do the records match? | Possibly not (different times, providers) | Always - one check, one record, one hash |
| Can records be retroactively altered? | Yes (server-side DB) | No - on-chain hash + IPFS content addressing |
| Time to produce audit evidence | Days (coordinate across parties) | Seconds (one chain read + one IPFS fetch) |
| Where is PII? | Scattered across each party's systems | Sumsub only - accessed via TEE on demand |

## Considerations

### Why not encrypt the IPFS records?

The AuditRecord on IPFS contains compliance decisions and risk metrics - not PII. Encrypting it would require a CRE workflow for every read (to decrypt in TEE and re-encrypt for the requester), adding latency and complexity without proportional security benefit. PII (identity documents, sanctions details) stays in Sumsub and is accessed via Confidential HTTP in the TEE (Workflow C) where encryption genuinely matters.

### What if Pinata goes down?

The on-chain report still contains the compliance decision (`approved`, `riskScore`). The IPFS CID is content-addressed - the same data can be re-pinned to any IPFS node or gateway. For maximum resilience, records can be mirrored to Arweave (permanent, decentralized storage) at trade time.

### What about Confidential Compute?

Today, the AuditRecord is assembled in the WASM runtime on the CRE node (outside the TEE). Provider API calls (Sumsub, Chainalysis) happen inside the TEE via Confidential HTTP - secrets are protected, responses can be encrypted. When Chainlink Confidential Compute ships (2026), the entire workflow - including AuditRecord assembly - moves into the TEE. Same code, stronger guarantee. The architecture is forward-compatible.
