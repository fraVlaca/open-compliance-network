import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  ArrowRight,
  ArrowRightLeft,
  Lock,
  FileCheck,
  Code2,
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
  ShieldCheck,
  ShieldX,
  TrendingUp,
  BadgeCheck,
  ArrowDown,
  BarChart3,
  Target,
  MapPin,
} from "lucide-react";
import { CONTRACTS } from "../config/contracts";
import AnimateOnScroll from "../components/ui/AnimateOnScroll";

const allContracts = [
  { name: "PolicyEngine", addr: CONTRACTS.policyEngine },
  { name: "IdentityRegistry", addr: CONTRACTS.identityRegistry },
  { name: "CredentialRegistry", addr: CONTRACTS.credentialRegistry },
  { name: "CredentialConsumer", addr: CONTRACTS.credentialConsumer },
  { name: "ReportConsumer", addr: CONTRACTS.reportConsumer },
  { name: "IntegratorRegistry", addr: CONTRACTS.integratorRegistry },
  { name: "EscrowSwap", addr: CONTRACTS.escrowSwap },
];

export default function LandingPage() {
  const [activeSection, setActiveSection] = useState("");
  useEffect(() => {
    const sections = document.querySelectorAll("section[id]");
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) setActiveSection(e.target.id); }); },
      { threshold: 0.25 }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-surface-950 text-gray-100">
      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-surface-950/80 backdrop-blur-lg border-b border-surface-700/30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-accent-blue" />
            </div>
            <span className="font-semibold text-sm tracking-tight">OCL</span>
            <span className="text-[9px] font-mono text-accent-blue/70 bg-accent-blue/10 px-1.5 py-0.5 rounded border border-accent-blue/20">ARC TESTNET</span>
          </div>
          <div className="flex items-center gap-5">
            {[
              { href: "#transformation", id: "transformation", label: "Before & After" },
              { href: "#problem", id: "problem", label: "The Problem" },
              { href: "#how", id: "how", label: "How It Works" },
              { href: "#contracts", id: "contracts", label: "Contracts" },
            ].map(({ href, id, label }) => (
              <a key={id} href={href} className={`text-xs transition-colors hidden md:block ${activeSection === id ? "text-white" : "text-gray-500 hover:text-gray-300"}`}>{label}</a>
            ))}
            <Link to="/app" className="bg-accent-blue hover:bg-accent-blue/85 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-1.5">
              Launch App <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-14">
        {/* Background texture */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent-blue/[0.07] via-transparent to-transparent" />
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-accent-purple/[0.04] blur-[100px]" />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-800/80 border border-surface-600/40 text-xs text-gray-400 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" />
            Live on Arc Testnet · 7 contracts · 4 CRE workflows
          </div>

          <h1 className="text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[1.05] tracking-[-0.03em]">
            <span className="text-white">Every protocol on Arc.</span>
            <br />
            <span className="bg-gradient-to-r from-accent-blue via-accent-purple to-accent-cyan bg-clip-text text-transparent">
              Compliance-ready from day one.
            </span>
          </h1>

          <p className="text-base md:text-lg text-gray-300 mt-6 max-w-2xl mx-auto leading-relaxed">
            OCL is shared compliance infrastructure for Arc's economy. Any protocol integrates KYC, sanctions screening, and verifiable audit trails with one line of Solidity — no compliance team, no PII liability, no regulatory risk.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Link to="/app" className="group bg-white text-surface-900 font-semibold px-7 py-3 rounded-xl transition-all hover:shadow-xl hover:shadow-white/10 flex items-center gap-2 text-sm w-full sm:w-auto justify-center">
              Launch App <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white font-medium px-7 py-3 rounded-xl transition-colors text-sm w-full sm:w-auto text-center border border-surface-600/40 hover:border-surface-500/60">
              View Source
            </a>
          </div>

          {/* Stats strip — outcome metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px mt-16 rounded-xl overflow-hidden bg-surface-700/30 border border-surface-600/30 max-w-2xl mx-auto">
            {[
              { value: "$4.4M", label: "Annual savings per ecosystem" },
              { value: "9 checks", label: "Per trade, one execution" },
              { value: "0 PII", label: "Held by protocols" },
              { value: "21 nodes", label: "DON consensus" },
            ].map(({ value, label }) => (
              <div key={label} className="bg-surface-800/60 py-4 px-3 text-center">
                <div className="stat-value text-xl">{value}</div>
                <div className="stat-label mt-1">{label}</div>
              </div>
            ))}
          </div>

          <a href="#transformation" className="inline-flex items-center gap-1.5 mt-10 text-xs text-gray-500 hover:text-gray-300 transition-colors">
            <ArrowDown className="w-3 h-3" /> Scroll to learn more
          </a>
        </div>
      </section>

      {/* ── BEFORE & AFTER (moved up — first thing after hero) ── */}
      <section id="transformation" className="py-20 bg-surface-900/50 border-y border-surface-700/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="section-label mb-3">Before & After</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              One engine replaces{" "}
              <span className="text-accent-green">four compliance stacks</span>
            </h2>
            <p className="text-gray-400 mt-3 max-w-lg mx-auto text-sm leading-relaxed">
              Today, every counterparty in an institutional trade independently runs the same KYC, sanctions, and wallet screening — paying for it 4 times, generating 4 conflicting audit trails. OCL collapses this into a single verifiable execution.
            </p>
          </div>

          <AnimateOnScroll>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* Without */}
              <div className="rounded-xl bg-surface-800/60 border border-accent-red/15 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldX className="w-4 h-4 text-accent-red" />
                  <span className="font-semibold text-sm">Without OCL</span>
                  <span className="ml-auto text-[9px] font-mono text-accent-red/80 bg-accent-red/10 px-1.5 py-0.5 rounded">TODAY ON ARC</span>
                </div>
                <ul className="space-y-2">
                  {[
                    "Each party runs own KYC + sanctions + wallet screening",
                    "4× provider licenses ($1.3–4.4M/yr)",
                    "Fragmented audit trails — regulator gets 4 partial views",
                    "LP can't verify protocol actually ran checks",
                    "Adding KYC → CASP classification under MiCA",
                    "User gets KYC'd 4 times for one swap",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-300">
                      <XCircle className="w-3 h-3 text-accent-red/60 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {/* With */}
              <div className="rounded-xl bg-surface-800/60 border border-accent-green/15 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="w-4 h-4 text-accent-green" />
                  <span className="font-semibold text-sm">With OCL</span>
                  <span className="ml-auto text-[9px] font-mono text-accent-green/80 bg-accent-green/10 px-1.5 py-0.5 rounded">WITH OCL</span>
                </div>
                <ul className="space-y-2">
                  {[
                    "One check per trade — shared across all parties",
                    "One set of provider licenses (engine pays)",
                    "Unified audit trail — same hash, same IPFS record",
                    "DON-signed reports — 21 nodes agree, on-chain",
                    "Protocol reads attestation — not a CASP",
                    "User verified once — credential reused everywhere",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-300">
                      <CheckCircle2 className="w-3 h-3 text-accent-green/60 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Savings callout */}
          <div className="text-center mb-10">
            <p className="text-sm font-medium text-gray-300">
              Estimated ecosystem savings:{" "}
              <span className="text-accent-green font-bold">$1.3–4.4M/yr</span>{" "}
              per 4-party trading ecosystem
            </p>
          </div>

          {/* Who benefits */}
          <AnimateOnScroll>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden bg-surface-600/20">
              {[
                { icon: Building2, title: "For Protocols", desc: "Serve institutional counterparties without CASP classification risk. 1 line of Solidity.", color: "blue" },
                { icon: TrendingUp, title: "For LPs", desc: "Verify counterparty compliance on-chain. No Sumsub account. No Chainalysis license.", color: "green" },
                { icon: Users, title: "For Brokers", desc: "Onboard users once, credential reused across all Arc protocols. Eliminate redundant onboarding cost.", color: "purple" },
                { icon: FileCheck, title: "For Regulators", desc: "One complete, immutable compliance record per trade. MiCA Article 76 compliant record retention.", color: "amber" },
              ].map(({ icon: Icon, title, desc, color }) => (
                <div key={title} className="bg-surface-800/80 p-4">
                  <Icon className={`w-4 h-4 text-accent-${color} mb-2`} />
                  <div className="text-xs font-semibold text-white">{title}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{desc}</div>
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section id="problem" className="py-20 border-t border-surface-700/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-[1fr_1.5fr] gap-12 items-start">
            {/* Left: the regulatory dilemma story */}
            <div className="md:sticky md:top-24">
              <p className="section-label mb-3">The Dilemma</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Protocols want institutional capital.
                <br />
                <span className="text-accent-blue">Adding KYC destroys what makes them valuable.</span>
              </h2>
              <p className="text-gray-300 mt-4 text-sm leading-relaxed">
                Institutions need KYC to participate. But the moment a protocol adds KYC infrastructure — holding a Sumsub account, processing PII, making access decisions — it creates an identifiable operator entity.
              </p>
              <p className="text-gray-300 mt-2 text-sm leading-relaxed">
                Under MiCA (mandatory July 2026), that entity becomes a <span className="text-white font-medium">CASP</span> — a Crypto-Asset Service Provider requiring full licensing. The protocol loses its "fully decentralized" exemption.
              </p>

              <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-accent-red/10 to-accent-amber/5 border border-accent-red/20">
                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                  The result: 4 parties independently pay for the same compliance checks on the same trades. $1.3–4.4M/yr in duplicated provider licenses. 4 fragmented audit trails. Users KYC'd 4 times for one swap.
                </p>
              </div>
            </div>

            {/* Right: problem → solution cards */}
            <AnimateOnScroll>
              <div className="space-y-3">
                {[
                  {
                    icon: Building2, color: "blue",
                    title: "4× redundant compliance infrastructure",
                    desc: "Every protocol, LP, broker, and custodian independently pays for Sumsub, Chainalysis, and Notabene. Same users. Same trades. Same checks — run and paid for 4 times. OCL runs them once for the entire ecosystem.",
                  },
                  {
                    icon: ShieldCheck, color: "green",
                    title: "Entity crystallization → CASP classification",
                    desc: "The entity that runs KYC becomes the de facto operator in regulators' eyes — regardless of what the smart contracts say. Under MiCA, that entity needs licensing, compliance officers, capital reserves, annual audits. OCL keeps the protocol as a protocol.",
                  },
                  {
                    icon: Eye, color: "purple",
                    title: "No party can verify another's compliance",
                    desc: "An LP asks: did the protocol actually screen this wallet? With centralized backends, the answer is 'trust us.' With OCL: open-source code, on-chain pinned workflow IDs, DON consensus across 21 nodes. Verify, don't trust.",
                  },
                  {
                    icon: FileCheck, color: "amber",
                    title: "Regulators get 4 partial audit trails",
                    desc: "When a regulator audits a trade, they get 4 different records from 4 parties using 4 providers. None align perfectly. OCL produces one DON-signed audit record per trade — same hash, same IPFS record, same data for everyone.",
                  },
                  {
                    icon: BarChart3, color: "cyan",
                    title: "Protocols are blind to their own users",
                    desc: "DeFi protocols today have wallet addresses and nothing else — no demographics, no geography, no risk profiles. They can't segment users, can't plan expansion, can't pitch to institutions. KYC through OCL turns anonymous wallets into understood markets.",
                  },
                ].map(({ icon: Icon, color, title, desc }) => (
                  <div key={title} className="group p-4 rounded-xl bg-surface-800/50 border border-surface-600/30 hover:border-surface-500/40 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg bg-accent-${color}/10 border border-accent-${color}/20 flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 text-accent-${color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm text-white mb-1">{title}</h3>
                        <p className="text-xs text-gray-400 leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* ── WHAT PROTOCOLS UNLOCK ── */}
      <section className="py-20 bg-surface-900/50 border-y border-surface-700/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="section-label mb-3">Beyond Compliance</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Your users become your{" "}
              <span className="text-accent-cyan">market intelligence</span>
            </h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto text-sm leading-relaxed">
              KYC isn't just a regulatory checkbox. When your anonymous wallet addresses become verified users, you unlock the business intelligence that traditional fintech runs on — without ever touching PII.
            </p>
          </div>

          <AnimateOnScroll>
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* Left: the blind spot */}
              <div className="rounded-xl bg-surface-800/60 border border-surface-600/30 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <XCircle className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold text-sm text-gray-300">DeFi protocols today</span>
                  <span className="ml-auto text-[9px] font-mono text-gray-500 bg-surface-700/80 px-1.5 py-0.5 rounded">BLIND</span>
                </div>
                <ul className="space-y-2">
                  {[
                    "Wallet addresses — nothing else",
                    "No idea who users are or where they're from",
                    "Can't distinguish institutional from retail",
                    "Can't segment by risk, geography, or behavior",
                    "Can't pitch to institutions: \"we don't know our users\"",
                    "Zero data for expansion or product decisions",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-400">
                      <div className="w-1 h-1 rounded-full bg-gray-600 mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Right: what OCL unlocks */}
              <div className="rounded-xl bg-surface-800/60 border border-accent-cyan/15 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-4 h-4 text-accent-cyan" />
                  <span className="font-semibold text-sm">With OCL user intelligence</span>
                  <span className="ml-auto text-[9px] font-mono text-accent-cyan/80 bg-accent-cyan/10 px-1.5 py-0.5 rounded">UNLOCKED</span>
                </div>
                <ul className="space-y-2">
                  {[
                    "Demographics: geography, user type, risk profiles",
                    "Segment users by jurisdiction, risk tier, and category",
                    "Identify institutional counterparties entering the protocol",
                    "Track which markets drive volume — plan expansion with data",
                    "Pitch to institutions: \"X verified counterparties across Y jurisdictions\"",
                    "Generate compliance reports per region for regulators",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-gray-300">
                      <CheckCircle2 className="w-3 h-3 text-accent-cyan/60 mt-0.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden bg-surface-600/20">
              {[
                { icon: MapPin, title: "Geographic Intelligence", desc: "Understand which jurisdictions drive volume. Plan geographic expansion with real user data.", color: "cyan" },
                { icon: Target, title: "Risk Segmentation", desc: "Categorize users by compliance risk tier — geography, PEP status, wallet history, Chainalysis scores.", color: "amber" },
                { icon: TrendingUp, title: "Institutional Pipeline", desc: "Identify institutional-grade counterparties. Track institutional adoption across your protocol.", color: "green" },
                { icon: BarChart3, title: "Business Development", desc: "Data-driven product strategy. Expansion planning. Partnership intelligence. Regulatory reporting.", color: "blue" },
              ].map(({ icon: Icon, title, desc, color }) => (
                <div key={title} className="bg-surface-800/80 p-4">
                  <Icon className={`w-4 h-4 text-accent-${color} mb-2`} />
                  <div className="text-xs font-semibold text-white">{title}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 leading-snug">{desc}</div>
                </div>
              ))}
            </div>
          </AnimateOnScroll>

          {/* Privacy callout */}
          <div className="text-center mt-6">
            <p className="text-[11px] text-gray-500">
              <Lock className="w-3 h-3 inline mr-1 -mt-0.5" />
              Privacy-preserving: protocols receive structured risk scores and demographic segments via scoped audit workflows — never raw PII. Data stays in the TEE.
            </p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS (Architecture + Trust merged) ── */}
      <section id="how" className="py-20 bg-surface-900/50 border-y border-surface-700/30">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="section-label mb-3">How It Works</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Trade submitted. 9 checks. ~8 seconds.
              <br />
              <span className="text-accent-blue">Three CRE Workflows, verified by 21 nodes.</span>
            </h2>
            <p className="text-gray-400 mt-3 max-w-lg mx-auto text-sm leading-relaxed">
              OCL orchestrates Sumsub, Chainalysis, and Notabene inside a Trusted Execution Environment on Chainlink CRE. One execution, one result, one audit record.
            </p>
          </div>

          <AnimateOnScroll>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  step: "A", title: "Identity Verification",
                  outcome: "Verify once, reuse across all Arc protocols",
                  trigger: "HTTP Trigger",
                  icon: Users, borderColor: "border-accent-green/20", iconColor: "text-accent-green", dotColor: "bg-accent-green",
                  items: ["Sumsub + Chainalysis in TEE", "DON consensus across 21 nodes", "Credential → ACE IdentityRegistry"],
                  tags: ["Sumsub", "Chainalysis"],
                },
                {
                  step: "B", title: "Per-Trade Compliance",
                  outcome: "9 checks per trade, automatic callback to execute",
                  trigger: "EVM Log Trigger",
                  icon: Lock, borderColor: "border-accent-blue/20", iconColor: "text-accent-blue", dotColor: "bg-accent-blue",
                  items: ["9 checks: KYC, sanctions, PEP, wallet risk, jurisdiction, Travel Rule", "Audit record → IPFS (hash on-chain)", "Auto-callback executes the trade"],
                  tags: ["9 checks", "auto-callback"],
                },
                {
                  step: "C", title: "Audit Data Access",
                  outcome: "Fetch any trade's compliance record, verify against on-chain hash",
                  trigger: "Confidential HTTP",
                  icon: Eye, borderColor: "border-accent-amber/20", iconColor: "text-accent-amber", dotColor: "bg-accent-amber",
                  items: ["IPFS fetch by CID, keccak256 verified", "KYC/AML data scoped by appId", "No backend, no database, no API keys"],
                  tags: ["IPFS", "hash-verified"],
                },
              ].map(({ step, title, outcome, trigger, icon: Icon, borderColor, iconColor, dotColor, items, tags }) => (
                <div key={step} className={`rounded-xl border ${borderColor} bg-surface-800/40 p-5 space-y-4`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center">
                        <Icon className={`w-4 h-4 ${iconColor}`} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{title}</div>
                        <div className="text-[10px] text-gray-500 font-mono">{trigger}</div>
                      </div>
                    </div>
                    <span className={`w-6 h-6 rounded-md bg-surface-700 flex items-center justify-center text-[10px] font-bold font-mono ${iconColor}`}>{step}</span>
                  </div>
                  <p className="text-[11px] text-accent-blue/80 font-medium">{outcome}</p>
                  <ul className="space-y-1.5">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-gray-300">
                        <div className={`w-1 h-1 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-1.5">
                    {tags.map((tag) => (
                      <span key={tag} className="text-[9px] font-mono text-gray-400 bg-surface-700/80 px-2 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </AnimateOnScroll>

          {/* Trust properties — compact sub-grid */}
          <AnimateOnScroll>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
              {[
                { icon: Code2, title: "Any party can audit the rules", desc: "WorkflowId = hash of binary. Pinned on-chain. Anyone compiles the code and verifies." },
                { icon: BadgeCheck, title: "No operator can alter outcomes", desc: "Structural self-binding. Can't change rules silently or selectively approve trades." },
                { icon: FileCheck, title: "One record, one hash, one truth", desc: "DON-signed audit record on IPFS. keccak256 on-chain. Same data for all parties." },
                { icon: Lock, title: "Credentials never leave the enclave", desc: "API keys threshold-encrypted in Vault DON. Decrypted only inside the TEE." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="p-3.5 rounded-xl bg-surface-800/30 border border-surface-600/20">
                  <Icon className="w-3.5 h-3.5 text-gray-400 mb-2" />
                  <h3 className="font-semibold text-[11px] text-white mb-1">{title}</h3>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── INTEGRATION ── */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="section-label mb-3">Integration</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">One line of Solidity. Zero compliance infrastructure.</h2>
          </div>

          <AnimateOnScroll>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { title: "Simplest", badge: "1 line", color: "green", code: `require(\n  consumer.isVerified(msg.sender),\n  "Not compliant"\n);`, best: "KYC gating" },
                { title: "ACE Policy", badge: "modifier", color: "blue", code: `function trade(...)\n  external runPolicy\n{\n  // compliance is transparent\n}`, best: "Chainlink ACE" },
                { title: "Per-Trade", badge: "async", color: "purple", code: `function swap(...) external {\n  emit ComplianceCheckRequested(\n    tradeId, msg.sender,\n    counterparty, asset, amount\n  );\n}`, best: "Full compliance" },
              ].map(({ title, badge, color, code, best }) => (
                <div key={title} className="rounded-xl bg-surface-800/40 border border-surface-600/20 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm text-white">{title}</h3>
                    <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-accent-${color}/15 text-accent-${color} border border-accent-${color}/20`}>{badge}</span>
                  </div>
                  <pre className="bg-surface-950 rounded-lg p-3 text-[11px] font-mono text-gray-300 overflow-x-auto leading-relaxed border border-surface-700/40">{code}</pre>
                  <p className="text-[10px] text-gray-500 font-mono">→ {best}</p>
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* ── CONTRACTS ── */}
      <section id="contracts" className="py-20 bg-surface-900/50 border-y border-surface-700/30">
        <div className="max-w-5xl mx-auto px-6">
          <AnimateOnScroll>
            <div className="grid md:grid-cols-2 gap-10">
              <div>
                <p className="section-label mb-3">Deployed</p>
                <h2 className="text-xl font-bold mb-4">Arc Testnet Contracts</h2>
                <div className="space-y-1">
                  {allContracts.map(({ name, addr }) => (
                    <a key={name} href={`https://testnet.arcscan.app/address/${addr}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface-800/60 transition-colors group">
                      <span className="text-xs font-medium text-gray-300">{name}</span>
                      <span className="mono-data group-hover:text-accent-blue transition-colors flex items-center gap-1">
                        {addr.slice(0, 6)}···{addr.slice(-4)}
                        <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </a>
                  ))}
                </div>
              </div>
              <div>
                <p className="section-label mb-3">Built With</p>
                <h2 className="text-xl font-bold mb-4">Tech Stack</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { name: "Chainlink CRE", desc: "4 workflows in TEE", icon: Cpu },
                    { name: "Chainlink ACE", desc: "PolicyEngine + registries", icon: Shield },
                    { name: "Arc (Circle)", desc: "USDC-native L1", icon: Globe },
                    { name: "IPFS / Pinata", desc: "Audit storage", icon: Database },
                    { name: "Sumsub", desc: "KYC + sanctions", icon: Users },
                    { name: "Chainalysis", desc: "Wallet risk", icon: Network },
                    { name: "Notabene", desc: "Travel Rule messaging", icon: ArrowRightLeft },
                  ].map(({ name, desc, icon: Icon }) => (
                    <div key={name} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-surface-800/40 border border-surface-600/20">
                      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-medium text-gray-200">{name}</div>
                        <div className="text-[10px] text-gray-500">{desc}</div>
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
      <section className="py-20 relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-accent-blue/[0.05] via-transparent to-transparent" />
        <div className="max-w-3xl mx-auto px-6 text-center relative">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            The first compliance-ready chain.
            <br />
            <span className="text-gray-400">Built on Arc. Powered by Chainlink CRE.</span>
          </h2>
          <p className="text-gray-400 mt-3 text-sm">
            One shared compliance layer for every protocol, every LP, every broker on Arc. Verify once. Trade everywhere. Audit anything.
          </p>
          <Link to="/app" className="inline-flex items-center gap-2 bg-white text-surface-900 font-semibold px-7 py-3 rounded-xl transition-all hover:shadow-xl hover:shadow-white/10 text-sm mt-8">
            Launch App <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-surface-700/30 py-6">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-[11px] text-gray-500">
          <div className="flex items-center gap-2">
            <Shield className="w-3 h-3 text-accent-blue/50" />
            <span>Open Compliance Layer · ETHGlobal Cannes 2026</span>
          </div>
          <div className="flex items-center gap-4 font-mono">
            <span>CRE + ACE</span>
            <span>Arc</span>
            <span>Sumsub</span>
            <span>Chainalysis</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
