import { type Address } from "viem";
import { resolve } from "path";
import { homedir } from "os";

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
export const PORT = Number(process.env.PORT || 3001);

// ---------------------------------------------------------------------------
// CRE CLI
// ---------------------------------------------------------------------------
const rawCliPath = process.env.CRE_CLI_PATH || "~/.cre/bin/cre";
export const CRE_CLI_PATH = rawCliPath.replace("~", homedir());
export const PROJECT_ROOT = resolve(
  process.env.PROJECT_ROOT || resolve(import.meta.dir, "../..")
);

// Workflow paths (relative to PROJECT_ROOT)
export const WORKFLOWS = {
  tokenGeneration: "workflows/token-generation",
  identityVerification: "workflows/identity-verification",
  perTradeCompliance: "workflows/per-trade-compliance",
  identityAudit: "workflows/identity-audit",
} as const;

// ---------------------------------------------------------------------------
// Secrets - passed as env vars to cre workflow simulate
// These are the SAME values as in the project root .env
// ---------------------------------------------------------------------------
export const CRE_ENV = {
  SUMSUB_APP_TOKEN_ALL: process.env.SUMSUB_APP_TOKEN_ALL || "",
  SUMSUB_SECRET_KEY_ALL: process.env.SUMSUB_SECRET_KEY_ALL || "",
  CHAINALYSIS_API_KEY_ALL: process.env.CHAINALYSIS_API_KEY_ALL || "",
  AES_ENCRYPTION_KEY_ALL: process.env.AES_ENCRYPTION_KEY_ALL || "",
  PINATA_API_KEY_ALL: process.env.PINATA_API_KEY_ALL || "",
  PINATA_SECRET_KEY_ALL: process.env.PINATA_SECRET_KEY_ALL || "",
  CRE_ETH_PRIVATE_KEY: process.env.CRE_ETH_PRIVATE_KEY || "",
};

// ---------------------------------------------------------------------------
// On-chain - Arc Testnet (Chain ID 5042002)
// ---------------------------------------------------------------------------
export const RPC_URL = "https://rpc.testnet.arc.network";
export const CHAIN_ID = 5042002;

export const CONTRACTS = {
  credentialConsumer: "0x03726f51b287b04710DeB2cb62Bb9264bAC5bb11" as Address,
  reportConsumer: "0x78Bb94BCf494BB9aDE77f28dd20cE80077275A27" as Address,
  integratorRegistry: "0xCC1Ca53a3e0fc709EEF9a4682dC1bC1db3C028b1" as Address,
  identityRegistry: "0xC6DD797BF67d4f15e983ca2CE43967F345DF1993" as Address,
  credentialRegistry: "0x8806422a28932c8DbC87F8085218B250dB3A69d9" as Address,
  escrowSwap: "0x8f4e547A8AC08acbE6deeD40fDD8B665b76B3b6D" as Address,
} as const;

// Minimal ABIs for on-chain reads
export const CREDENTIAL_CONSUMER_ABI = [
  {
    name: "isVerified",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const INTEGRATOR_REGISTRY_ABI = [
  {
    name: "getIntegrator",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [
      { name: "appId", type: "bytes32" },
      { name: "workspaceId", type: "bytes32" },
      { name: "role", type: "uint8" },
      { name: "active", type: "bool" },
    ],
  },
  {
    name: "isActive",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;
