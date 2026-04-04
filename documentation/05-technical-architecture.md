# 05 — Technical Architecture

## System Overview

The compliance engine is composed of four layers: on-chain contracts, CRE workflows, off-chain data storage, and external compliance provider APIs.

```
                         EXTERNAL PROVIDERS
                    ┌─────────┬────────────┬──────────┐
                    │ Sumsub  │Chainalysis │ Notabene │
                    └────▲────┴─────▲──────┴────▲─────┘
                         │          │           │
                    Confidential HTTP (inside TEE)
                         │          │           │
              ┌──────────┴──────────┴───────────┴──────────┐
              │                                            │
              │         CRE WORKFLOW (TEE / Enclave)        │
              │                                            │
              │   Sumsub check ──┐                         │
              │   Chainalysis ───┤── Rules Engine ── Report│
              │   Notabene ──────┘                         │
              │                                            │
              └──────────┬─────────────────┬───────────────┘
                         │                 │
                    On-chain report    HTTP POST
                    (ComplianceReport  (Full AuditRecord
                     + auditHash       to IPFS via Pinata)
                     + ipfsCid)        │
                         │              │
              ┌──────────▼──────┐   ┌──▼──────────────┐
              │   SMART         │   │  IPFS (Pinata)   │
              │   CONTRACTS     │   │                  │
              │                 │   │  Content-addressed│
              │  Compliance     │   │  AuditRecords    │
              │  Consumer       │   │  (public, hash-  │
              │  Contract       │   │   verified)      │
              │       │         │   │                  │
              │  Swap Protocol  │   │  Fetch by CID    │
              │  Contract       │   │  from any gateway │
              └─────────────────┘   └──────────────────┘
```

## On-Chain Components

### 1. Defi Protocol Contract

The existing protocol contract that handles trade execution. Modified to:
- Emit a `ComplianceCheckRequested` event before executing a trade
- Read the `ComplianceConsumer` contract for the compliance decision
- Execute or revert based on the compliance result

### 2. Compliance Consumer Contract

Receives signed reports from the CRE workflow via the Chainlink KeystoneForwarder.

**Key fields:**
```
bytes32 s_expectedWorkflowId     // Hash of the compiled workflow binary
bytes10 s_expectedWorkflowName   // Human-readable workflow name
address s_expectedAuthor         // Workflow deployer address
address s_forwarderAddress       // Chainlink KeystoneForwarder address
```

**Report metadata (verified by KeystoneForwarder):**
```
bytes32 workflowId       // Must match s_expectedWorkflowId
bytes10 workflowName     // Must match s_expectedWorkflowName
address workflowOwner    // Must match s_expectedAuthor
```

**Report payload (the compliance decision):**
```
struct ComplianceReport {
    bytes32 tradeId;
    address trader;
    address counterparty;
    address sourceContract;  // protocol that emitted event (for auto-callback)
    bool approved;
    uint8 riskScore;         // 0-10 scale
    bytes32 auditHash;       // keccak256 of full AuditRecord
    string ipfsCid;          // IPFS content identifier for full AuditRecord
    uint256 timestamp;
}
```

**Auto-callback:** When a report arrives, if the `sourceContract` is registered via `registerCallback()`, the consumer automatically calls `onComplianceApproved(tradeId)` or `onComplianceRejected(tradeId, reason)` on the protocol contract. This enables single-tx swaps: the user calls `swap()`, CRE runs checks, the callback executes the trade. Wrapped in try-catch so the report is always stored even if the callback fails.

**Immutability:** After configuration, the contract owner can renounce ownership. This makes the workflow ID, author, and forwarder address immutable — nobody can change which workflow produces accepted reports.

### 3. KeystoneForwarder Contract (Chainlink infrastructure)

Chainlink's forwarder contract that:
- Receives signed reports from the DON
- Verifies the DON threshold signature
- Validates workflow metadata (ID, name, owner)
- Calls `onReport()` on the Compliance Consumer Contract

This is existing Chainlink infrastructure, not custom code.

## CRE Workflow

### Runtime Environment

- **Language:** TypeScript (compiled to WASM via Javy)
- **Execution:** Runs on Chainlink Decentralized Oracle Network (DON)
- **Consensus:** Byzantine Fault Tolerant (BFT) — 21 independent nodes must agree
- **Confidentiality:** Confidential HTTP capability executes API calls inside TEE
- **Secrets:** Stored in Vault DON (threshold-encrypted, decrypted only in TEE)

### Workflow Identity

The workflow ID is a hash of the compiled binary + configuration. This means:
- Changing one line of code produces a new workflow ID
- Anyone can compile the open-source code and verify the hash matches
- The consumer contract pins a specific workflow ID — mismatched IDs are rejected
- Workflow updates are visible on-chain (new ID registered in Workflow Registry)

### Four Workflows

The engine uses four dedicated CRE workflows:

| Workflow | Trigger | Purpose | Confidential HTTP |
|----------|---------|---------|-------------------|
| **D: Token Generation** | HTTP | Generate Sumsub access token for KYC iframe | `{{.sumsubAppToken}}` for App Token |
| **A: Identity Verification** | HTTP | Pull Sumsub status + Chainalysis risk, write credential on-chain | `{{.sumsubAppToken}}` + `{{.chainalysisApiKey}}` |
| **B: Per-Trade Compliance** | EVM Log | Per-trade sanctions/risk checks, write report on-chain | `{{.sumsubAppToken}}` + `{{.chainalysisApiKey}}` |
| **C: Identity Audit** | HTTP | Fetch encrypted PII for integrators | `{{.sumsubAppToken}}` + `encryptOutput: true` (AES-GCM) |

### Why Four Separate Workflows

The engine uses four dedicated workflows rather than a monolithic one:

- **CRE constraint: one trigger type per workflow.** The per-trade workflow (EVM Log Trigger) cannot share a workflow with the identity workflows (HTTP Trigger).
- **Update isolation.** Each workflow has its own workflowId (hash of the binary). Fixing a bug in the audit workflow doesn't change the verification workflow's ID — the credential consumer contract is unaffected.
- **Independent authorization.** Identity verification is open (any wallet can trigger their own KYC). Identity audit is restricted (only registered integrator wallets). Per-trade compliance is permissionless (gas-gated via contract events). Separate workflows allow different `authorizedKeys` per trigger.
- **Secrets are per-workflow in CRE** (each has its own Vault DON store). Provider credentials (Sumsub, Chainalysis) are duplicated across workflows. This is operationally manageable — secret rotation updates 3 workflows instead of 1 — and does not reduce security since each copy has the same threshold-encryption and TEE protections.

### Trigger Mechanism

**EVM Log Trigger** — permissionless:
- Anyone who can send a transaction can trigger a compliance check
- The workflow listens for `ComplianceCheckRequested` events from the Swap Protocol Contract
- No whitelisting required for trade participants

### Secrets Management

All provider credentials are stored in the CRE Vault DON. Each provider operates under a single master account — multi-tenancy is enforced by the compliance engine's on-chain registry and CRE workflow logic, not by the providers.

Secrets stored:
- Sumsub App Token + Secret Key (one master account, applicants namespaced via `externalUserId`)
- Chainalysis API Key (one master account, results tagged with appId in audit records)
- Notabene API credentials (one master account)

Secrets are:
- Threshold-encrypted across DON nodes
- Decrypted only inside TEE at execution time
- Not extractable by the workflow deployer (no `cre secrets read` command)
- Updatable via `cre secrets update` (new values go into Vault DON)

### Confidential HTTP

Each external API call uses the Confidential HTTP capability:
- HTTP request executes inside a TEE / secure enclave
- Provider credentials are injected via template syntax: `{{.CHAINALYSIS_API_KEY}}`
- Credentials exist only in enclave memory during execution
- Responses can be AES-GCM encrypted before leaving the enclave (`encryptOutput: true`)
- Guaranteed single execution (no duplicate API calls)

### Confidential Compute (2026)

Chainlink Confidential Compute (Early Access 2026) extends TEE protection to the entire workflow:
- Not just the HTTP call, but ALL processing runs inside the TEE
- PII from Sumsub responses exists only in enclave memory
- Node operators cannot access any data during execution
- Output is the only thing that leaves the TEE

## Off-Chain Components

### IPFS (Pinata) — Per-Trade Audit Records

Full AuditRecords are uploaded to IPFS via Pinata at trade time by CRE Workflow B. Stored publicly — no database, no server, no REST API.

- **Content-addressed** — the CID is derived from the content. Tamper-evident by design.
- **On-chain integrity** — `auditHash` (keccak256 of the record) stored on-chain, DON-signed. Independent verification.
- **IPFS CID on-chain** — `ipfsCid` stored in ComplianceReport. Anyone can fetch by CID from any IPFS gateway.
- **No backend needed** — integrators fetch directly: `https://gateway.pinata.cloud/ipfs/{cid}`
- **MiCA retention** — Pinata pinning keeps records available. For guaranteed 5-year permanence, records can be mirrored to Arweave.

### Sumsub — KYC/AML Identity Data (PII)

PII never enters the audit trail. It stays in Sumsub and is accessed on-demand via CRE Workflow C (Confidential HTTP in TEE). See [07 - Audit Trail Architecture](./07-audit-trail-architecture.md) for the full storage and retrieval design.

## Data Flow — Identity Verification Lifecycle

Before a user can trade, they must be KYC-verified. This is orchestrated by the **Backend SDK** calling two CRE workflows:

```
Integrator Frontend          Integrator Backend          CRE (TEE)                    On-chain
(@ocn/react)                 (@ocn/node-sdk)                  |                           |
                                    |                         |                           |
  User clicks "Get Verified"        |                         |                           |
       |                            |                         |                           |
       |-- POST /api/kyc/token ---->|                         |                           |
       |                            |-- HTTP trigger -------> |                           |
       |                            |                         | Workflow D: Token Gen      |
       |                            |                         | verify integrator -------> | (EVM read)
       |                            |                         | Conf HTTP -> Sumsub API    |
       |                            |                         |   {{.sumsubAppToken}}      |
       |<-- { accessToken } --------|<-- token returned ----- |                           |
       |                            |                         |                           |
       |-- render Sumsub iframe     |                         |                           |
       |   user uploads docs        |                         |                           |
       |   user takes selfie        |                         |                           |
       |   Sumsub SDK: onComplete   |                         |                           |
       |                            |                         |                           |
       |-- POST /api/kyc/verify --->|                         |                           |
       |                            |-- HTTP trigger -------> |                           |
       |                            |                         | Workflow A: Verify         |
       |                            |                         | Conf HTTP -> Sumsub        |
       |                            |                         | Conf HTTP -> Chainalysis   |
       |                            |                         | if GREEN:                  |
       |                            |                         |   build credential (CCID)  |
       |                            |                         |   onReport() ------------> | credential
       |<-- { verified, txHash } ---|                         |                           | written
       |                            |                         |                           |
       |-- poll isVerified() -------+-------------------------+-------------------------> | (EVM read)
       |<-- verified! --------------|                         |                           |
```

**Key privacy properties:**
- Sumsub App Token stays in Vault DON / TEE enclave (injected via `{{.sumsubAppToken}}`)
- Chainalysis API Key stays in Vault DON (injected via `{{.chainalysisApiKey}}`)
- The integrator backend holds NO provider credentials — only their wallet private key
- HMAC-SHA256 for Sumsub is computed in the workflow handler, App Token injected in TEE
- The frontend never communicates with CRE or Sumsub APIs directly

## Data Flow — Complete Trade Lifecycle

```
T+0s    User submits trade to Swap Protocol Contract
T+0s    Contract emits ComplianceCheckRequested event
T+2s    CRE DON detects event via EVM Log Trigger
T+3s    21 nodes begin executing workflow in parallel
T+3s    Inside TEE: Confidential HTTP calls to Sumsub, Chainalysis, Notabene
T+5s    Inside TEE: Rules engine evaluates jurisdiction, thresholds, asset eligibility
T+5s    Inside TEE: Full AuditRecord assembled, hashed (keccak256)
T+6s    BFT consensus: nodes agree on ComplianceReport + auditHash
T+6s    Report signed with DON threshold key
T+7s    KeystoneForwarder verifies signature, calls Consumer Contract
T+7s    Consumer Contract validates workflowId, stores ComplianceReport
T+7s    CRE workflow uploads full AuditRecord to IPFS via Pinata, gets CID
T+7s    Consumer auto-callbacks protocol: onComplianceApproved → trade executes
T+8s    Integrators' event indexers detect ComplianceCheckCompleted event
T+8s    Integrators fetch full AuditRecord from API, verify against on-chain hash
T+8s    Integrators sync to internal compliance systems
```

## Network and Chain Support

CRE supports multiple EVM-compatible chains. The compliance engine can be deployed on whichever chain the swap protocol uses. The KeystoneForwarder contract is available on major mainnets and testnets (Ethereum, Arbitrum, Base, Avalanche, Polygon, and others).

### Arc (Circle) — Primary Deployment

The engine is deployed on **Arc Testnet** (Chain ID 5042002) as a foundational DeFi building block for the ecosystem:

- **USDC-native**: Arc uses USDC for gas. The EscrowSwap demo uses USDC for escrow-based swaps — the natural primitive for a stablecoin-first chain.
- **Institutional-first**: Arc is built for regulated finance. Compliance infrastructure is a prerequisite for institutional adoption — we provide it as shared infrastructure so every protocol doesn't build its own.
- **CRE support**: Arc Testnet is a CRE-supported network (CLI v1.0.7+, TS SDK v1.3.1+). The KeystoneForwarder is deployed at `0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1`.
- **Cross-chain ready**: ACE's Cross-Chain Identifiers (CCIDs) make credentials portable. A user verified on Arc can be recognized on any EVM chain via CCIP, bringing Arc's compliance guarantees to the multi-chain ecosystem.
