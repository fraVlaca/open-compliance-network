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

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-surface-900">
      {/* Header */}
      <header className="border-b border-surface-600 bg-surface-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <NavLink to="/" className="flex items-center gap-2">
              <Shield className="w-7 h-7 text-accent-blue" />
              <span className="text-lg font-semibold">OCL</span>
            </NavLink>
            <span className="text-[10px] bg-accent-amber/20 text-accent-amber px-2 py-0.5 rounded-full">
              Arc Testnet
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/app"}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-accent-blue/20 text-accent-blue"
                      : "text-gray-400 hover:text-white hover:bg-surface-700"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Desktop wallet */}
            <div className="hidden md:block">
              <ConnectButton
                showBalance={true}
                chainStatus="icon"
                accountStatus="address"
              />
            </div>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-surface-700 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu panel */}
        {mobileOpen && (
          <div className="md:hidden border-t border-surface-600 bg-surface-800 px-4 py-3 space-y-1 animate-fade-in">
            {navItems.map(({ path, icon: Icon, label }) => (
              <NavLink
                key={path}
                to={path}
                end={path === "/app"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-accent-blue/20 text-accent-blue"
                      : "text-gray-400 hover:text-white hover:bg-surface-700"
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
            <div className="pt-2 border-t border-surface-700">
              <ConnectButton
                showBalance={false}
                chainStatus="icon"
                accountStatus="address"
              />
            </div>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-24 gap-8">
            {/* Glowing shield */}
            <div className="relative">
              <div className="absolute inset-0 w-24 h-24 -translate-x-2 -translate-y-2 rounded-full bg-accent-blue/10 blur-2xl animate-pulse-glow" />
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 border border-accent-blue/30 flex items-center justify-center">
                <Shield className="w-10 h-10 text-accent-blue" />
              </div>
            </div>
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold text-white">
                Connect your wallet to get started
              </h2>
              <p className="text-gray-400 max-w-md mx-auto">
                Connect to Arc Testnet to interact with the compliance engine
                demo.
              </p>
            </div>
            <ConnectButton />
            {/* Feature hints */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 max-w-2xl w-full">
              {[
                {
                  icon: ArrowRightLeft,
                  label: "Trade",
                  desc: "USDC escrow swaps with compliance gating",
                },
                {
                  icon: Users,
                  label: "Verify",
                  desc: "KYC via Sumsub, credential on-chain",
                },
                {
                  icon: TrendingUp,
                  label: "Audit",
                  desc: "Per-trade reports on IPFS, hash-verified",
                },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="card-glass text-center p-4">
                  <Icon className="w-5 h-5 text-accent-blue mx-auto mb-2" />
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-gray-500 mt-1">{desc}</div>
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
