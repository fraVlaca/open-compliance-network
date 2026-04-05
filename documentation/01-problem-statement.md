# 01 - Problem Statement: Compliance Fragmentation in Institutional DeFi

## The Setting

A permissioned institutional DeFi protocol enables regulated counterparties - liquidity providers (LPs), solvers, brokers, custodians - to trade tokenized assets on-chain. Every trade must be compliant with KYC, AML, sanctions, Travel Rule, and jurisdiction-specific regulations.

## The Two Problems

### Problem 1: The Compliance Catch-22 (Existential)

DeFi protocols face a fundamental trap: they need compliance to attract institutional capital, but adding compliance infrastructure destroys the decentralization that makes them valuable - and potentially exempt from the heaviest regulations.

The moment a protocol adds KYC, someone must hold the Sumsub account, manage API keys, process PII, and make access decisions. That "someone" becomes an identifiable legal entity. Under MiCA, an identifiable entity providing crypto-asset services is a CASP (Crypto-Asset Service Provider) requiring full licensing. The protocol loses its "fully decentralized" exemption and enters the regulatory escalator: KYC leads to transaction monitoring, Travel Rule, SAR filing, capital requirements, and annual audits. The protocol becomes a regulated financial entity.

Most DeFi protocols choose not to add KYC at all - forgoing institutional capital rather than destroying their decentralized architecture. Institutions stay out. Everyone loses.

**This catch-22 is explored in full detail in [10 - The Compliance Catch-22](./10-compliance-catch22.md).**

### Problem 2: Compliance Fragmentation (Operational)

Even for protocols that accept the regulatory burden, every party in the protocol is independently responsible for running the same compliance checks on the same users for the same trades.

### A Single Trade - Four Times the Work

When a trade is submitted between Party A and Party B on the swap protocol, compliance checks are duplicated across every participant:

**The Defi Protocol** (operator):
- Runs KYC onboarding via their Sumsub/idnetity provider
- Runs sanctions screening via their Chainalysis account
- Runs jurisdiction checks in their custom rules engine
- Stores audit trail in their own database

**The Liquidity Provider**:
- Runs KYC onboarding via their OWN Sumsub account/identity provider
- Runs sanctions screening via their OWN Chainalysis account
- Runs jurisdiction checks in their OWN rules engine
- Stores audit trail in their OWN database

**The Broker / Integrator**:
- Same thing again - their own accounts, their own checks, their own records

**The Custodian**:
- Same thing yet again

**Result: Same user. Same transaction. Same checks. Run 4 times by 4 parties.**

### The Cost of Fragmentation

Each party independently:
- Pays for their own KYC provider license (Sumsub: ~$10-50K/year)
- Pays for their own blockchain analytics license (Chainalysis: ~$100-500K/year)
- Pays for their own Travel Rule provider (Notabene: ~$10-50K/year)
- Maintains their own compliance engineering team
- Maintains their own audit trail infrastructure

Estimated cost across 4 parties: **$1.3-4.4M/year** for the same compliance coverage on the same trades.

### The Audit Trail Problem

Beyond cost, the fragmentation creates a deeper problem: **incompatible audit trails**.

When a regulator audits a trade:
- They ask the LP for their compliance records
- They ask the protocol for theirs
- They ask the broker for theirs
- The records were generated at different times, by different providers, with different configurations
- The records don't align perfectly
- The regulator cannot get a single, consistent view of compliance for one trade

### The Trust Problem

Even if the protocol says "we already checked this user," the LP cannot verify that:
- The protocol actually ran the screening (not just claimed to)
- The same rules were applied to all parties equally
- The results weren't selectively altered
- The screening was run at the time of the trade, not days earlier

So the LP runs the checks again - duplicating cost and fragmenting the audit trail further.

### The User Experience Problem

The end user gets KYC'd 4 times for one swap. Each party asks for the same documents, the same selfie, the same verification flow. This creates friction, drop-off, and a poor onboarding experience.

## The Regulatory Context (2026)

The problem is intensifying:

- **MiCA (EU)**: Full compliance required by July 2026. Mandates KYC/CDD, sanctions screening, transaction monitoring, Travel Rule, and 5-year record retention for all Crypto-Asset Service Providers.
- **Travel Rule (FATF)**: Grandfathering ends July 2026 across EU member states. VASPs must exchange originator/beneficiary data for transfers above threshold.
- **AMLA (EU)**: The new Anti-Money Laundering Authority is operational, with enforcement powers over crypto.
- **Global tightening**: UK consolidating sanctions lists, US SEC/CFTC increasing crypto oversight, Singapore MAS tightening rules.

Every counterparty in an institutional DeFi protocol must independently demonstrate compliance with these regulations. The current model - each party running their own fragmented compliance stack - is unsustainable as regulatory requirements multiply.

## Summary

| Problem | Impact | Type |
|---------|--------|------|
| **Compliance catch-22** | **Adding KYC destroys decentralization, triggers CASP classification** | **Existential** |
| **Entity crystallization** | **Protocol becomes a regulated financial entity** | **Existential** |
| Duplicated compliance checks | 4x cost for the same coverage | Operational |
| Fragmented audit trails | Regulator gets inconsistent views | Operational |
| No cross-party verification | LP can't verify protocol's checks | Trust |
| Multiple user onboardings | Poor UX, user drop-off | UX |
| Growing regulatory burden | MiCA, Travel Rule, AMLA all tightening in 2026 | Regulatory |
| No shared compliance infrastructure | Each party builds from scratch | Operational |

The compliance checks exist. The providers exist. **What's missing is a shared, verifiable orchestration layer that runs checks once, produces a unified audit trail, and allows all parties to trust the results without duplicating the work.**

**Crucially, this layer must exist as independent, decentralized infrastructure - not as a centralized backend that creates an identifiable operator and triggers the compliance catch-22 described above.** The orchestration itself must not compromise the protocol's decentralization.
