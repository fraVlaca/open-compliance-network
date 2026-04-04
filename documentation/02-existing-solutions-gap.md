# 02 — Existing Solutions & Gap Analysis

## Overview

Multiple compliance providers exist, each covering a specific domain. This document maps what each provider offers, whether they solve the fragmentation problem, and where the gap lies.

## Provider Landscape

### Sumsub — Identity Verification Layer

**What they do well:**
- KYC / Customer Due Diligence (CDD)
- Sanctions screening (person-level, against OFAC, EU, UN lists)
- PEP (Politically Exposed Person) screening
- Adverse media screening
- Document verification (passport, ID, selfie match)
- Basic AML screening

**Fragmentation solution:**
- **Reusable KYC Networks**: Sumsub clients can share verification data across platforms. A user verified on Platform A can skip re-verification on Platform B (only a liveness check needed).
- **Source keys**: Applicants can be grouped by source key for scoping, but source keys can only be created via the Sumsub dashboard (not programmatically via API), limiting automated multi-tenant onboarding.
- **Bilateral data sharing**: Two Sumsub clients can agree to share overlapping user data.

**What they don't do:**
- Deep blockchain wallet analysis (they proxy Chainalysis via API key integration, but only basic risk scores)
- Counterparty wallet screening
- Travel Rule messaging protocol interoperability (basic support only)
- Jurisdiction-specific regulatory rules engine
- Asset eligibility checks
- Cross-provider unified audit trail
- Per-trade compliance orchestration

**Fragmentation verdict:** Sumsub solves identity fragmentation PARTIALLY. Reusable KYC eliminates duplicate identity verification, but sanctions and PEP screening are still re-run per party. Blockchain-specific checks are not covered.

---

### Chainalysis / Elliptic — Blockchain Analytics Layer

**What they do well:**
- Deep wallet risk scoring
- Counterparty wallet screening
- Transaction monitoring (real-time, sub-100ms API)
- Entity attribution (mapping wallets to real-world entities)
- Exposure analysis (mixers, darknet markets, sanctioned entities)
- Ongoing wallet monitoring with alerts
- Over 2 billion labeled addresses (Elliptic)

**Fragmentation solution:**
- **None.** Each organization has its own account, its own API key, runs its own screenings independently. There is no "Reusable Screening" feature. No shared results across parties. No multi-tenant access.

**What they don't do:**
- Identity verification (KYC)
- PEP/sanctions screening of persons (only wallet addresses)
- Travel Rule data exchange
- Jurisdiction rules
- Compliance orchestration
- Shared audit trails

**Fragmentation verdict:** Chainalysis/Elliptic offer ZERO sharing mechanism. This is where fragmentation is worst. Every party independently pays $100-500K/year to screen the same wallets and gets separate, incompatible results.

---

### Notabene / TRISA / Sygna — Travel Rule Layer

**What they do well:**
- VASP-to-VASP originator/beneficiary data exchange
- Protocol interoperability (Notabene connects 125+ VASPs across TRISA, Sygna, TRUST, OpenVASP, and others)
- Cross-jurisdiction Travel Rule compliance
- Nested VASP support (for corporate subsidiaries)

**Fragmentation solution:**
- **Nested VASPs** allow subsidiaries to share compliance infrastructure under a parent VASP. But this is for corporate structure, not for unrelated parties (LP, broker, custodian are separate legal entities).
- Each VASP must register independently.

**What they don't do:**
- KYC or identity verification
- Sanctions/PEP screening
- Blockchain wallet analytics
- Per-trade compliance orchestration
- Shared audit trails across parties

**Fragmentation verdict:** Travel Rule is inherently per-VASP. Each legal entity registers separately. Notabene can't eliminate this, but a shared engine reduces N registrations to 1 (the engine operator handles Travel Rule on behalf of the protocol).

---

### Jurisdiction Rules / Risk Aggregation — Custom Logic

**What exists today:**
- No off-the-shelf provider offers a configurable rules engine for jurisdiction-specific asset trading restrictions, trade size thresholds, structuring detection, or risk aggregation across multiple compliance providers.
- Each party builds their own. Different interpretations. Inconsistent enforcement. No transparency.

**Fragmentation verdict:** Complete fragmentation. Every party maintains their own rules with no way to verify they're consistent.

---

### Unified Audit Trail — Nobody

**What exists today:**
- Each provider (Sumsub, Chainalysis, Notabene) maintains records of their own checks within their own platform.
- No provider offers a cross-provider audit trail that combines KYC + sanctions + wallet risk + jurisdiction checks + Travel Rule into a single per-trade record.
- No mechanism for verifiable integrity of the audit trail (e.g., on-chain hash).

**Fragmentation verdict:** The audit trail is the most fragmented component. A regulator asking "show me the full compliance picture for Trade X" gets 4 partial answers from 4 parties using 4 different providers.

## Gap Summary

| Capability | Sumsub | Chainalysis | Notabene | Shared? |
|---|---|---|---|---|
| KYC / CDD | Yes | No | No | Partial (Reusable KYC) |
| Sanctions (person) | Yes | No | No | No (re-screened per party) |
| PEP screening | Yes | No | No | No |
| Wallet risk scoring | Basic proxy | Yes (core) | No | No (zero sharing) |
| Counterparty screening | No | Yes | No | No |
| Transaction monitoring | No | Yes | No | No |
| Travel Rule | Basic | No | Yes (core) | No (per-VASP) |
| Jurisdiction rules | No | No | No | Doesn't exist |
| Asset eligibility | No | No | No | Doesn't exist |
| Risk aggregation | No | No | No | Doesn't exist |
| Per-trade orchestration | No | No | No | Doesn't exist |
| Unified audit trail | No | No | No | Doesn't exist |
| On-chain verifiability | No | No | No | Doesn't exist |

## The Gap

Every individual check has a competent provider. No provider — and no combination of providers — offers:

1. **Atomic per-trade orchestration** across all compliance domains (identity + blockchain analytics + Travel Rule + jurisdiction rules)
2. **A shared, unified audit trail** that combines all provider results into a single per-trade record accessible by all parties
3. **Verifiable execution** that allows any party to independently confirm that the checks ran correctly, consistently, and on the same code for every trade
4. **Elimination of the redundancy problem** for blockchain analytics (Chainalysis), where zero sharing exists today

The fragmentation is not in the checks themselves. The fragmentation is in the **trust and coordination layer** between them.
