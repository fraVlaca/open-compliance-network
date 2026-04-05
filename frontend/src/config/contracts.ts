import { type Address } from "viem";

// Arc Testnet deployed addresses
export const CONTRACTS = {
  policyEngine: "0x95a9992a647E9dEfB5611cEf5A3DD0b98d8B1772" as Address,
  identityRegistry: "0xC6DD797BF67d4f15e983ca2CE43967F345DF1993" as Address,
  credentialRegistry:
    "0x8806422a28932c8DbC87F8085218B250dB3A69d9" as Address,
  credentialConsumer:
    "0x03726f51b287b04710DeB2cb62Bb9264bAC5bb11" as Address,
  reportConsumer: "0x78Bb94BCf494BB9aDE77f28dd20cE80077275A27" as Address,
  integratorRegistry:
    "0xCC1Ca53a3e0fc709EEF9a4682dC1bC1db3C028b1" as Address,
  escrowSwap: "0x8f4e547A8AC08acbE6deeD40fDD8B665b76B3b6D" as Address,
  usdc: "0x3600000000000000000000000000000000000000" as Address,
  eurc: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as Address,
} as const;

// Demo workspace ID (created at deployment)
export const DEMO_WORKSPACE_ID =
  "0x411f25477da9ba485ac107949d92fd4786f058bc1a91e6a52a2b5e48fd433123";

// ABIs (minimal - only the functions we call from the frontend)
export const INTEGRATOR_REGISTRY_ABI = [
  {
    name: "createWorkspace",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "requiresApproval", type: "bool" },
    ],
    outputs: [{ name: "appId", type: "bytes32" }],
  },
  {
    name: "joinWorkspace",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "workspaceId", type: "bytes32" },
      { name: "role", type: "uint8" },
    ],
    outputs: [{ name: "integratorAppId", type: "bytes32" }],
  },
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
    name: "getWorkspace",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "workspaceId", type: "bytes32" }],
    outputs: [
      { name: "name", type: "string" },
      { name: "admin", type: "address" },
      { name: "active", type: "bool" },
      { name: "requiresApproval", type: "bool" },
    ],
  },
  {
    name: "isActive",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export const CREDENTIAL_CONSUMER_ABI = [
  {
    name: "isVerified",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export const REPORT_CONSUMER_ABI = [
  {
    name: "getReport",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tradeId", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "tradeId", type: "bytes32" },
          { name: "trader", type: "address" },
          { name: "counterparty", type: "address" },
          { name: "sourceContract", type: "address" },
          { name: "approved", type: "bool" },
          { name: "riskScore", type: "uint8" },
          { name: "auditHash", type: "bytes32" },
          { name: "ipfsCid", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "isApproved",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tradeId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    name: "hasReport",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tradeId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export const ESCROW_SWAP_ABI = [
  {
    name: "createOrder",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "taker", type: "address" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOut", type: "uint256" },
    ],
    outputs: [{ name: "orderId", type: "bytes32" }],
  },
  {
    name: "fillOrder",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "fillOrderAsync",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "cancelOrder",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "orders",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [
      { name: "maker", type: "address" },
      { name: "taker", type: "address" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOut", type: "uint256" },
      { name: "createdAt", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    name: "OrderCreated",
    type: "event",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "tokenIn", type: "address", indexed: false },
      { name: "tokenOut", type: "address", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
    ],
  },
  {
    name: "OrderFilled",
    type: "event",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "maker", type: "address", indexed: true },
      { name: "taker", type: "address", indexed: true },
    ],
  },
  {
    name: "ComplianceCheckRequested",
    type: "event",
    inputs: [
      { name: "tradeId", type: "bytes32", indexed: true },
      { name: "trader", type: "address", indexed: true },
      { name: "counterparty", type: "address", indexed: false },
      { name: "asset", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

// --- Simulation mode ABIs (for demo without CRE deploy access) ---
// These allow the connected wallet to call onReport() directly, simulating what the DON would do.
// The keystoneForwarder was set to the deployer address for demo purposes.

export const CREDENTIAL_CONSUMER_SIMULATE_ABI = [
  {
    name: "onReport",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "metadata", type: "bytes" },
      { name: "report", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const REPORT_CONSUMER_SIMULATE_ABI = [
  {
    name: "onReport",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "metadata", type: "bytes" },
      { name: "report", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

// Simulation mode flag - set to true for hackathon demo without CRE deploy access
export const SIMULATE_MODE = true;
