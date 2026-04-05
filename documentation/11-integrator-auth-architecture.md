# 11 - Integrator Authentication & API Key Architecture

## Overview

Every integrator (protocol, broker, LP) needs an identity in the compliance engine. This identity determines:
- **Who they are** - "I am Broker XYZ in Protocol ABC's workspace"
- **What they can see** - "Only users I onboarded and their trades"
- **What they can do** - "Trigger KYC for new users, read audit data"
- **Where they belong** - "Protocol ABC workspace, broker role"

This document compares two architectures for managing integrator identity, scoping, and data access: **on-chain** (wallet-based) and **off-chain** (traditional API keys with a backend).

---

## Architecture A: Fully On-Chain (Wallet = API Key)

### Core Concept

The integrator's EVM wallet IS their API key. CRE HTTP triggers already require EVM-signed requests. The wallet address maps to an APP-ID and role in an on-chain IntegratorRegistry contract. No backend server needed.

### Onboarding Flow

```
Protocol creates workspace:
  → Calls IntegratorRegistry.createWorkspace("proto_abc")
  → Protocol's wallet = admin of workspace
  → APP-ID generated deterministically on-chain
  → No API key needed - wallet IS the key

Broker joins workspace:
  → Calls IntegratorRegistry.joinWorkspace("proto_abc", BROKER)
  → Protocol admin approves (or open registration)
  → Broker's wallet mapped: 0xBroker → {appId: "broker_xyz", workspace: "proto_abc", role: BROKER}

LP joins workspace:
  → Same pattern
  → 0xLP → {appId: "lp_456", workspace: "proto_abc", role: LP}
```

### On-Chain Registry Contract

```
IntegratorRegistry:

  struct Workspace {
    bytes32 appId;           // deterministic ID
    address admin;           // protocol wallet
    bool active;
  }

  struct Integrator {
    bytes32 appId;           // integrator's sub-ID
    bytes32 workspaceId;     // linked to protocol
    Role role;               // PROTOCOL, BROKER, LP
    address wallet;          // their EVM wallet = their "API key"
    bool active;
  }

  enum Role { PROTOCOL, BROKER, LP }

  mapping(address wallet => Integrator) public integrators;
  mapping(bytes32 workspaceId => Workspace) public workspaces;
```

### Provider Account Model (Sumsub, Chainalysis)

All compliance providers operate under a single master account. Multi-tenancy is enforced by the compliance engine's on-chain registry and CRE workflow logic, not by the providers themselves.

```
SUMSUB:
  ONE master account (engine operator's)
  ONE app token stored in CRE Vault DON
  ALL applicants under this single account

  Namespacing via externalUserId:
    "{workspaceId}:{brokerAppId}:{walletAddress}"
    e.g., "proto_abc:broker_xyz:0x1234..."

  CRE workflow creates applicants with namespaced IDs
  CRE workflow enforces scoping when returning data
  Sumsub sees a flat list - no awareness of your tenants

  Why not Sumsub source keys?
    Source keys can group applicants and scope app tokens,
    but can only be created via the Sumsub dashboard (no API).
    Manual dashboard steps are incompatible with trustless,
    programmatic protocol onboarding.

CHAINALYSIS:
  ONE master account (engine operator's)
  ONE API key stored in CRE Vault DON
  ALL wallet screenings through the same key
  No sub-accounts, no multi-tenancy in Chainalysis

  Namespacing:
    CRE workflow tags screening results with the appId
    when storing in the AuditRecord
    Chainalysis doesn't know about your integrators
```

This means onboarding a new protocol, broker, or LP is **fully automated** - just an on-chain transaction. No manual dashboard steps in any provider.

### How Each Action Works

#### Trigger KYC (Broker onboards a user)

```
Broker's frontend signs HTTP request with broker's wallet
     │
     ▼
CRE Workflow A receives it (HTTP Trigger)
     │
     ├── Reads IntegratorRegistry on-chain:
     │   0xBroker → {appId: "broker_xyz", role: BROKER, workspace: "proto_abc"}
     │
     ├── Creates Sumsub applicant with namespaced ID:
     │   POST /resources/applicants
     │   externalUserId = "proto_abc:broker_xyz:0xUserWallet"
     │   (Sumsub sees one flat applicant - scoping is in the ID format)
     │
     ├── Includes brokerAppId in the on-chain credential when writing:
     │   CredentialRegistry.registerCredential(ccid, KYC_VERIFIED, expiresAt,
     │     credentialData = {kycLevel, riskScore, jurisdiction, brokerAppId: "broker_xyz"})
     │
     └── On-chain credential permanently records which broker onboarded this user
         Sumsub externalUserId encodes the same scoping for provider-side lookups
```

No backend needed. CRE verified the broker's identity via their wallet signature, created the Sumsub applicant with a namespaced ID, and embedded the appId in the on-chain credential.

#### Access KYC/AML Data (Broker retrieves their users' info)

```
Broker signs HTTP request with their wallet
  { requestedUsers: ["0xABC", "0xDEF"] }
     │
     ▼
CRE Workflow C receives it (HTTP Trigger)
     │
     ├── Reads IntegratorRegistry on-chain:
     │   Confirms 0xBroker is a broker in workspace "proto_abc"
     │
     ├── Reads CredentialRegistry on-chain:
     │   For each requested user, checks: does the credential's
     │   brokerAppId match "broker_xyz"?
     │   If NO → skip (broker didn't onboard this user)
     │   If YES → include in fetch list
     │
     ├── Fetches detailed KYC/AML from Sumsub (Confidential HTTP in TEE):
     │   GET /resources/applicants/-;externalUserId=proto_abc:broker_xyz:0xABC/one
     │   Uses the namespaced externalUserId to query the right applicant
     │   from the single master Sumsub account
     │
     └── Returns encrypted data to broker (encrypted with broker's public key)

No backend needed. CRE enforced scoping via on-chain credential check +
Sumsub externalUserId namespace. Broker only sees their own users' data.
The master Sumsub app token never leaves the TEE.
```

#### Access KYC/AML Data (LP retrieves info for users in their trades)

```
LP signs HTTP request with their wallet
     │
     ▼
CRE Workflow C receives it (HTTP Trigger)
     │
     ├── Reads IntegratorRegistry on-chain:
     │   Confirms 0xLP is an LP in workspace "proto_abc"
     │
     ├── Reads ComplianceReportConsumer on-chain:
     │   Finds trades WHERE lpAppId = "lp_456"
     │   Extracts trader addresses from those trades
     │
     ├── For each trader in LP's trades:
     │   Reads CredentialRegistry for their KYC credential
     │   Fetches detailed KYC/AML from Sumsub (Confidential HTTP in TEE)
     │   Scoped: LP only gets data for users that appeared in trades they filled
     │
     └── Returns encrypted data to LP

LP sees KYC/AML data ONLY for users involved in their trades.
Not all users in the workspace. Not users onboarded by other brokers
unless those users traded with this LP.
```

#### Access Per-Trade Audit Trail (LP retrieves trade data)

```
Option A: LP reads on-chain directly (no CRE, no backend)

  LP's system:
    → Subscribe to ComplianceCheckCompleted events
    → Filter: WHERE report.sourceAppId = "lp_456"
    → Get auditHash from each matching report
    → Fetch full AuditRecord from decentralized storage using auditHash
    → Verify: keccak256(fetchedRecord) == on-chain auditHash
    → Done. Pure chain reads + hash verification.

Option B: LP triggers CRE workflow for richer data

  LP signs HTTP request with their wallet
    → CRE workflow reads on-chain reports filtered by LP's appId
    → Enriches with provider data if needed (Confidential HTTP)
    → Returns encrypted to LP
```

#### Access Per-Trade Audit Trail (Broker retrieves trade data for their users)

```
Broker signs HTTP request or reads on-chain directly
     │
     ├── Reads ComplianceCheckCompleted events
     │   Filter: WHERE trader is one of broker's onboarded users
     │   (broker knows their user addresses from CredentialIssued events)
     │
     ├── For each matching trade:
     │   Get auditHash from on-chain report
     │   Fetch full AuditRecord from decentralized storage
     │   Verify hash integrity
     │
     └── Broker sees audit trail for trades originated by THEIR users only

Broker cannot see trades by users onboarded by other brokers.
```

#### Real-Time Compliance Events

On-chain events are public. Integrators subscribe directly via any EVM WebSocket provider:

```
// Standard EVM event subscription (ethers.js / viem)
// Works with Alchemy, Infura, or any WebSocket RPC

watchEvent.CredentialIssued({
  // All credential events
}, {
  onLogs: (logs) => {
    // Client-side filtering by appId
    const brokerAppId = decodeBrokerAppId(logs[0].args.credentialData);
    if (brokerAppId === MY_APP_ID) {
      console.log("My user verified:", logs[0].args.wallet);
    }
  }
});

watchEvent.ComplianceCheckCompleted({
  // All compliance events
}, {
  onLogs: (logs) => {
    if (logs[0].args.sourceAppId === MY_APP_ID) {
      console.log("Trade approved:", logs[0].args.tradeId);
    }
  }
});
```

No backend WebSocket server needed. The scoping is in the event data, filtered client-side. Any RPC provider supports this natively.

### Full On-Chain Data Flow

```
                    IntegratorRegistry           CRE                Chain Events
                    (on-chain)                   (TEE)              (public)
                         │                        │                     │
Protocol:                │                        │                     │
  createWorkspace() ────▶│                        │                     │
  → appId: "proto_abc"   │                        │                     │
                         │                        │                     │
Broker:                  │                        │                     │
  joinWorkspace() ──────▶│                        │                     │
  → appId: "broker_xyz"  │                        │                     │
  → role: BROKER          │                        │                     │
                         │                        │                     │
LP:                      │                        │                     │
  joinWorkspace() ──────▶│                        │                     │
  → appId: "lp_456"      │                        │                     │
  → role: LP              │                        │                     │
                         │                        │                     │
User KYC:                │                        │                     │
  Broker frontend signs ─┼───── HTTP trigger ────▶│                     │
  request with wallet    │                        │                     │
                         │◀── CRE reads registry ─│                     │
                         │  "0xBroker is broker_xyz"                    │
                         │                        │                     │
                         │                        │── Sumsub (TEE) ────▶│
                         │                        │   externalUserId =  │
                         │                        │   "proto_abc:       │
                         │                        │    broker_xyz:      │
                         │                        │    0xUser"          │
                         │                        │── Chainalysis ─────▶│
                         │                        │── writeReport ─────▶│
                         │                        │   credential with   │
                         │                        │   brokerAppId =     │
                         │                        │   "broker_xyz"      │
                         │                        │                     │
                         │                        │              CredentialIssued
                         │                        │              (wallet, ccid,
                         │                        │               brokerAppId)
                         │                        │                     │
Broker listens: ─────────┼────────────────────────┼──── subscribes ────▶│
  "My user verified" ◀───┼────────────────────────┼──── event ─────────│
                         │                        │                     │
Trade:                   │                        │                     │
  User calls swap() ─────┼────────────────────────┼────────────────────▶│
                         │                        │   ComplianceCheck   │
                         │                        │   Requested         │
                         │                        │   (includes appId)  │
                         │               EVM Log ─┼◀────────────────────│
                         │               Trigger  │                     │
                         │                        │── checks in TEE ───▶│
                         │                        │── writeReport ─────▶│
                         │                        │   report with       │
                         │                        │   lpAppId = "lp_456"│
                         │                        │                     │
LP listens: ─────────────┼────────────────────────┼──── subscribes ────▶│
  "Trade approved" ◀─────┼────────────────────────┼──── event ─────────│
                         │                        │                     │
Broker wants KYC data:   │                        │                     │
  Signs HTTP request ────┼───── HTTP trigger ────▶│                     │
                         │                        │                     │
                         │◀── CRE reads registry ─│                     │
                         │  "0xBroker is broker_xyz,                    │
                         │   can see users with    │                     │
                         │   brokerAppId=broker_xyz"│                    │
                         │                        │                     │
                         │                        │── Sumsub (TEE) ────▶│
                         │                        │── encrypted ───────▶│
  Broker receives ◀──────┼────────────────────────│  (KYC/AML data     │
  encrypted KYC data     │                        │   for their users)  │
```

### Scoping Summary (On-Chain)

| Role | Users they can see | Trades they can see | How scoping works |
|---|---|---|---|
| **Protocol** | All users in workspace | All trades in workspace | `WHERE workspace = "proto_abc"` |
| **Broker** | Only users they onboarded | Only trades by their users | `WHERE brokerAppId = "broker_xyz"` |
| **LP** | Only users in trades they filled | Only trades they filled | `WHERE lpAppId = "lp_456"` |

All scoping data is embedded in on-chain credentials and reports. Filtering happens either client-side (for event subscriptions) or inside CRE workflows (for KYC/AML data access in TEE).

### Data Access Preference: CRE Workflow vs On-Chain Reads

Different data types have different access paths depending on sensitivity:

```
┌──────────────────────────┬────────────────────────┬─────────────────────────────┐
│ Data type                │ Access method           │ Why                         │
├──────────────────────────┼────────────────────────┼─────────────────────────────┤
│ KYC/AML detailed info    │ CRE Workflow C          │ Sensitive PII - must be     │
│ (document checks,        │ (HTTP trigger,          │ fetched from Sumsub inside  │
│  sanctions details,      │  Confidential HTTP,     │ TEE, scoped by role,        │
│  PEP status, risk        │  encrypted response)    │ encrypted to requester.     │
│  breakdown)              │                        │ Never stored on-chain.      │
├──────────────────────────┼────────────────────────┼─────────────────────────────┤
│ KYC status               │ On-chain read           │ Non-sensitive boolean.      │
│ (verified yes/no,        │ (CredentialRegistry     │ Already on-chain as         │
│  credential expiry)      │  .validate() or         │ credential. No CRE needed.  │
│                          │  consumer.isVerified())  │                             │
├──────────────────────────┼────────────────────────┼─────────────────────────────┤
│ Per-trade compliance     │ On-chain read           │ Non-sensitive: approved/     │
│ result                   │ (ComplianceReport       │ rejected, risk score,       │
│ (approved, risk score)   │  Consumer.getReport())  │ audit hash. Public data.    │
├──────────────────────────┼────────────────────────┼─────────────────────────────┤
│ Per-trade full audit     │ Decentralized storage   │ Detailed provider responses │
│ record (all provider     │ IPFS via Pinata,        │ (point-in-time). Retrieved  │
│  responses, jurisdiction │ by auditHash from       │ by hash, verified against   │
│  rules applied)          │ on-chain report         │ on-chain hash. No CRE       │
│                          │                        │ needed for read.            │
├──────────────────────────┼────────────────────────┼─────────────────────────────┤
│ Identity audit package   │ CRE Workflow C          │ Full Sumsub audit trail,    │
│ (for regulatory audits,  │ (HTTP trigger,          │ document check history,     │
│  regulator requests)     │  Confidential HTTP,     │ reviewer actions. Must be   │
│                          │  encrypted + scoped)    │ fetched in TEE, scoped.     │
└──────────────────────────┴────────────────────────┴─────────────────────────────┘
```

**Rule of thumb:** If the data is sensitive (PII, detailed provider responses), access it through a CRE workflow in the TEE. If it's a status or a hash (non-sensitive), read it directly on-chain. Per-trade audit records are stored off-chain but verified against on-chain hashes - no workflow needed for read access, just hash verification.

---

## Architecture B: Off-Chain Backend (Traditional API Keys)

### Core Concept

A thin backend server manages API keys, scoped queries, and WebSocket connections. Integrators authenticate with API keys rather than wallet signatures. The backend reads from chain and IPFS, filtering results by the integrator's scope.

The provider account model is the same as Architecture A: one master Sumsub account, one master Chainalysis key. The backend calls CRE workflows or Sumsub directly, using the same externalUserId namespacing. The difference is that the backend manages API keys and enforces scoping server-side rather than relying on on-chain data + CRE.

### Onboarding Flow

```
Protocol creates account:
  → POST /api/workspaces { name: "proto_abc" }
  → Backend generates: APP-ID + master API key
  → APP-ID goes into smart contracts (events include it)
  → API key used in all REST/SDK calls

Broker joins workspace:
  → POST /api/workspaces/proto_abc/join { role: "broker" }
  → Backend generates: scoped API key for "broker_xyz" in workspace "proto_abc"
  → Key encodes: workspace + role + integrator identity

LP joins workspace:
  → Same pattern, role: "lp"
  → Scoped API key for "lp_456"
```

### How Each Action Works

#### Trigger KYC

```
Broker's frontend                Backend              CRE              Chain
     │                              │                  │                 │
     │── POST /api/kyc/trigger ────▶│                  │                 │
     │   API key in header           │                  │                 │
     │                              │── validate key ──│                 │
     │                              │── extract scope ─│                 │
     │                              │   (broker_xyz)   │                 │
     │                              │── HTTP trigger ─▶│                 │
     │                              │  {wallet, appId, │                 │
     │                              │   brokerAppId}   │                 │
     │                              │                  │── TEE checks ──▶│
     │                              │                  │── writeReport ─▶│
     │                              │                  │                 │
     │                              │◀── webhook ──────│                 │
     │                              │── push via WS ──▶│                 │
     │◀── "user verified" ──────────│                  │                 │
```

#### Access KYC/AML Data

```
Broker calls:
  GET /api/users/{userId}/kyc
  Header: Authorization: Bearer broker_api_key

Backend:
  → Validates API key → extracts scope: broker_xyz
  → Checks: did broker_xyz onboard this user? (reads chain or DB)
  → If yes: fetches KYC data from Sumsub (or delegates to CRE Workflow C)
  → Returns scoped response

LP calls:
  GET /api/trades/{tradeId}/audit
  Header: Authorization: Bearer lp_api_key

Backend:
  → Validates API key → extracts scope: lp_456
  → Checks: did lp_456 fill this trade? (reads chain)
  → If yes: returns audit record from DB
  → Verifies hash matches on-chain auditHash
```

#### Real-Time Events

```
Broker connects:
  WSS /events
  Header: Authorization: Bearer broker_api_key

Backend:
  → Validates key → scope = broker_xyz
  → Subscribes to on-chain events internally
  → Filters: only events WHERE brokerAppId = "broker_xyz"
  → Pushes filtered events to broker's WebSocket connection

LP connects:
  WSS /events
  Header: Authorization: Bearer lp_api_key

Backend:
  → Filters: only events WHERE lpAppId = "lp_456"
  → Pushes to LP's connection
```

### Backend Components

```
Thin API Backend:

  Auth layer:
    → API key validation
    → Scope extraction (which workspace, which role, which appId)

  REST endpoints:
    → POST /api/workspaces              (create workspace)
    → POST /api/workspaces/:id/join     (join workspace)
    → POST /api/kyc/trigger             (trigger KYC via CRE)
    → GET  /api/users                   (list users, scoped)
    → GET  /api/users/:id/kyc           (KYC/AML data, scoped)
    → GET  /api/trades                  (list trades, scoped)
    → GET  /api/trades/:id/audit        (audit trail, scoped)

  WebSocket:
    → WSS /events                       (filtered compliance events)

  What it does NOT do:
    → Process PII (that's CRE in TEE)
    → Make compliance decisions (that's CRE workflows)
    → Hold provider credentials (that's CRE Vault DON)
    → Write compliance attestations (that's on-chain)
```

---

## Side-by-Side Comparison

| Capability | On-Chain (Wallet = Key) | Off-Chain (API Keys + Backend) |
|---|---|---|
| **Integrator registration** | Contract call: `createWorkspace()` | REST call: `POST /api/workspaces` |
| **Identity mechanism** | EVM wallet signature | API key in header |
| **APP-ID generation** | Deterministic on-chain | Backend generates |
| **Scoping enforcement** | On-chain data + CRE reads registry in TEE | Backend filters queries server-side |
| **Trigger KYC** | Wallet signature → CRE directly | API key → backend → CRE |
| **Access KYC/AML data** | Wallet signature → CRE Workflow C → encrypted | API key → backend → Sumsub/CRE |
| **Access per-trade audit** | Read on-chain reports + fetch by hash | API key → backend → DB query |
| **Real-time events** | EVM event subscription (client-side filter) | Backend WebSocket (server-side filter) |
| **Multi-tenant scoping** | AppId embedded in on-chain data, verifiable | Backend enforces, trust the server |
| **DX quality** | Wallet signatures, chain reads, more DIY | REST API, managed WebSocket, familiar patterns |
| **Infrastructure needed** | None (CRE + chain + RPC provider) | Server + DB + WebSocket server |
| **Trust model** | Trustless - scoping on-chain, data via TEE | Trust the backend to scope correctly |
| **Uptime dependency** | Chain + CRE DON (decentralized) | Your server (single point of failure) |
| **Cost to operate** | Gas for contract calls + CRE fees | Server hosting + DB + maintenance |

---

## Why We Chose the On-Chain Architecture

We chose the fully on-chain architecture (Architecture A) for the following reasons:

**Trustless scoping.** In the off-chain model, integrators must trust that the backend correctly enforces scoping - that a broker only sees their users, that an LP only sees their trades. With the on-chain model, scoping is verifiable: the appId is embedded in on-chain credentials and reports. Anyone can independently verify which broker onboarded which user and which LP filled which trade. The backend could silently misscope data; the chain cannot.

**No infrastructure to maintain or trust.** DeFi protocols - our target customers - are allergic to centralized infrastructure dependencies. A backend server is a single point of failure: if it goes down, integrators can't access compliance data. With the on-chain model, the data lives on the chain (always available) and sensitive data access goes through CRE (Chainlink DON, 21 independent nodes). There is no server to maintain, no database to back up, no downtime to worry about. This is especially important for small teams that can't afford 24/7 ops.

**Consistent with the core value proposition.** The entire compliance engine is built on the premise that protocols shouldn't need to trust a centralized operator. Adding a centralized backend for integrator management would undermine this premise. If we're telling protocols "you can trust our compliance checks because they run on a decentralized DON," we shouldn't then say "but trust our centralized server for access control." The on-chain model keeps the trust story consistent end-to-end.

**Wallet signatures are native to our users.** Every integrator in the DeFi ecosystem already has an EVM wallet. Using wallet signatures instead of API keys is not a UX burden for this audience - it's the expected pattern. They already sign transactions, already connect wallets to dApps, already use wallet-based authentication. API keys would be the foreign concept.

**Self-sovereign data access.** With the on-chain model, integrators don't depend on us to access their data. If we disappear tomorrow, the on-chain credentials, reports, and scoping data are still there. Any integrator can read the chain, filter by their appId, and access their records. The CRE workflows can be redeployed by anyone (open source). There is no vendor lock-in. This is a fundamentally different reliability guarantee than a centralized backend.

**The backend can always be added later.** The on-chain model provides the complete functionality. A thin backend (REST API, managed WebSocket, API key convenience) can be layered on top as a DX improvement without changing the underlying architecture. The reverse is not true - starting with a centralized backend and later decentralizing is architecturally invasive. We chose to build the trustless foundation first.
