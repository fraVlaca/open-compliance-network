# 09 - Provider Integration Map

## Overview

The compliance engine orchestrates multiple specialized providers, each covering a distinct compliance domain. This document details each integration, the fragmentation it solves, and the minimum viable provider set.

## Provider Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   CRE WORKFLOW (TEE)                     │
│                                                         │
│  ┌──────────┐  ┌─────────────┐  ┌──────────┐           │
│  │  Sumsub   │  │ Chainalysis │  │ Notabene │           │
│  │           │  │             │  │          │           │
│  │ Identity  │  │ Blockchain  │  │ Travel   │           │
│  │ KYC/CDD   │  │ Analytics   │  │ Rule     │           │
│  │ Sanctions │  │ Wallet Risk │  │ VASP Msg │           │
│  │ PEP       │  │ Monitoring  │  │          │           │
│  └──────────┘  └─────────────┘  └──────────┘           │
│        │              │               │                 │
│        └──────────────┼───────────────┘                 │
│                       │                                 │
│              ┌────────▼─────────┐                       │
│              │  Rules Engine    │                        │
│              │  Jurisdiction    │                        │
│              │  Asset Rules     │                        │
│              │  Risk Aggregation│                        │
│              └────────┬─────────┘                       │
│                       │                                 │
│              ┌────────▼─────────┐                       │
│              │  Audit Assembly  │                        │
│              │  + Hash          │                        │
│              └──────────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

## Integration 1: Sumsub (Identity Layer)

### Capabilities Used
| Check | Sumsub Feature | API Endpoint |
|-------|---------------|-------------|
| KYC / CDD | Identity verification | `GET /resources/applicants/{id}` |
| Sanctions screening | AML screening | Included in applicant data |
| PEP screening | PEP database | Included in applicant data |
| Adverse media | Media monitoring | Included in applicant data |
| Document verification | OCR + face match | Via SDK (user-facing, not per-trade) |

### Credentials (in TEE)
- `SUMSUB_APP_TOKEN` - authenticates API calls
- `SUMSUB_SECRET_KEY` - signs API requests
- `SUMSUB_WEBHOOK_SECRET` - verifies webhook signatures (if used)

### Fragmentation Analysis

**What Sumsub already shares:**
- Reusable KYC Networks - identity verification data can be shared across Sumsub clients in the network
- User only needs to verify once; partner platforms get the result with a liveness check
- Source keys can group applicants, but cannot be created programmatically (dashboard only)

**What Sumsub does NOT share:**
- Sanctions screening results - each party re-screens even within the same Sumsub network
- PEP screening results - re-screened per party
- AML monitoring alerts - per-account

**What the engine adds:**
- Sanctions + PEP results captured once at trade time, shared to all parties
- Point-in-time snapshot preserved in unified audit trail
- On-chain attestation of the result

### Multi-Tenant Model

One master Sumsub account, one app token in CRE Vault DON. All protocols, brokers, and users share the same account. Multi-tenancy is enforced by the compliance engine, not by Sumsub.

**Namespacing via `externalUserId`:**
```
Format: "{workspaceId}:{brokerAppId}:{walletAddress}"
Example: "proto_abc:broker_xyz:0xUserWallet"
```

- All applicants live under one Sumsub account
- CRE workflows create applicants with namespaced externalUserId
- CRE Workflow C (identity audit) enforces scoping: checks on-chain registry to verify the requester's role and appId, then fetches only matching applicants from Sumsub
- Sumsub itself sees a flat list - scoping is in on-chain data + CRE workflow logic

**Why not Sumsub source keys or sub-accounts?**
Sumsub offers source keys for applicant grouping and scoped app tokens, but source keys can only be created via the dashboard (no API). This requires manual intervention per new protocol - incompatible with trustless, programmatic onboarding. A single master account with externalUserId namespacing is fully automated.

**Integrator data access:**
Integrators access their scoped KYC/AML data through CRE Workflow C (identity audit). They sign an HTTP request with their wallet. CRE reads the on-chain IntegratorRegistry to determine their role and appId, queries Sumsub for matching applicants (filtered by externalUserId prefix), and returns data encrypted to the integrator's key. Integrators never access Sumsub directly.

---

## Integration 2: Chainalysis (Blockchain Analytics Layer)

### Capabilities Used
| Check | Chainalysis Feature | API Endpoint |
|-------|-------------------|-------------|
| Wallet risk scoring | KYT Risk API | `GET /api/risk/v2/entities/{address}` |
| Counterparty screening | Same API, different address | `GET /api/risk/v2/entities/{address}` |
| Exposure analysis | Entity neighbors | `GET /api/risk/v2/entities/{address}/neighbors` |
| Transaction monitoring | KYT Transfers | `POST /api/kyt/v2/transfers` |
| Ongoing monitoring | Alerts API | `GET /api/kyt/v2/alerts` |

### Credentials (in TEE)
- `CHAINALYSIS_API_KEY` - single API key for all calls

### Fragmentation Analysis

**What Chainalysis shares:**
- Nothing. Zero sharing mechanism.
- Each organization has its own account, its own API key, runs its own screenings independently.
- There is no "Reusable Screening" feature.
- No shared results across parties.
- No multi-tenant access.

**The cost of this fragmentation:**
- Chainalysis licenses range from ~$100-500K/year per organization
- With 4 parties, that's $400K-2M/year for screening the same wallets
- Each party gets a separate, potentially inconsistent result

**What the engine adds:**
- ONE Chainalysis license covers all parties
- ONE screening per wallet per trade (not N screenings)
- Results are shared via the unified audit trail
- All parties see the same risk score and exposure analysis
- Consistency guaranteed - no divergent results from different screening times

**This is where the engine adds the most tangible value.** Chainalysis's zero-sharing model means the engine eliminates the most expensive source of redundancy.

### Integration Notes
- Chainalysis API has sub-100ms latency for risk scoring - suitable for real-time per-trade checks
- Each wallet screening returns a risk score, exposure categories, and alert status
- Counterparty screening uses the same API but with the counterparty's address
- Results are captured point-in-time and stored in the audit record

---

## Integration 3: Notabene (Travel Rule Layer)

### Capabilities Used
| Check | Notabene Feature | Purpose |
|-------|-----------------|---------|
| VASP identification | Counterparty VASP lookup | Identify who the counterparty is |
| Data exchange | Travel Rule messaging | Exchange originator/beneficiary info |
| Protocol interop | Multi-protocol bridge | Connect to 125+ VASPs across TRISA, Sygna, TRUST, etc. |
| Compliance check | Transfer analysis | Verify Travel Rule requirements are met |

### Credentials (in TEE)
- `NOTABENE_API_KEY` - API access
- `NOTABENE_VASP_DID` - the engine's VASP decentralized identifier

### Fragmentation Analysis

**What Notabene shares:**
- Nested VASPs - subsidiaries under a parent VASP can share infrastructure
- But this is for corporate structure, not unrelated parties (LP ≠ subsidiary of protocol)

**What Notabene does NOT share:**
- Each legal entity must register as a separate VASP
- Each VASP independently manages their Travel Rule compliance
- No "shared compliance" across unrelated parties

**What the engine adds:**
- The engine acts as the Travel Rule compliance point for the protocol
- Instead of N parties each registering as a VASP, the protocol's engine handles it
- Travel Rule data exchange is performed once per trade
- Results are captured in the unified audit trail

### MiCA Urgency
Travel Rule compliance under MiCA is mandatory by July 2026 (3 months from now). For transfers above EUR 1,000, originator and beneficiary information must be exchanged between VASPs. This is the most time-sensitive integration.

---

## Integration 4: Custom Rules Engine (Workflow Code)

### Capabilities
| Check | Implementation | Data Source |
|-------|---------------|-------------|
| Jurisdiction rules | Configurable rule set | KYC data (jurisdiction) + trade data |
| Asset eligibility | Asset classification map | Protocol configuration |
| Trade size thresholds | Jurisdiction-specific limits | Regulatory databases |
| Structuring detection | Velocity + pattern analysis | Historical trade data |
| EDD requirements | Risk-based thresholds | Aggregated risk score |
| Risk aggregation | Weighted scoring | All provider results |

### Fragmentation Analysis

**What exists today:** Nothing. No off-the-shelf provider offers this as a shared, configurable service.

Each party writes their own jurisdiction rules with:
- Different interpretations of the same regulations
- Inconsistent thresholds
- No transparency into each other's rules
- No way to verify consistency

**What the engine adds:**
- One open-source rule set, verifiable via workflowId
- Same rules applied to every trade for every party
- Rule changes produce a new workflowId (visible on-chain)
- All parties can read and audit the rules before trusting them

---

## Minimum Viable Provider Set

### Day One (hackathon / MVP)
| Provider | Purpose | Priority |
|----------|---------|----------|
| Sumsub | KYC, sanctions, PEP | Must have |
| Chainalysis | Wallet risk, counterparty | Must have |
| Pinata | IPFS audit record storage | Must have |
| Custom rules | Jurisdiction, asset rules | Must have |

Pinata pins AuditRecords to IPFS. Content-addressed - the CID is derived from the content. On-chain `auditHash` provides tamper detection independent of IPFS. Free tier sufficient for hackathon.

### Near-Term (post-hackathon)
| Provider | Purpose | Priority |
|----------|---------|----------|
| Notabene | Travel Rule (MiCA deadline July 2026) | Should have |
| Elliptic | Second analytics provider (redundancy) | Nice to have |

### Future
| Provider | Purpose | Priority |
|----------|---------|----------|
| Adverse media provider | Beyond Sumsub's built-in | Nice to have |
| SAR filing integration | Jurisdiction-specific reporting | Future |
| Regulatory reporting APIs | Automated compliance reports | Future |

## Provider Replaceability

The engine's architecture means providers are modular components, not locked-in dependencies:

- If Chainalysis raises prices → swap in Elliptic
- If Sumsub doesn't meet needs → swap in Onfido or Jumio
- If Notabene doesn't cover a protocol → use TRISA or Sygna directly

Each swap produces a new workflowId (new code hash). The community reviews the updated code. The consumer contract is updated to accept the new workflow. The architecture stays the same.

This is a key advantage: **the engine is provider-agnostic infrastructure.** The providers are pluggable. The orchestration, verification, and audit trail are the constant.
