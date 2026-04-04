import { Link } from "react-router-dom";
import {
  Shield,
  ArrowRight,
  Lock,
  FileCheck,
  Code2,
  Zap,
  Globe,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Users,
  Building2,
  ArrowRightLeft,
  Database,
  Cpu,
  Eye,
  EyeOff,
  Network,
  Layers,
} from "lucide-react";
import { CONTRACTS } from "../config/contracts";

const features = [
  {
    icon: Code2,
    title: "1-Line Integration",
    desc: "require(isVerified(msg.sender)) — the entire compliance check. No backend, no compliance team, no provider accounts.",
    color: "text-accent-blue",
    bg: "bg-accent-blue/10",
  },
  {
    icon: Lock,
    title: "Credentials in TEE",
    desc: "Sumsub and Chainalysis keys in Chainlink's Vault DON. Threshold-encrypted across 21 nodes. Decrypted only in the enclave.",
    color: "text-accent-purple",
    bg: "bg-accent-purple/10",
  },
  {
    icon: FileCheck,
    title: "Shared Audit Trail",
    desc: "On-chain hash + IPFS record. Point-in-time evidence. All parties see the same data. keccak256 integrity verification.",
    color: "text-accent-green",
    bg: "bg-accent-green/10",
  },
  {
    icon: Users,
    title: "Multi-Tenant Scoping",
    desc: "Protocol → Broker → LP. Each sees only their data. Wallet = API key. On-chain IntegratorRegistry, no backend auth.",
    color: "text-accent-cyan",
    bg: "bg-accent-cyan/10",
  },
  {
    icon: Eye,
    title: "Self-Binding Transparency",
    desc: "Open-source workflow code. WorkflowId = hash of binary. Pinned on-chain. The operator physically cannot change rules silently.",
    color: "text-accent-amber",
    bg: "bg-accent-amber/10",
  },
  {
    icon: Zap,
    title: "Auto-Callback Trades",
    desc: "User calls swap() once. CRE runs 9 compliance checks, DON reaches consensus, auto-callbacks the protocol. Single TX UX.",
    color: "text-accent-red",
    bg: "bg-accent-red/10",
  },
];

const allContracts = [
  { name: "PolicyEngine", addr: CONTRACTS.policyEngine, desc: "ACE orchestrator" },
  { name: "IdentityRegistry", addr: CONTRACTS.identityRegistry, desc: "Wallet → CCID mapping" },
  { name: "CredentialRegistry", addr: CONTRACTS.credentialRegistry, desc: "KYC credentials" },
  { name: "CredentialConsumer", addr: CONTRACTS.credentialConsumer, desc: "CRE → ACE bridge" },
  { name: "ReportConsumer", addr: CONTRACTS.reportConsumer, desc: "Per-trade reports" },
  { name: "IntegratorRegistry", addr: CONTRACTS.integratorRegistry, desc: "Workspaces + roles" },
  { name: "EscrowSwap", addr: CONTRACTS.escrowSwap, desc: "USDC demo swap" },
];

const techStack = [
  { name: "Chainlink CRE", desc: "3 TypeScript workflows in TEE", icon: Cpu },
  { name: "Chainlink ACE", desc: "PolicyEngine + Credential registries", icon: Shield },
  { name: "Arc (Circle)", desc: "USDC-native institutional L1", icon: Globe },
  { name: "IPFS / Pinata", desc: "Content-addressed audit storage", icon: Database },
  { name: "Sumsub", desc: "KYC, sanctions, PEP screening", icon: Users },
  { name: "Chainalysis", desc: "Wallet risk + counterparty analysis", icon: Network },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-900">
      {/* Nav */}
      <nav className="border-b border-surface-700/50 bg-surface-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-accent-blue" />
            <span className="font-semibold">Open Compliance Layer</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#architecture" className="text-sm text-gray-400 hover:text-white transition-colors hidden md:block">Architecture</a>
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors hidden md:block">Features</a>
            <a href="#contracts" className="text-sm text-gray-400 hover:text-white transition-colors hidden md:block">Contracts</a>
            <Link to="/app" className="btn-primary text-sm flex items-center gap-1.5">
              Launch App <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent-blue/8 via-accent-purple/3 to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent-blue/5 blur-3xl" />
        <div className="max-w-5xl mx-auto px-6 pt-28 pb-24 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm mb-8">
            <Globe className="w-3.5 h-3.5" />
            Deployed on Arc Testnet (Circle) — ETHGlobal Cannes 2026
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight">
            Trustless Compliance
            <br />
            <span className="bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
              for Institutional DeFi
            </span>
          </h1>
          <p className="text-xl text-gray-400 mt-8 max-w-2xl mx-auto leading-relaxed">
            A shared compliance oracle on Chainlink CRE. Protocols read an on-chain
            attestation — like a price feed. Never touch PII, never run KYC
            infrastructure, never become a regulated entity.
          </p>
          <p className="text-lg text-gray-500 mt-3">
            One check per trade. One audit trail. Every party trusts it.
          </p>
          <div className="flex items-center justify-center gap-4 mt-10">
            <Link
              to="/app"
              className="bg-accent-blue hover:bg-accent-blue/80 text-white font-semibold px-8 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-accent-blue/20 flex items-center gap-2 text-lg"
            >
              Launch App <ArrowRight className="w-5 h-5" />
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface-800 hover:bg-surface-700 text-white font-medium px-8 py-3.5 rounded-xl transition-colors border border-surface-600 text-lg"
            >
              View Source
            </a>
          </div>

          {/* Stats bar */}
          <div className="flex items-center justify-center gap-8 mt-16 text-sm">
            {[
              { value: "7", label: "Contracts deployed" },
              { value: "3", label: "CRE Workflows" },
              { value: "9", label: "Compliance checks" },
              { value: "37", label: "Tests passing" },
              { value: "1 line", label: "Integration" },
            ].map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-gray-500 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-accent-red text-sm font-medium uppercase tracking-wider mb-3">The Problem</p>
          <h2 className="text-4xl font-bold">The Compliance Catch-22</h2>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto text-lg">
            DeFi protocols need KYC for institutional capital. But adding
            compliance infrastructure destroys the decentralization that exempts them from the heaviest regulations.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: XCircle,
              title: "Entity Crystallization",
              desc: "Adding KYC creates an identifiable operator. Under MiCA, that's a CASP — full licensing, compliance officer, capital requirements. The protocol becomes a regulated financial entity.",
              color: "border-accent-red/30 bg-accent-red/5",
              iconColor: "text-accent-red",
            },
            {
              icon: XCircle,
              title: "4x Cost Duplication",
              desc: "Every counterparty (LP, broker, custodian) independently runs the same checks on the same users. $1.3-4.4M/year in duplicated Sumsub + Chainalysis licenses alone.",
              color: "border-accent-red/30 bg-accent-red/5",
              iconColor: "text-accent-red",
            },
            {
              icon: CheckCircle2,
              title: "Our Solution",
              desc: "Protocols read an on-chain attestation — like a Chainlink price feed. Never touch PII, never run KYC infra, never become a CASP. Compliance checks run once, all parties trust it.",
              color: "border-accent-green/30 bg-accent-green/5",
              iconColor: "text-accent-green",
            },
          ].map(({ icon: Icon, title, desc, color, iconColor }) => (
            <div key={title} className={`rounded-xl border p-6 ${color}`}>
              <Icon className={`w-6 h-6 mb-4 ${iconColor}`} />
              <h3 className="font-semibold text-lg mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Price feed analogy */}
        <div className="mt-12 p-6 rounded-xl bg-surface-800/60 border border-surface-600/50 text-center">
          <p className="text-gray-400">
            <span className="text-white font-medium">Chainlink price feeds</span> made it so every DeFi protocol doesn't need its own oracle.{" "}
            <span className="text-accent-blue font-medium">Open Compliance Layer</span> does the same for regulatory compliance.
          </p>
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="bg-surface-800/40 border-y border-surface-700/50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-accent-purple text-sm font-medium uppercase tracking-wider mb-3">Architecture</p>
            <h2 className="text-4xl font-bold">How It Works</h2>
          </div>

          {/* Architecture diagram */}
          <div className="grid md:grid-cols-5 gap-3 items-start mb-16">
            {/* Step 1 */}
            <div className="card text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-accent-green/20 flex items-center justify-center mx-auto">
                <Users className="w-5 h-5 text-accent-green" />
              </div>
              <div className="font-medium text-sm">User KYC</div>
              <div className="text-xs text-gray-500">Sumsub SDK in frontend</div>
            </div>

            <div className="flex items-center justify-center pt-6">
              <ArrowRight className="w-5 h-5 text-gray-600" />
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border-2 border-accent-purple/30 bg-accent-purple/5 p-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-accent-purple/20 flex items-center justify-center mx-auto">
                <Lock className="w-5 h-5 text-accent-purple" />
              </div>
              <div className="font-medium text-sm">CRE Workflow</div>
              <div className="text-xs text-gray-500">TEE Enclave</div>
              <div className="flex gap-1 justify-center mt-2">
                <span className="text-[9px] bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded">Sumsub</span>
                <span className="text-[9px] bg-accent-blue/20 text-accent-blue px-1.5 py-0.5 rounded">Chainalysis</span>
              </div>
            </div>

            <div className="flex items-center justify-center pt-6">
              <ArrowRight className="w-5 h-5 text-gray-600" />
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border-2 border-accent-cyan/30 bg-accent-cyan/5 p-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-accent-cyan/20 flex items-center justify-center mx-auto">
                <Layers className="w-5 h-5 text-accent-cyan" />
              </div>
              <div className="font-medium text-sm">On-Chain</div>
              <div className="text-xs text-gray-500">Arc (Circle)</div>
              <div className="flex gap-1 justify-center mt-2">
                <span className="text-[9px] bg-accent-cyan/20 text-accent-cyan px-1.5 py-0.5 rounded">Credential</span>
                <span className="text-[9px] bg-accent-cyan/20 text-accent-cyan px-1.5 py-0.5 rounded">Report</span>
              </div>
            </div>
          </div>

          {/* 3 flows */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Identity Verification",
                subtitle: "Workflow A — HTTP Trigger",
                items: [
                  "Frontend triggers after Sumsub SDK completion",
                  "Confidential HTTP → Sumsub + Chainalysis in TEE",
                  "DON consensus across 21 nodes",
                  "Credential written to ACE IdentityRegistry",
                ],
                color: "border-accent-green/30",
                accent: "text-accent-green",
              },
              {
                step: "2",
                title: "Per-Trade Compliance",
                subtitle: "Workflow B — EVM Log Trigger",
                items: [
                  "Protocol emits ComplianceCheckRequested event",
                  "9 checks: KYC, sanctions, PEP, wallet risk ×2, jurisdiction, asset, structuring, Travel Rule",
                  "AuditRecord → IPFS (hash on-chain)",
                  "Auto-callback executes the trade",
                ],
                color: "border-accent-blue/30",
                accent: "text-accent-blue",
              },
              {
                step: "3",
                title: "Audit Data Access",
                subtitle: "Workflow C + IPFS",
                items: [
                  "Per-trade: fetch from IPFS by CID, verify hash",
                  "KYC/AML (PII): CRE Workflow C in TEE",
                  "Scoped by on-chain appId — broker sees their users, LP sees their trades",
                  "No backend, no database, no API keys",
                ],
                color: "border-accent-amber/30",
                accent: "text-accent-amber",
              },
            ].map(({ step, title, subtitle, items, color, accent }) => (
              <div key={step} className={`card border ${color} space-y-4`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center font-bold text-sm ${accent}`}>
                    {step}
                  </div>
                  <div>
                    <div className="font-semibold">{title}</div>
                    <div className="text-xs text-gray-500">{subtitle}</div>
                  </div>
                </div>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      <CheckCircle2 className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${accent}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integration patterns */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <p className="text-accent-blue text-sm font-medium uppercase tracking-wider mb-3">Integration</p>
          <h2 className="text-4xl font-bold">Three Lines of Code</h2>
          <p className="text-gray-400 mt-4 text-lg">Choose your integration depth. Same compliance guarantees.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              title: "Pattern 1: Simplest",
              badge: "1 line",
              badgeColor: "bg-accent-green/20 text-accent-green",
              desc: "Cached KYC credential check. Synchronous, same-transaction.",
              code: `require(\n  consumer.isVerified(msg.sender),\n  "Not compliant"\n);`,
              best: "Protocols that only need KYC gating",
            },
            {
              title: "Pattern 2: ACE Policy",
              badge: "modifier",
              badgeColor: "bg-accent-blue/20 text-accent-blue",
              desc: "ACE PolicyEngine validates both parties transparently.",
              code: `function trade(...)\n  external runPolicy\n{\n  // compliance is transparent\n}`,
              best: "Protocols using Chainlink ACE",
            },
            {
              title: "Pattern 3: Per-Trade",
              badge: "async",
              badgeColor: "bg-accent-purple/20 text-accent-purple",
              desc: "Full per-trade checks. CRE auto-callbacks to execute.",
              code: `function swap(...) external {\n  emit ComplianceCheckRequested(\n    tradeId, msg.sender,\n    counterparty, asset, amount\n  );\n}`,
              best: "Sanctions + counterparty + jurisdiction",
            },
          ].map(({ title, badge, badgeColor, desc, code, best }) => (
            <div key={title} className="card space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{title}</h3>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
              </div>
              <p className="text-sm text-gray-400">{desc}</p>
              <pre className="bg-surface-900 rounded-lg p-4 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">
                {code}
              </pre>
              <p className="text-xs text-gray-500">Best for: {best}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-surface-800/40 border-y border-surface-700/50 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-accent-cyan text-sm font-medium uppercase tracking-wider mb-3">Features</p>
            <h2 className="text-4xl font-bold">Why Open Compliance Layer</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className="card hover:border-surface-600/80 transition-all hover:-translate-y-0.5">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-4`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison: Without vs With */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold">Before vs After</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card border-accent-red/20 space-y-4">
            <div className="flex items-center gap-2 text-accent-red">
              <EyeOff className="w-5 h-5" />
              <h3 className="font-semibold">Without OCL</h3>
            </div>
            <ul className="space-y-3 text-sm text-gray-400">
              {[
                "Each party runs own KYC + sanctions + wallet screening",
                "4x provider licenses ($1.3-4.4M/yr across parties)",
                "Fragmented audit trails — regulator gets 4 partial views",
                "LP can't verify protocol actually ran the checks",
                "Adding KYC makes protocol a regulated CASP",
                "User gets KYC'd 4 times for one swap",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-accent-red/50 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="card border-accent-green/20 space-y-4">
            <div className="flex items-center gap-2 text-accent-green">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="font-semibold">With OCL</h3>
            </div>
            <ul className="space-y-3 text-sm text-gray-400">
              {[
                "One check per trade — shared across all parties",
                "One set of provider licenses (engine operator pays)",
                "Unified audit trail — same hash, same IPFS record for everyone",
                "DON-signed reports — 21 nodes agree, verifiable on-chain",
                "Protocol reads attestation — like a price feed, not a CASP",
                "User verified once — credential reused across all protocols",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent-green/50 mt-0.5 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Arc + Contracts */}
      <section id="contracts" className="bg-surface-800/40 border-y border-surface-700/50 py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16">
            {/* Arc */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-8 h-8 text-accent-purple" />
                <div>
                  <h2 className="text-2xl font-bold">Built for Arc</h2>
                  <p className="text-sm text-gray-500">Circle's institutional L1</p>
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Arc is purpose-built for institutional finance — USDC-native gas,
                Circle's full-stack platform, regulatory-first design. Open Compliance
                Layer is a foundational DeFi building block: any protocol on Arc gets
                compliance readiness out of the box.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-gray-400">
                {[
                  "USDC-native escrow swaps (natural primitive for Arc)",
                  "Credentials portable via CCIP (cross-chain)",
                  "CRE-supported (CLI v1.0.7+, TS SDK v1.3.1+)",
                  "KeystoneForwarder deployed and live",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent-purple/70 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Deployed contracts */}
            <div>
              <h3 className="font-semibold mb-4 text-gray-300">Deployed Contracts</h3>
              <div className="space-y-2">
                {allContracts.map(({ name, addr, desc }) => (
                  <div key={name} className="flex items-center justify-between p-3 rounded-lg bg-surface-700/30 border border-surface-600/30 hover:border-surface-600/60 transition-colors">
                    <div>
                      <span className="text-sm font-medium">{name}</span>
                      <span className="text-xs text-gray-500 ml-2">{desc}</span>
                    </div>
                    <a
                      href={`https://testnet.arcscan.app/address/${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-accent-blue hover:underline flex items-center gap-1 font-mono"
                    >
                      {addr.slice(0, 6)}..{addr.slice(-4)}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <h2 className="text-2xl font-bold text-center mb-10">Tech Stack</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {techStack.map(({ name, desc, icon: Icon }) => (
            <div key={name} className="flex items-center gap-3 p-4 rounded-xl bg-surface-800/60 border border-surface-700/50">
              <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">{name}</div>
                <div className="text-xs text-gray-500">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 bg-gradient-to-t from-accent-blue/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-6 text-center relative">
          <h2 className="text-4xl font-bold">
            Make your protocol compliant.
            <br />
            <span className="text-gray-400 text-3xl">Without becoming a regulated entity.</span>
          </h2>
          <p className="text-gray-500 mt-4 text-lg">
            One line of Solidity. Zero compliance infrastructure. Live on Arc Testnet.
          </p>
          <div className="flex items-center justify-center gap-4 mt-8">
            <Link
              to="/app"
              className="bg-accent-blue hover:bg-accent-blue/80 text-white font-semibold px-8 py-3.5 rounded-xl transition-all hover:shadow-lg hover:shadow-accent-blue/20 flex items-center gap-2 text-lg"
            >
              Launch App <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-700/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Built at ETHGlobal Cannes 2026</span>
          </div>
          <div className="flex items-center gap-6">
            <span>Chainlink CRE + ACE</span>
            <span>Arc (Circle)</span>
            <span>Sumsub + Chainalysis</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
