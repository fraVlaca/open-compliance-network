import { useState, useEffect } from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import {
  Shield,
  ArrowRightLeft,
  Building2,
  Users,
  TrendingUp,
  Menu,
  X,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import LandingPage from "./pages/LandingPage";
import TradePage from "./pages/TradePage";
import ProtocolPage from "./pages/ProtocolPage";
import IntegratorPage from "./pages/IntegratorPage";
import LPPage from "./pages/LPPage";

const navItems = [
  { path: "/app", icon: ArrowRightLeft, label: "Trade" },
  { path: "/app/protocol", icon: Building2, label: "Protocol" },
  { path: "/app/integrator", icon: Users, label: "Integrator" },
  { path: "/app/lp", icon: TrendingUp, label: "LP" },
];

function AppLayout() {
  const { isConnected } = useAccount();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-surface-950">
      {/* Header */}
      <header className="border-b border-surface-700/30 bg-surface-950/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NavLink to="/" className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent-blue/15 border border-accent-blue/30 flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-accent-blue" />
              </div>
              <span className="text-sm font-semibold tracking-tight">OCL</span>
            </NavLink>
            <span className="text-[9px] font-mono text-accent-green/70 bg-accent-green/10 px-1.5 py-0.5 rounded border border-accent-green/15">
              TESTNET
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5 bg-surface-800/50 rounded-lg p-0.5 border border-surface-600/20">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/app"}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all ${
                    isActive
                      ? "bg-surface-700 text-white shadow-sm"
                      : "text-gray-400 hover:text-gray-200"
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <ConnectButton showBalance={true} chainStatus="icon" accountStatus="address" />
            </div>
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700/50 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-surface-700/30 bg-surface-900 px-4 py-3 space-y-1 animate-fade-in">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/app"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive ? "bg-surface-800 text-white" : "text-gray-400 hover:text-white"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            <div className="pt-2 border-t border-surface-700/30">
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
            </div>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            {/* Branded empty state */}
            <div className="relative">
              <div className="absolute inset-0 w-20 h-20 rounded-full bg-accent-blue/10 blur-xl animate-pulse-glow -translate-x-1 -translate-y-1" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 border border-accent-blue/20 flex items-center justify-center">
                <Shield className="w-8 h-8 text-accent-blue" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Connect wallet to continue</h2>
              <p className="text-gray-400 text-sm max-w-sm">
                Connect to Arc Testnet to interact with the compliance engine.
              </p>
            </div>
            <ConnectButton />
            {/* Feature preview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 max-w-xl w-full">
              {[
                { icon: ArrowRightLeft, label: "Trade", desc: "USDC escrow swaps with compliance gating" },
                { icon: ShieldCheck, label: "Verify", desc: "KYC via Sumsub → credential on-chain" },
                { icon: FileCheck, label: "Audit", desc: "Per-trade reports on IPFS, hash-verified" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="rounded-xl bg-surface-800/40 border border-surface-600/20 p-4 text-center">
                  <Icon className="w-4 h-4 text-accent-blue mx-auto mb-2" />
                  <div className="text-xs font-semibold text-white">{label}</div>
                  <div className="text-[10px] text-gray-500 mt-1 leading-snug">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Routes>
            <Route index element={<TradePage />} />
            <Route path="protocol" element={<ProtocolPage />} />
            <Route path="integrator" element={<IntegratorPage />} />
            <Route path="lp" element={<LPPage />} />
          </Routes>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app/*" element={<AppLayout />} />
    </Routes>
  );
}
