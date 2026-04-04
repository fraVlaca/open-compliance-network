# 12 — SDK & Developer Tooling

## Overview

The compliance engine offers developer tooling at three levels: a frontend SDK for identity verification, on-chain contracts for smart contract integration, and documentation for protocol/integrator onboarding. The goal is minimal integration effort — 5 lines of React for frontends, 1 line of Solidity for contracts, 1 transaction for integrator registration.

## Frontend SDK (`@veritas/sdk-react`)

The primary developer-facing deliverable. A React component that wraps the Sumsub WebSDK and CRE workflow trigger into a drop-in KYC widget.

### Installation

```
npm install @veritas/sdk-react
```

### Usage

```tsx
import { ComplianceVerification } from "@veritas/sdk-react";

function App() {
  return (
    <ComplianceVerification
      appId="proto_abc"               // workspace APP-ID from IntegratorRegistry
      chainId={11155111}              // target chain (Sepolia)
      onVerified={(credential) => {
        console.log("User verified:", credential);
      }}
    />
  );
}
```

### What Happens Under the Hood

```
1. Component connects user's wallet (or uses existing provider)
2. Calls CRE Workflow A via HTTP trigger:
   → Signed with user's wallet
   → Payload: { walletAddress, appId }
3. CRE generates Sumsub access token inside TEE
   → Returns token to frontend
4. Component initializes Sumsub WebSDK with that token
   → User uploads documents, takes selfie
   → Sumsub processes verification
5. On Sumsub completion callback:
   → Triggers CRE Workflow A again to verify status + write credential
6. Polls on-chain: isVerified(wallet)?
   → When true: fires onVerified callback
   → Component shows "Verified" state
```

The integrator doesn't know about CRE, Sumsub, externalUserId namespacing, or credential registries. They install a package and add a component.

### Package Structure

```
@veritas/sdk-react
  ├── ComplianceVerification     — drop-in KYC widget
  ├── useComplianceStatus        — hook: is this wallet verified?
  ├── useComplianceReport        — hook: get per-trade compliance report
  └── ComplianceProvider         — context provider with chain config

@veritas/sdk-core (optional, for non-React / Node.js)
  ├── triggerVerification()      — signs + sends HTTP trigger to CRE
  ├── checkStatus()              — reads isVerified() on-chain
  └── getReport()                — reads ComplianceReport on-chain
```

## Smart Contract Integration

Already implemented via `@chainlink/ace` + the compliance engine's consumer contracts. No additional SDK needed.

### Integration Patterns

**Pattern 1 — Simplest (1 line):**
```solidity
require(consumer.isVerified(msg.sender), "Not compliant");
```

**Pattern 2 — ACE PolicyEngine:**
```solidity
function trade(...) external runPolicy { ... }
```

**Pattern 3 — Async per-trade with auto-callback:**
```solidity
emit ComplianceCheckRequested(tradeId, msg.sender, counterparty, asset, amount);
// CRE checks → auto-calls onComplianceApproved(tradeId)
```

The `DemoSwapProtocol` contract demonstrates all three patterns.

## Protocol Onboarding (Documentation-Based)

Protocol onboarding is infrequent (once per protocol) and involves smart contract deployment/modification. It's documented as a getting-started guide, not a CLI or SDK.

### Getting Started Guide

```
Step 1: Register your protocol workspace
  → Call IntegratorRegistry.createWorkspace("my-protocol")
  → Save the returned APP-ID (bytes32)
  → This is your namespace for all users, integrators, and trades

Step 2: Add compliance check to your contract
  → Option A: require(consumer.isVerified(msg.sender))  // 1 line
  → Option B: inherit PolicyProtected, add runPolicy     // ACE pattern
  → Option C: emit ComplianceCheckRequested(...)          // async + auto-callback

Step 3: Install the frontend SDK
  → npm install @veritas/sdk-react
  → Add <ComplianceVerification appId="your-app-id" />
  → Users can now get verified through your frontend

Step 4: Register callback (if using async pattern)
  → ComplianceReportConsumer.registerCallback(yourContract)
  → Implement IComplianceCallback in your contract

Step 5: Done. Users get verified and trade.
```

### Why Documentation, Not a CLI

- Protocol setup involves deploying/modifying smart contracts — that's Foundry/Hardhat territory
- The on-chain registration is one transaction — doesn't need wrapping
- DeFi developers prefer understanding the primitives over magic scripts
- The DemoSwapProtocol IS the reference implementation

## Integrator / LP Onboarding (Single Transaction)

Brokers and LPs join a workspace with one on-chain transaction. No CRE workflow is triggered — the IntegratorRegistry is pure on-chain state that CRE workflows read from later.

```
Broker joins:
  IntegratorRegistry.joinWorkspace(workspaceId, BROKER)
  → Emits IntegratorJoined(appId, wallet, BROKER)
  → Broker's wallet is now mapped to their appId
  → CRE reads this when broker triggers KYC or requests audit data

LP joins:
  IntegratorRegistry.joinWorkspace(workspaceId, LP)
  → Emits IntegratorJoined(appId, wallet, LP)
  → LP's wallet is now mapped to their appId
  → CRE reads this when LP requests per-trade audit data
```

No CRE workflow is triggered by registration because:
- We use one master Sumsub account with externalUserId namespacing — nothing to set up at the provider level
- The on-chain registry IS the setup — CRE reads it later when processing requests
- The integrator's wallet IS their API key — no key generation needed

### Onboarding options for integrators

- **Etherscan** — call `joinWorkspace` directly on the verified contract
- **Demo frontend** — "Register as Integrator" page with a form
- **Documentation** — show the exact transaction to send

## IntegratorRegistry Contract

On-chain registry that stores workspace and integrator identity. This is NOT a heavy framework — it's a simple mapping contract that CRE workflows read for scoping.

### Key Functions

```
createWorkspace(string name)
  → Creates a workspace with a deterministic APP-ID
  → Caller becomes admin
  → Emits WorkspaceCreated(appId, admin)

joinWorkspace(bytes32 workspaceId, Role role)
  → Registers caller as broker/LP in the workspace
  → Requires workspace to exist and be active
  → Emits IntegratorJoined(appId, wallet, role)

approveIntegrator(address integrator) [admin only]
  → Activates a pending integrator (if approval is required)

getIntegrator(address wallet)
  → Returns appId, workspaceId, role, active status
  → Used by CRE workflows to determine requester's scope
```

### No CRE Workflow Triggered

Neither `createWorkspace` nor `joinWorkspace` triggers a CRE workflow. The events are emitted for frontend indexing and confirmation, not for CRE automation. The registry is read-only from CRE's perspective — workflows call `integrators(address)` to look up the requester's role and appId at execution time.

## Demo Frontend

A simple Next.js app that showcases the SDK and onboarding flow:

```
Page 1: "Protocol Setup"
  → Connect wallet → createWorkspace() → shows APP-ID
  → "Use this in your contracts and SDK"

Page 2: "Register as Integrator"
  → Connect wallet → joinWorkspace(appId, BROKER or LP)
  → Shows confirmation + role

Page 3: "User Verification" (main showcase)
  → <ComplianceVerification appId="proto_abc" />
  → User goes through Sumsub KYC flow
  → Shows credential being written on-chain
  → Shows isVerified() returning true

Page 4: "Trade Demo"
  → Verified user swaps successfully (DemoSwapProtocol)
  → Unverified user gets reverted
  → Shows async flow: swap() → CRE checks → auto-callback → executed

Page 5: "Audit Access"
  → Broker view: their onboarded users + KYC status
  → LP view: trades they filled + audit hashes
  → Click to trigger Workflow C for detailed data
```
