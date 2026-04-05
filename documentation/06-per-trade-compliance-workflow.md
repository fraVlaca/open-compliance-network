# 06 - Per-Trade Compliance Workflow

## Overview

Every trade on the protocol triggers a single compliance workflow that runs all required checks atomically. This document details each check, the provider involved, what data is needed, and what the output looks like.

## Workflow Trigger

**Trigger type:** EVM Log Trigger (permissionless)

The Swap Protocol Contract emits an event when a trade is submitted:
```
event ComplianceCheckRequested(
    bytes32 indexed tradeId,
    address indexed trader,
    address indexed counterparty,
    address asset,
    uint256 amount,
    uint256 timestamp
)
```

The CRE workflow listens for this event and begins execution.

## Pre-Trade Checks

### Check 1: Identity Verification (KYC/CDD)

**Provider:** Sumsub (Confidential HTTP)

**What it checks:**
- Is this wallet's owner KYC verified?
- What verification level? (Basic / Enhanced / Institutional)
- Is the verification still valid or expired?
- Does the trade size require Enhanced Due Diligence?

**API call (inside TEE):**
```
GET https://api.sumsub.com/resources/applicants/{applicantId}
Headers:
  X-App-Token: {{.SUMSUB_APP_TOKEN}}
  (Request signed with {{.SUMSUB_SECRET_KEY}})
```

**Output:**
```
kycStatus: "verified" | "pending" | "rejected" | "expired"
kycLevel: "basic" | "enhanced" | "institutional"
kycExpiry: "2027-01-15T00:00:00Z"
requiresEDD: true | false
```

---

### Check 2: Sanctions Screening - Person

**Provider:** Sumsub (Confidential HTTP)

**What it checks:**
- Is this person on OFAC SDN list?
- Is this person on EU consolidated sanctions list?
- Is this person on UN sanctions list?
- Country-specific sanctions lists

**Data source:** Sumsub maintains sanctions databases and screens applicants during verification and on ongoing basis.

**Output:**
```
sanctionsHit: true | false
matchedLists: []  // e.g., ["OFAC_SDN"] if hit
screenedAt: "2026-04-03T14:30:00Z"
```

---

### Check 3: PEP Screening

**Provider:** Sumsub (Confidential HTTP)

**What it checks:**
- Is this person a Politically Exposed Person?
- Adverse media screening
- Related persons (family members, close associates)

**Output:**
```
pepStatus: true | false
adverseMedia: true | false
riskCategory: "none" | "low" | "medium" | "high"
```

---

### Check 4: Wallet Risk Scoring - Trader

**Provider:** Chainalysis (Confidential HTTP)

**What it checks:**
- Risk score for the trader's wallet address
- Direct exposure to sanctioned entities
- Exposure to darknet markets, mixers/tumblers, stolen funds
- Entity attribution (if wallet is linked to a known entity)

**API call (inside TEE):**
```
GET https://api.chainalysis.com/api/risk/v2/entities/{walletAddress}
Headers:
  Token: {{.CHAINALYSIS_API_KEY}}
```

**Output:**
```
walletRiskScore: 2.1  // 0-10 scale
directExposure: {
  sanctionedEntities: 0,
  darknetMarkets: 0,
  mixersTumblers: 0,
  stolenFunds: 0
}
indirectExposure: {
  hops: 3,
  flaggedConnections: 0
}
entityAttribution: "none" | "exchange" | "known_entity"
```

---

### Check 5: Wallet Risk Scoring - Counterparty

**Provider:** Chainalysis (Confidential HTTP)

**What it checks:**
- Same as Check 4 but for the counterparty's wallet
- Critical because the trader might be clean but swapping with a sanctioned wallet

**Output:**
```
counterpartyRiskScore: 1.8
counterpartyExposure: { ... }  // same structure as Check 4
```

---

### Check 6: Jurisdiction Check

**Provider:** Custom rules engine (workflow code, open source)

**What it checks:**
- Is the user's jurisdiction allowed for this asset type?
- Does this jurisdiction have specific trade size thresholds?
- Are there asset-specific restrictions in this jurisdiction?
- Does MiFID II, MiCA, SEC, MAS, or other regulation apply?
- Does the trade size trigger Enhanced Due Diligence requirements?

**Data source:** User's jurisdiction from Sumsub KYC data + rules defined in workflow configuration.

**Output:**
```
jurisdictionAllowed: true | false
applicableRegulation: "MiCA" | "MiFID_II" | "SEC" | "MAS" | ...
requiresEDD: true | false
reportingRequired: true | false  // if trade crosses reporting threshold
assetAllowed: true | false
```

## At-Trade Checks

### Check 7: Transaction Monitoring

**Provider:** Chainalysis + custom rules (workflow code)

**What it checks:**
- Does this trade exhibit structuring patterns? (splitting to avoid thresholds)
- Does the velocity look suspicious? (too many trades too fast)
- Is the trade amount above jurisdiction-specific thresholds?
- MiCA: different rules apply above EUR 1,000

**Output:**
```
structuringRisk: "none" | "possible" | "likely"
velocityFlag: true | false
thresholdExceeded: true | false
tradeSizeCategory: "standard" | "large" | "requires_reporting"
```

---

### Check 8: Travel Rule Data Exchange

**Provider:** Notabene (Confidential HTTP)

**When required:** Transfers above jurisdiction-specific thresholds (MiCA: EUR 1,000 for crypto-to-crypto).

**What it does:**
- Identifies the counterparty VASP
- Exchanges originator and beneficiary identifying information
- Ensures compliance with FATF Travel Rule requirements
- Records the data exchange for audit purposes

**Output:**
```
travelRuleRequired: true | false
travelRuleCompleted: true | false
counterpartyVASP: "identified" | "unhosted" | "unknown"
dataExchangeId: "nt_abc123"  // Notabene reference
```

---

### Check 9: Asset Eligibility

**Provider:** Custom rules engine (workflow code)

**What it checks:**
- Is this specific token/asset classified as a security in the user's jurisdiction?
- Is it a regulated stablecoin under MiCA?
- Is it approved for trading on this protocol?
- Are there specific restrictions for this asset class?

**Output:**
```
assetEligible: true | false
assetClassification: "utility_token" | "security" | "stablecoin" | "tokenized_asset"
restrictionReason: null | "security_in_jurisdiction" | "not_approved" | ...
```

## Post-Check Aggregation

### Risk Aggregation

All individual check results are combined into a single compliance decision:

```
Inputs:
  kycStatus, sanctionsHit, pepStatus, walletRiskScore,
  counterpartyRiskScore, jurisdictionAllowed, structuringRisk,
  travelRuleCompleted, assetEligible

Decision logic (in open-source workflow code):
  REJECT if:
    - kycStatus != "verified"
    - sanctionsHit == true
    - walletRiskScore > threshold (configurable)
    - counterpartyRiskScore > threshold
    - jurisdictionAllowed == false
    - assetEligible == false
    - travelRuleRequired && !travelRuleCompleted

  FLAG for review if:
    - pepStatus == true
    - structuringRisk == "possible"
    - velocityFlag == true

  APPROVE if:
    - All mandatory checks pass
    - No flags (or flags are informational only)
```

### Output: ComplianceReport (on-chain)

```
{
  tradeId: "0xabc...",
  wallet: "0x123...",
  approved: true,
  riskScore: "low",
  auditHash: "0x9f2e...",  // keccak256 of full AuditRecord
  timestamp: 1743696000
}
```

### Output: Full AuditRecord (uploaded to IPFS via Pinata, CID stored on-chain)

Contains ALL of the above check results with full provider responses, point-in-time snapshots, rule versions, and timestamps. This is the complete audit evidence for the trade. Its hash is stored on-chain for integrity verification.

## Check Summary Table

| # | Check | Provider | Sumsub Alone? | Shared Today? |
|---|-------|----------|---------------|---------------|
| 1 | KYC / CDD | Sumsub | Yes | Partial (Reusable KYC) |
| 2 | Sanctions (person) | Sumsub | Yes | No (re-screened) |
| 3 | PEP screening | Sumsub | Yes | No |
| 4 | Wallet risk (trader) | Chainalysis | No | No (zero sharing) |
| 5 | Wallet risk (counterparty) | Chainalysis | No | No |
| 6 | Jurisdiction | Custom rules | No | Doesn't exist |
| 7 | Transaction monitoring | Chainalysis + custom | No | No |
| 8 | Travel Rule | Notabene | No | No (per-VASP) |
| 9 | Asset eligibility | Custom rules | No | Doesn't exist |
| - | Risk aggregation | Custom rules | No | Doesn't exist |
| - | Unified audit trail | Engine | No | Doesn't exist |
