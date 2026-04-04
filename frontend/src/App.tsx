import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import {
  Shield,
  ArrowRightLeft,
  Building2,
  Users,
  TrendingUp,
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

          <nav className="flex items-center gap-1">
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

          <ConnectButton
            showBalance={true}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <Shield className="w-16 h-16 text-accent-blue/50" />
            <h2 className="text-2xl font-semibold text-gray-300">
              Connect your wallet to get started
            </h2>
            <p className="text-gray-500 max-w-md text-center">
              Connect to Arc Testnet to interact with the compliance engine
              demo.
            </p>
            <ConnectButton />
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
