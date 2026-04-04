# 04 — Unique Value Proposition

## One-Liner

A verifiable compliance orchestration layer that runs all per-trade checks once, across all providers, inside a TEE and decentralized network, producing a shared audit trail that every counterparty can trust — eliminating redundant compliance infrastructure across decentralized protocols.

## The Four Pillars of Value

### 1. Eliminate Redundancy — The Cost Argument

Today, N parties independently pay for the same compliance checks on the same trades.

**Without the engine (4 parties):**
| Item | Per Party | Total (4 parties) |
|---|---|---|
| Sumsub license | ~$10-50K/yr | ~$40-200K/yr |
| Chainalysis license | ~$100-500K/yr | ~$400K-2M/yr |
| Notabene license | ~$10-50K/yr | ~$40-200K/yr |
| Compliance engineering | ~$200-500K/yr | ~$800K-2M/yr |
| **Total** | | **$1.3-4.4M/yr** |

**With the engine (1 shared):**
| Item | Cost |
|---|---|
| 1x Sumsub license | ~$10-50K/yr |
| 1x Chainalysis license | ~$100-500K/yr |
| 1x Notabene license | ~$10-50K/yr |
| 1x CRE deployment | Minimal |
| Platform fee | Per-trade fee distributed across parties |
| **Total** | **$120-600K/yr + per-trade fees** |

The biggest single saving: **Chainalysis.** They have zero sharing mechanism. Every party independently pays $100-500K/year to screen the same wallets. The engine turns N Chainalysis licenses into 1.

### 2. Unified Audit Trail — The Compliance Argument

Today, a regulator asking "show me the compliance picture for Trade X" gets fragmented, potentially inconsistent answers from each party.

**Without the engine:**
- Regulator asks LP: "Here's what WE checked" (their Chainalysis report, their KYC records)
- Regulator asks Protocol: "Here's what WE checked" (different report, possibly different time)
- Results don't align perfectly. Regulator questions consistency.

**With the engine:**
- Anyone points to the same on-chain report, the same audit record, signed by 21 independent nodes
- One set of checks, one Chainalysis report ID, one Sumsub applicant ID, one audit hash on-chain
- Regulator gets a single, consistent, immutable view

This is especially powerful for **MiCA compliance** (July 2026), which mandates 5-year record retention and comprehensive audit trails for all compliance actions.

### 3. Verifiable Execution — The Trust Argument

This is the deepest and most differentiated value.

**The problem:** In a multi-party protocol, parties have misaligned incentives. An LP asking "did the protocol really screen this wallet?" has no way to verify the answer with a centralized backend.

**The solution:** Verifiable execution through CRE.

The verification chain:
1. **Source code is open source** — anyone can read the compliance rules
2. **Workflow ID is a hash of the compiled code** — deterministic, verifiable
3. **Consumer contract pins the workflow ID on-chain** — only that specific code is accepted
4. **DON consensus** — 21 independent nodes execute and agree on the result
5. **Signed report on-chain** — threshold signature proves the DON produced it
6. **Audit hash on-chain** — proves the off-chain audit record hasn't been tampered with

**If the workflow code changes, the workflow ID changes.** The consumer contract rejects reports from unknown workflows. All changes are visible on-chain.

### The Self-Binding Property

Building on CRE with open-source code and on-chain pinned workflow IDs creates a structural commitment: **"I cannot selectively approve or reject trades. I cannot change the rules without it being visible on-chain. I cannot treat one integrator differently from another."**

This is "self-binding" — deliberately removing your own ability to cheat. This is a genuine moat: competitors with centralized backends cannot make this claim even if they wanted to.

### 4. Preserve Protocol Decentralization — The Structural Argument

DeFi protocols that add KYC infrastructure directly create an identifiable operator entity, triggering CASP classification under MiCA, the regulatory escalator, and the destruction of their decentralized architecture. This is explored in full detail in [10 — The Compliance Catch-22](./10-compliance-catch22.md).

The engine resolves this by separating the compliance infrastructure from the protocol. The protocol reads an on-chain attestation from an independent, decentralized compliance network. This is architecturally identical to reading a Chainlink price feed — the protocol consumes data, it doesn't operate the oracle.

**What this means for protocol teams:**
- The protocol does not hold PII → harder to classify as data processor
- The protocol does not control access decisions → harder to classify as gatekeeper
- The protocol does not operate compliance infrastructure → harder to classify as service provider
- The protocol reads on-chain data → same as reading any other oracle/data feed
- The protocol may preserve its "fully decentralized" exemption under MiCA

**The Aave Arc lesson:** Aave tried a permissioned sidecar (Aave Arc + Fireblocks whitelisting). It created a separate centralized product, fragmented liquidity, and didn't scale. The compliance engine avoids this by keeping the protocol intact — same pools, same contracts, just with an attestation-gated access layer.

**Honest caveat:** This is legally untested territory. A regulator might still classify the protocol as a facilitator. But the argument is structurally much stronger than any current alternative.

## Competitive Positioning

| | Sumsub (centralized) | Your centralized backend | This engine (CRE) |
|---|---|---|---|
| KYC/AML checks | Yes (core) | Yes (via API) | Yes (via API in TEE) |
| Blockchain analytics | Basic proxy | Via Chainalysis API | Via Chainalysis API in TEE |
| Shared across parties | Partial (Reusable KYC only) | Trust the operator | Verifiable — DON consensus |
| Audit trail | Within Sumsub only | Your DB | Unified, IPFS + on-chain hash |
| Per-trade orchestration | No | Yes | Yes |
| Verifiable execution | No | No | Yes (open code + DON) |
| Self-binding | No | No | Yes (can't cheat by design) |
| Credential exposure | Your server | Your server | Nobody (TEE only) |
| Censorship resistance | Operator can shut down | Operator can shut down | DON runs independently |

## Who This Is For

**Primary:** Permissioned institutional DeFi protocols with multiple counterparties (LPs, solvers, brokers, custodians) who need shared compliance without shared trust.

**Secondary:** Any on-chain protocol that needs per-trade compliance gating and wants to offer compliance-as-infrastructure to their ecosystem.

**Arc ecosystem specifically:** Deployed on Arc (Circle) as a foundational DeFi building block. Arc is purpose-built for institutional finance with USDC-native gas and regulatory-first design. Open Compliance Network enables every protocol on Arc to serve regulated institutions without building compliance infrastructure ��� making Arc the first chain where institutional DeFi is compliance-ready out of the box.

**Not for:** Single-operator centralized exchanges who control all parties and trust their own backend (they should just use Sumsub + Chainalysis directly).

## The Honest Caveat

A centralized backend with SOC2 certification and legal agreements (DPAs) can achieve similar functional outcomes for a single protocol. The engine's value proposition is strongest when:

1. Multiple parties with misaligned incentives need to share compliance results
2. The operator wants to provably demonstrate they cannot manipulate results
3. The target customers are crypto-native and value trustless infrastructure
4. The operator plans to whitelabel the engine for other protocols

For a hackathon audience evaluating decentralized infrastructure: the CRE-based approach demonstrates a fundamentally different trust architecture that centralized alternatives cannot replicate.

## Where CRE Has a Genuine, Hard-to-Replicate Edge

CRE is not just "nice to have" but genuinely superior:

### 1. The adversarial multi-party problem

Your protocol + LP + broker need to agree on compliance.
They don't fully trust each other.

LP: "Did the protocol really screen this wallet, or did
     they skip it for a big customer?"

With your centralized backend:
LP: "Show me your logs"
You: "Here they are"
LP: "How do I know you didn't fabricate them?"
You: "...trust me? Here's my SOC2 cert?"
LP: "That certifies your process, not this specific trade"

With CRE:
LP: reads on-chain report, verifies workflowId matches
     open-source code, confirms DON signature
LP: "Math checks out. I don't need to trust you."

This matters when parties are adversarial or semi-adversarial, which is common in DeFi where LPs and protocols have misaligned incentives. It does NOT matter when everyone trusts the operator (traditional finance model).

### 2. The "prove you can't cheat" problem (self-binding)

You build a compliance engine. You monetize it.
A large customer offers you money to "look the other way" on a specific trade.

Centralized: You technically COULD. Nobody would know.
The temptation exists. The risk exists.

CRE: You physically CANNOT. The code is open source, the workflowId is pinned, the DON runs it. You'd have to update the workflow (new ID, visible on-chain), get the consumer contract updated (visible on-chain), and do all this publicly.

This is "self-binding" — you're removing your own
ability to cheat. This is valuable because:
- It makes your pitch stronger ("we CAN'T cheat")
- It reduces your legal risk ("we COULDN'T have cheated")
- It's a genuine moat (competitors with centralized backends can't make this claim)

### 3. The long-term DECO play

Today: "Trust the DON ran the code correctly"
Tomorrow: "Here's a ZK proof the data came from Sumsub"

If you build on CRE now, you get DECO for free when
it ships. Same workflow, stronger guarantees.