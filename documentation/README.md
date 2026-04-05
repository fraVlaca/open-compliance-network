# Unified Trustless Compliance Engine for Institutional DeFi

## Project Documentation Index

This documentation covers the design, architecture, and value proposition of a shared, verifiable compliance engine built on Chainlink CRE (Chainlink Runtime Environment) for permissioned institutional DeFi protocols.

### Business Documentation

| Document | Description |
|----------|-------------|
| [01 - Problem Statement](./01-problem-statement.md) | The compliance fragmentation problem in institutional DeFi |
| [02 - Existing Solutions & Gap Analysis](./02-existing-solutions-gap.md) | What providers exist today, what they solve, and the gap they leave |
| [03 - Solution Overview](./03-solution-overview.md) | The unified compliance engine - what it is and how it works |
| [04 - Unique Value Proposition](./04-unique-value-proposition.md) | USP, competitive moat, and the self-binding argument |

### Technical Documentation

| Document | Description |
|----------|-------------|
| [05 - Technical Architecture](./05-technical-architecture.md) | System architecture, CRE integration, data flows, and on-chain components |
| [06 - Per-Trade Compliance Workflow](./06-per-trade-compliance-workflow.md) | Detailed breakdown of every check in the per-trade workflow |
| [07 - Audit Trail Architecture](./07-audit-trail-architecture.md) | Point-in-time capture, storage strategy, role-based access, and verification |
| [08 - Trust Model & Verification](./08-trust-model.md) | CRE trust guarantees, workflow immutability, and comparison with centralized alternatives |
| [09 - Provider Integration Map](./09-provider-integration-map.md) | Sumsub, Chainalysis, Notabene integration details and fragmentation analysis |
| [10 - The Compliance Catch-22](./10-compliance-catch22.md) | Why DeFi protocols can't add KYC without destroying decentralization, and how the engine resolves it |
| [11 - Integrator Auth Architecture](./11-integrator-auth-architecture.md) | On-chain vs off-chain API key management, integrator onboarding, scoped data access, real-time events |
| [12 - SDK & Developer Tooling](./12-sdk-and-developer-tooling.md) | Backend SDK + Frontend SDK architecture, CRE workflow orchestration, smart contract integration patterns |

### Context

- **Hackathon**: ETHGlobal Cannes 2026
- **Core Technology**: Chainlink Runtime Environment (CRE), Confidential HTTP, Confidential Compute (TEE)
- **Tracks**: Arc (Circle), Chainlink CRE, Chainlink Privacy Standard (Confidential HTTP)
- **Target Use Case**: Permissioned institutional DeFi swap protocol with multiple counterparties (LPs, solvers, brokers, custodians)
- **Four CRE Workflows**: Token Generation (D), Identity Verification (A), Per-Trade Compliance (B), Identity Audit (C) - all using ConfidentialHTTPClient
