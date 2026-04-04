import { useState, useEffect, useRef } from "react";
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
  Database,
  Cpu,
  Eye,
  Network,
  Layers,
  ShieldCheck,
  ShieldX,
  ArrowRightLeft,
  TrendingUp,
  Scale,
  BadgeCheck,
} from "lucide-react";
import { CONTRACTS } from "../config/contracts";
import AnimateOnScroll from "../components/ui/AnimateOnScroll";

const allContracts = [
  { name: "PolicyEngine", addr: CONTRACTS.policyEngine, desc: "ACE orchestrator" },
  { name: "IdentityRegistry", addr: CONTRACTS.identityRegistry, desc: "Wallet → CCID" },
  { name: "CredentialRegistry", addr: CONTRACTS.credentialRegistry, desc: "KYC credentials" },
  { name: "CredentialConsumer", addr: CONTRACTS.credentialConsumer, desc: "CRE → ACE bridge" },
  { name: "ReportConsumer", addr: CONTRACTS.reportConsumer, desc: "Per-trade reports" },
  { name: "IntegratorRegistry", addr: CONTRACTS.integratorRegistry, desc: "Workspaces + roles" },
  { name: "EscrowSwap", addr: CONTRACTS.escrowSwap, desc: "USDC demo swap" },
];

function AnimatedStat({ value, label }: { value: string; label: string }) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={`text-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`}>
      <div className="text-2xl md:text-3xl font-bold text-white">{value}</div>
      <div className="text-gray-400 text-[10px] mt-1 uppercase tracking-widest">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState("");
  useEffect(() => {
    const sections = document.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting) setActiveSection(entry.target.id); }); },
      { threshold: 0.3 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-surface-900">
      {/* ── NAV ── */}
      <nav className="border-b border-surface-700/50 bg-surface-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-accent-blue" />
            <span className="font-semibold text-white text-sm">Open Compliance Layer</span>
          </div>
          <div className="flex items-center gap-5">
            {[
              { href: "#problem", id: "problem", label: "Problem" },
              { href: "#solution", id: "solution", label: "Solution" },
              { href: "#how", id: "how", label: "How it Works" },
              { href: "#contracts", id: "contracts", label: "Contracts" },
            ].map(({ href, id, label }) => (
              <a key={id} href={href} className={`text-xs transition-colors hidden md:block ${activeSection === id ? "text-white font-medium" : "text-gray-400 hover:text-white"}`}>{label}</a>
            ))}
            <Link to="/app" className="bg-accent-blue hover:bg-accent-blue/80 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-1.5">
              Launch App <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent-blue/10 via-accent-purple/5 to-transparent" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-accent-blue/8 blur-[100px]" />
        <div className="absolute top-32 left-1/3 w-[300px] h-[300px] rounded-full bg-accent-purple/6 blur-[80px] animate-pulse-glow" />

        <div className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs mb-6">
            <Globe className="w-3 h-3" />
            Live on Arc Testnet (Circle) — ETHGlobal Cannes 2026
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] tracking-tight">
            Make your protocol compliant.
            <br />
            <span className="bg-gradient-to-r from-accent-blue to-accent-purple bg-clip-text text-transparent">
              Without becoming a regulated entity.
            </span>
          </h1>

          <p className="text-base md:text-lg text-gray-200 mt-6 max-w-2xl mx-auto leading-relaxed">
            Protocols read an on-chain compliance attestation — like a Chainlink price feed.
            Never touch PII. Never run KYC infrastructure. Never trigger CASP classification.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Link to="/app" className="bg-accent-blue hover:bg-accent-blue/80 text-white font-semibold px-7 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-accent-blue/25 flex items-center gap-2 text-base w-full sm:w-auto justify-center">
              Launch App <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="bg-surface-800 hover:bg-surface-700 text-white font-medium px-7 py-3 rounded-xl transition-colors border border-surface-600 text-base w-full sm:w-auto text-center">
              View Source
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-0 mt-12 py-5 px-4 md:px-6 rounded-2xl bg-surface-800/60 border border-surface-700/50 max-w-2xl mx-auto">
            {[
              { value: "$4.4M", label: "Saved per year" },
              { value: "4→1", label: "License reduction" },
              { value: "9", label: "Compliance checks" },
              { value: "21", label: "DON nodes" },
            ].map(({ value, label }, i) => (
              <div key={label} className={`${i > 0 ? "md:border-l md:border-surface-600/50" : ""} md:px-4`}>
                <AnimatedStat value={value} label={label} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <section id="problem" className="bg-surface-800/50 py-16 border-y border-surface-700/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-accent-red text-xs font-semibold uppercase tracking-widest mb-2">The Problem</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">The Compliance Catch-22</h2>
            <p className="text-gray-200 mt-3 max-w-xl mx-auto leading-relaxed">
              Protocols need compliance for institutions, but adding KYC destroys decentralization — and triggers CASP classification.
            </p>
          </div>

          <AnimateOnScroll>
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                { icon: ShieldX, title: "Entity Crystallization", desc: "Adding KYC means holding Sumsub accounts, processing PII, making access decisions. That entity becomes a CASP under MiCA — full licensing required.", color: "red" },
                { icon: Scale, title: "Regulatory Escalator", desc: "KYC is never just KYC. It triggers monitoring → Travel Rule → SAR filing → compliance officer → capital reserves → annual audits.", color: "red" },
                { icon: ArrowRightLeft, title: "4x Cost Duplication", desc: "Every counterparty independently runs the same checks on the same users. Same trade, 4x compliance, $1.3-4.4M/yr in duplicated licenses.", color: "amber" },
              ].map(({ icon: Icon, title, desc, color }) => (
                <div key={title} className={`rounded-xl border border-accent-${color}/20 bg-accent-${color}/5 p-5`}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <Icon className={`w-5 h-5 text-accent-${color}`} />
                    <h3 className="font-semibold text-sm text-white">{title}</h3>
                  </div>
                  <p className="text-xs text-gray-200 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </AnimateOnScroll>

          <div className="p-4 rounded-xl bg-surface-900/60 border border-surface-600/30 text-center">
            <p className="text-gray-200 text-sm">
              Most protocols choose <strong className="text-white">not to add KYC at all</strong> — forgoing institutional capital.
              Institutions stay out. <span className="text-accent-amber font-semibold">Everyone loses.</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── SOLUTION ── */}
      <section id="solution" className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-accent-green text-xs font-semibold uppercase tracking-widest mb-2">The Solution</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Read compliance like a price feed</h2>
            <p className="text-gray-200 mt-3 max-w-xl mx-auto leading-relaxed">
              Chainlink price feeds meant protocols don't need their own oracle.
              We do the same for regulatory compliance.
            </p>
          </div>

          <AnimateOnScroll>
            <div className="grid md:grid-cols-2 gap-5 mb-10">
              <div className="rounded-xl border border-accent-red/20 bg-surface-800 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldX className="w-5 h-5 text-accent-red" />
                  <h3 className="font-bold text-white">Without OCL</h3>
                </div>
                <ul className="space-y-2.5">
                  {[
                    "Each party runs own KYC + sanctions + wallet screening",
                    "4x provider licenses ($1.3-4.4M/yr across parties)",
                    "Fragmented audit trails — regulator gets 4 partial views",
                    "LP can't verify protocol actually ran the checks",
                    "Adding KYC makes protocol a regulated CASP",
                    "User gets KYC'd 4 times for one swap",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-200">
                      <XCircle className="w-3.5 h-3.5 text-accent-red mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-accent-green/20 bg-surface-800 p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-accent-green" />
                  <h3 className="font-bold text-white">With OCL</h3>
                </div>
                <ul className="space-y-2.5">
                  {[
                    "One check per trade — shared across all parties",
                    "One set of provider licenses (engine operator pays)",
                    "Unified audit trail — same hash, same IPFS record",
                    "DON-signed reports — 21 nodes agree, verifiable on-chain",
                    "Protocol reads attestation — like a price feed, not a CASP",
                    "User verified once — credential reused across protocols",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-200">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent-green mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Stakeholders */}
          <AnimateOnScroll>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Building2, title: "Protocols", desc: "1 line of Solidity. No backend, no compliance team, no CASP risk.", color: "text-accent-blue", bg: "bg-accent-blue/10" },
                { icon: TrendingUp, title: "LPs", desc: "Verify counterparty compliance on-chain. No Sumsub accounts needed.", color: "text-accent-green", bg: "bg-accent-green/10" },
                { icon: Users, title: "Brokers", desc: "Plug into shared compliance. KYC/AML data scoped by on-chain appId.", color: "text-accent-purple", bg: "bg-accent-purple/10" },
                { icon: FileCheck, title: "Regulators", desc: "One complete audit record per trade. All provider data combined.", color: "text-accent-amber", bg: "bg-accent-amber/10" },
              ].map(({ icon: Icon, title, desc, color, bg }) => (
                <div key={title} className="rounded-xl bg-surface-800 border border-surface-700/50 p-4">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
                  <p className="text-[11px] text-gray-300 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="bg-surface-800/50 py-16 border-y border-surface-700/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-accent-purple text-xs font-semibold uppercase tracking-widest mb-2">Architecture</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">How It Works</h2>
            <p className="text-gray-200 mt-3 max-w-xl mx-auto leading-relaxed">
              We orchestrate Sumsub, Chainalysis, and Notabene inside a Trusted Execution Environment on Chainlink CRE.
            </p>
          </div>

          <AnimateOnScroll>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  step: "1", title: "Identity Verification", subtitle: "CRE Workflow A · HTTP Trigger",
                  icon: Users, iconColor: "text-accent-green", borderColor: "border-accent-green/30",
                  items: ["Sumsub + Chainalysis execute in TEE", "DON consensus across 21 nodes", "KYC credential → ACE IdentityRegistry"],
                  tags: [{ label: "Sumsub", color: "bg-accent-green/20 text-accent-green" }, { label: "Chainalysis", color: "bg-accent-blue/20 text-accent-blue" }],
                },
                {
                  step: "2", title: "Per-Trade Compliance", subtitle: "CRE Workflow B · EVM Log Trigger",
                  icon: Lock, iconColor: "text-accent-blue", borderColor: "border-accent-blue/30",
                  items: ["9 checks: KYC, sanctions, PEP, wallet risk, jurisdiction, Travel Rule", "Audit record → IPFS (hash on-chain)", "Auto-callback executes the trade"],
                  tags: [{ label: "9 checks", color: "bg-accent-blue/20 text-accent-blue" }, { label: "auto-callback", color: "bg-accent-purple/20 text-accent-purple" }],
                },
                {
                  step: "3", title: "Audit Data Access", subtitle: "CRE Workflow C · Confidential HTTP",
                  icon: Eye, iconColor: "text-accent-amber", borderColor: "border-accent-amber/30",
                  items: ["IPFS fetch by CID, keccak256 hash-verified", "KYC/AML data scoped by on-chain appId", "No backend, no database, no API keys"],
                  tags: [{ label: "IPFS", color: "bg-accent-amber/20 text-accent-amber" }, { label: "hash-verified", color: "bg-accent-cyan/20 text-accent-cyan" }],
                },
              ].map(({ step, title, subtitle, icon: Icon, iconColor, borderColor, items, tags }) => (
                <div key={step} className={`rounded-xl border ${borderColor} bg-surface-900/50 p-5 space-y-4`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center`}>
                      <Icon className={`w-4 h-4 ${iconColor}`} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-white">{title}</div>
                      <div className="text-[10px] text-gray-400">{subtitle}</div>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-gray-200">
                        <CheckCircle2 className={`w-3 h-3 mt-0.5 flex-shrink-0 ${iconColor}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-1.5 flex-wrap">
                    {tags.map(({ label, color }) => (
                      <span key={label} className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${color}`}>{label}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── TRUST + FEATURES ── */}
      <section className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-accent-cyan text-xs font-semibold uppercase tracking-widest mb-2">Trust Model</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Why this can't be faked</h2>
            <p className="text-gray-200 mt-3 max-w-xl mx-auto leading-relaxed">
              Self-binding design — the operator physically cannot cheat. Centralized backends can never make this claim.
            </p>
          </div>

          <AnimateOnScroll>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { icon: Code2, title: "Open-Source Rules", desc: "WorkflowId = hash of binary. Anyone can read what checks run and verify nothing changed.", color: "text-accent-blue", bg: "bg-accent-blue/10" },
                { icon: Lock, title: "Credentials in TEE", desc: "API keys in Chainlink's Vault DON. Threshold-encrypted across 21 nodes. Nobody has the keys.", color: "text-accent-purple", bg: "bg-accent-purple/10" },
                { icon: BadgeCheck, title: "Self-Binding", desc: "Can't change rules silently. Can't selectively approve. Can't treat integrators differently. All on-chain.", color: "text-accent-green", bg: "bg-accent-green/10" },
                { icon: Eye, title: "Verifiable Execution", desc: "Source code → binary → workflowId on-chain → DON consensus → signed report. Every step auditable.", color: "text-accent-amber", bg: "bg-accent-amber/10" },
                { icon: FileCheck, title: "Unified Audit Trail", desc: "On-chain hash + IPFS per trade. keccak256 integrity. All parties see the same immutable record.", color: "text-accent-cyan", bg: "bg-accent-cyan/10" },
                { icon: Zap, title: "Auto-Callback Trades", desc: "User calls swap() once. 9 checks, DON consensus, auto-callback. Single-TX UX, full compliance.", color: "text-accent-red", bg: "bg-accent-red/10" },
              ].map(({ icon: Icon, title, desc, color, bg }) => (
                <div key={title} className="rounded-xl bg-surface-800 border border-surface-700/50 p-5 hover:border-surface-600 transition-colors">
                  <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <h3 className="font-semibold text-sm text-white mb-1.5">{title}</h3>
                  <p className="text-xs text-gray-300 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── INTEGRATION ── */}
      <section className="bg-surface-800/50 py-16 border-y border-surface-700/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-accent-blue text-xs font-semibold uppercase tracking-widest mb-2">Integration</p>
            <h2 className="text-2xl md:text-3xl font-bold text-white">One line of Solidity</h2>
          </div>

          <AnimateOnScroll>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: "Simplest", badge: "1 line", badgeColor: "bg-accent-green text-white", desc: "Cached KYC check. Synchronous.", code: `require(\n  consumer.isVerified(msg.sender),\n  "Not compliant"\n);`, best: "KYC gating" },
                { title: "ACE Policy", badge: "modifier", badgeColor: "bg-accent-blue text-white", desc: "PolicyEngine validates both parties.", code: `function trade(...)\n  external runPolicy\n{\n  // compliance is transparent\n}`, best: "Chainlink ACE" },
                { title: "Per-Trade", badge: "async", badgeColor: "bg-accent-purple text-white", desc: "Full checks. Auto-callback.", code: `function swap(...) external {\n  emit ComplianceCheckRequested(\n    tradeId, msg.sender,\n    counterparty, asset, amount\n  );\n}`, best: "Full compliance" },
              ].map(({ title, badge, badgeColor, desc, code, best }) => (
                <div key={title} className="rounded-xl bg-surface-900/50 border border-surface-700/50 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-white">{title}</h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>{badge}</span>
                  </div>
                  <p className="text-xs text-gray-300">{desc}</p>
                  <pre className="bg-surface-900 rounded-lg p-3 text-[11px] font-mono text-gray-200 overflow-x-auto leading-relaxed border border-surface-700/50">{code}</pre>
                  <p className="text-[10px] text-gray-400">Best for: {best}</p>
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── CONTRACTS + TECH ── */}
      <section id="contracts" className="py-16">
        <div className="max-w-5xl mx-auto px-6">
          <AnimateOnScroll>
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h2 className="text-xl font-bold text-white mb-4">Deployed on Arc Testnet</h2>
                <div className="space-y-1.5">
                  {allContracts.map(({ name, addr, desc }) => (
                    <div key={name} className="flex items-center justify-between p-2.5 rounded-lg bg-surface-800/60 border border-surface-700/40 hover:border-surface-600/80 transition-colors">
                      <div>
                        <span className="text-xs font-medium text-white">{name}</span>
                        <span className="text-[10px] text-gray-400 ml-1.5">{desc}</span>
                      </div>
                      <a href={`https://testnet.arcscan.app/address/${addr}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-accent-blue hover:underline flex items-center gap-1 font-mono">
                        {addr.slice(0, 6)}..{addr.slice(-4)}
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-4">Tech Stack</h2>
                <div className="space-y-1.5">
                  {[
                    { name: "Chainlink CRE", desc: "3 TypeScript workflows in TEE", icon: Cpu },
                    { name: "Chainlink ACE", desc: "PolicyEngine + Credential registries", icon: Shield },
                    { name: "Arc (Circle)", desc: "USDC-native institutional L1", icon: Globe },
                    { name: "IPFS / Pinata", desc: "Content-addressed audit storage", icon: Database },
                    { name: "Sumsub", desc: "KYC, sanctions, PEP screening", icon: Users },
                    { name: "Chainalysis", desc: "Wallet risk + counterparty analysis", icon: Network },
                  ].map(({ name, desc, icon: Icon }) => (
                    <div key={name} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-800/60 border border-surface-700/40 hover:border-surface-600/80 transition-colors">
                      <Icon className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      <div>
                        <span className="text-xs font-medium text-white">{name}</span>
                        <span className="text-[10px] text-gray-400 ml-1.5">{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden py-16 border-t border-surface-700/30">
        <div className="absolute inset-0 bg-gradient-to-t from-accent-blue/5 via-transparent to-transparent" />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Compliance without compromise.
          </h2>
          <p className="text-gray-300 mt-2 text-base">
            One line of Solidity. Zero compliance infrastructure. Live on Arc Testnet.
          </p>
          <Link to="/app" className="inline-flex items-center gap-2 bg-accent-blue hover:bg-accent-blue/80 text-white font-semibold px-7 py-3 rounded-xl transition-all hover:shadow-lg hover:shadow-accent-blue/25 text-base mt-6">
            Launch App <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-surface-700/30 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-accent-blue" />
            <span>Open Compliance Layer · ETHGlobal Cannes 2026</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Chainlink CRE + ACE</span>
            <span>Arc (Circle)</span>
            <span>Sumsub + Chainalysis</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
