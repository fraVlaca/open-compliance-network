<div style="text-align:center" align="center">
    <a href="https://chain.link" target="_blank">
        <img src="https://raw.githubusercontent.com/smartcontractkit/chainlink/develop/docs/logo-chainlink-blue.svg" width="225" alt="Chainlink logo">
    </a>

[![License](https://img.shields.io/badge/license-MIT-blue)](https://github.com/smartcontractkit/cre-templates/blob/main/LICENSE)
[![CRE Home](https://img.shields.io/static/v1?label=CRE\&message=Home\&color=blue)](https://chain.link/chainlink-runtime-environment)
[![CRE Documentation](https://img.shields.io/static/v1?label=CRE\&message=Docs\&color=blue)](https://docs.chain.link/cre)

</div>

# Open Compliance Layer - Trustless Compliance Engine for Institutional DeFi

A shared, verifiable compliance orchestration layer built on [Chainlink CRE](https://docs.chain.link/cre) and [Chainlink ACE](https://chain.link/automated-compliance-engine), deployed on [Arc](https://docs.arc.network/) (Circle). Runs KYC, AML, sanctions screening, and per-trade compliance checks inside a Trusted Execution Environment on a decentralized oracle network - producing on-chain attestations, per trade checks and audit trails that every counterparty can trust.

## The Problem

DeFi protocols face a compliance catch-22: they need KYC to attract institutional capital, but adding compliance infrastructure destroys their decentralization and triggers regulatory classification as a financial intermediary. Even protocols that accept this burden see every counterparty (LPs, brokers, custodians) independently running the same compliance checks - duplicating costs across Sumsub, Chainalysis, and Notabene accounts.

## The Solution

A compliance oracle that sits between DeFi protocols and compliance providers. Protocols read an on-chain attestation - same as reading a Chainlink price feed. They never touch PII, never run KYC infrastructure, never become data processors.

**One check per trade. One audit trail. Every party trusts it.**

```
Frontend/SDK ──► CRE Workflow (TEE) ──► Sumsub + Chainalysis ──► On-chain credential
                                                                       │
Protocol contract reads: require(isVerified(wallet))  ◄────────────────┘
```

## Why Arc (Circle)

Open Compliance Layer is deployed on **Arc** as a foundational DeFi building block for the ecosystem. Arc is purpose-built for institutional finance - USDC-native gas, Circle's full-stack platform, and regulatory-first design. This is exactly the chain where compliance infrastructure matters most.

**What we unlock for Arc:**

- **Institutional DeFi readiness out of the box.** Any protocol deploying on Arc can integrate compliance with 1 line of Solidity. No KYC backend to build, no Sumsub account to manage, no compliance team to hire.
- **USDC-native compliance gating.** The EscrowSwap demo uses USDC for escrow-based swaps with compliance checks - the natural primitive for Arc's stablecoin-first economy.
- **Shared compliance infrastructure.** Instead of every Arc protocol independently building compliance stacks, they share one engine. LPs, brokers, and protocols all read from the same on-chain attestations.
- **Preserves decentralization.** Arc protocols can serve regulated institutions without becoming regulated entities themselves.
- **Cross-chain ready.** Credentials use ACE's Cross-Chain Identifiers (CCIDs) - portable across EVM chains via CCIP.

## Key Features

- **1-line integration**: `require(consumer.isVerified(msg.sender))` - that's the entire compliance check
- **Per-trade deep checks**: Sanctions screening, counterparty risk, jurisdiction rules - auto-callback executes the trade
- **Shared audit trail**: On-chain hash + IPFS record. All parties see the same data. Point-in-time evidence.
- **Multi-tenant scoping**: Protocol -> Broker -> LP hierarchy. Each sees only their scoped data. Wallet = API key.
- **Provider credentials in TEE**: Sumsub and Chainalysis keys never leave the enclave.
- **Self-binding**: Open-source code, workflow ID pinned on-chain. The operator cannot selectively approve/reject trades.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  ON-CHAIN (Arc Testnet)                                 │
│  IntegratorRegistry ─── workspaces, brokers, LPs        │
│  ComplianceCredentialConsumer ─── KYC credentials        │
│  ComplianceReportConsumer ─── per-trade reports + IPFS   │
│  EscrowSwap ─── demo USDC escrow with compliance gating │
│  ACE PolicyEngine + IdentityRegistry + CredentialRegistry│
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  CRE WORKFLOWS (Chainlink DON, TEE)                     │
│  Workflow A: Identity verification (HTTP trigger)        │
│  Workflow B: Per-trade compliance (EVM Log trigger)      │
│  Workflow C: Identity audit (HTTP trigger, scoped)       │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  STORAGE                                                 │
│  On-chain ─── ComplianceReport (decision + auditHash)    │
│  IPFS (Pinata) ─── full AuditRecord (content-addressed)  │
│  Sumsub ─── PII (accessed on-demand via TEE only)        │
└─────────────────────────────────────────────────────────┘
```

## Deployed Contracts (Arc Testnet)

| Contract | Address |
|----------|---------|
| PolicyEngine | [`0x95a9992a...`](https://testnet.arcscan.app/address/0x95a9992a647E9dEfB5611cEf5A3DD0b98d8B1772) |
| IdentityRegistry | [`0xC6DD797B...`](https://testnet.arcscan.app/address/0xC6DD797BF67d4f15e983ca2CE43967F345DF1993) |
| CredentialRegistry | [`0x88064228...`](https://testnet.arcscan.app/address/0x8806422a28932c8DbC87F8085218B250dB3A69d9) |
| ComplianceCredentialConsumer | [`0x03726f51...`](https://testnet.arcscan.app/address/0x03726f51b287b04710DeB2cb62Bb9264bAC5bb11) |
| ComplianceReportConsumer | [`0x78Bb94BC...`](https://testnet.arcscan.app/address/0x78Bb94BCf494BB9aDE77f28dd20cE80077275A27) |
| IntegratorRegistry | [`0xCC1Ca53a...`](https://testnet.arcscan.app/address/0xCC1Ca53a3e0fc709EEF9a4682dC1bC1db3C028b1) |
| EscrowSwap | [`0x8f4e547A...`](https://testnet.arcscan.app/address/0x8f4e547A8AC08acbE6deeD40fDD8B665b76B3b6D) |

**Network**: Arc Testnet (Circle) - Chain ID 5042002 - [Faucet](https://faucet.circle.com/)

## Integration Patterns

### Pattern 1: Simplest (1 line)
```solidity
function trade(...) external {
    require(consumer.isVerified(msg.sender), "Not compliant");
}
```

### Pattern 2: ACE PolicyEngine
```solidity
function trade(...) external runPolicy {
    // compliance check is transparent
}
```

### Pattern 3: Async per-trade (single user tx, CRE auto-callbacks)
```solidity
function swap(...) external {
    emit ComplianceCheckRequested(tradeId, msg.sender, counterparty, asset, amount);
    // CRE runs checks → auto-calls onComplianceApproved → trade executes
}
```

## Prerequisites

- [Foundry](https://getfoundry.sh/) (forge, cast)
- [Bun](https://bun.sh/) >= 1.0.0
- [Chainlink CRE CLI](https://docs.chain.link/cre/getting-started/cli-installation)
- Node.js >= 18

### Install Dependencies

```bash
# 1. Install Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# 2. Install Bun
brew install oven-sh/bun/bun

# 3. Install CRE CLI
curl -sSL https://app.chain.link/cre/install.sh | bash

# 4. Install contract dependencies
cd contracts && npm install

# 5. Build + test contracts
forge build && forge test
```

## Project Structure

```
cannes2026/
  contracts/                        # Solidity contracts (Foundry)
    src/
      consumers/
        ComplianceCredentialConsumer.sol   # Receives KYC credentials from CRE
        ComplianceReportConsumer.sol       # Receives per-trade reports + IPFS CID
      extractors/
        SwapExtractor.sol                 # ACE parameter extractor
      interfaces/
        IComplianceCallback.sol           # Auto-callback interface
        IComplianceCredentialConsumer.sol  # 1-line integration interface
      registries/
        IntegratorRegistry.sol            # Workspace + integrator management
      demo/
        DemoSwapProtocol.sol              # Shows all 3 integration patterns
        EscrowSwap.sol                    # Real USDC escrow for Arc demo
    test/                               # 37 tests, all passing
    script/
      Deploy.s.sol                      # Full stack deployment

  workflows/                        # CRE TypeScript workflows
    identity-verification/            # Workflow A: KYC via Sumsub + Chainalysis
    per-trade-compliance/             # Workflow B: Per-trade sanctions + risk → IPFS
    identity-audit/                   # Workflow C: Scoped KYC data for integrators

  documentation/                    # Architecture docs (12 files)
```

## Documentation

See [`documentation/`](./documentation/) for full architecture docs:

| Doc | Topic |
|-----|-------|
| [01 - Problem Statement](./documentation/01-problem-statement.md) | Compliance fragmentation + the catch-22 |
| [03 - Solution Overview](./documentation/03-solution-overview.md) | How the engine works |
| [04 - USP](./documentation/04-unique-value-proposition.md) | Cost, audit trail, verifiability, decentralization |
| [05 - Technical Architecture](./documentation/05-technical-architecture.md) | Contracts, workflows, data flows |
| [06 - Per-Trade Workflow](./documentation/06-per-trade-compliance-workflow.md) | All 9 compliance checks detailed |
| [07 - Audit Trail](./documentation/07-audit-trail-architecture.md) | IPFS storage, on-chain hashes, retrieval |
| [10 - Compliance Catch-22](./documentation/10-compliance-catch22.md) | Why DeFi can't add KYC without CRE |
| [11 - Auth Architecture](./documentation/11-integrator-auth-architecture.md) | On-chain API keys, scoping, multi-tenant |
| [12 - SDK & Tooling](./documentation/12-sdk-and-developer-tooling.md) | Frontend SDK, onboarding, demo frontend |

## Tech Stack

- **Smart Contracts**: Solidity 0.8.26, Foundry, [@chainlink/ace](https://www.npmjs.com/package/@chainlink/ace)
- **CRE Workflows**: TypeScript, Chainlink Runtime Environment, Confidential HTTP
- **Target Chain**: [Arc Testnet](https://docs.arc.network/) (Circle) - USDC-native L1
- **Audit Storage**: IPFS via [Pinata](https://pinata.cloud/) (content-addressed, on-chain hash for integrity)
- **Compliance Providers**: Sumsub (KYC/AML), Chainalysis (blockchain analytics)

## Hackathon

Built for **ETHGlobal Cannes 2026**.

**Arc Track (Circle)**: Open Compliance Layer is a foundational DeFi primitive for Arc - enabling any protocol on the chain to serve regulated institutions without building their own compliance infrastructure. Deployed and live on Arc Testnet.

**Chainlink CRE Track**: Three CRE workflows running compliance checks inside TEE, writing DON-signed attestations on-chain via KeystoneForwarder, using Confidential HTTP for provider API calls with secrets in Vault DON.

## License

MIT (project code). Chainlink ACE contracts are BUSL-1.1.
