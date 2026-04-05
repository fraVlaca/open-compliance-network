export const DEMO = {
  projectName: 'Open Compliance Layer',
  tagline: 'One check per trade. One audit trail. Every party trusts it.',
  chain: {
    name: 'Arc Testnet',
    chainId: 5042002,
    rpc: 'https://rpc.testnet.arc.network',
    explorer: 'https://testnet.arcscan.app',
    faucet: 'https://faucet.circle.com/',
  },
  contracts: {
    policyEngine: '0x95a9992a647E9dEfB5611cEf5A3DD0b98d8B1772',
    identityRegistry: '0xC6DD797BF67d4f15e983ca2CE43967F345DF1993',
    credentialRegistry: '0x8806422a28932c8DbC87F8085218B250dB3A69d9',
    credentialConsumer: '0x03726f51b287b04710DeB2cb62Bb9264bAC5bb11',
    reportConsumer: '0x78Bb94BCf494BB9aDE77f28dd20cE80077275A27',
    integratorRegistry: '0xCC1Ca53a3e0fc709EEF9a4682dC1bC1db3C028b1',
    escrowSwap: '0x8f4e547A8AC08acbE6deeD40fDD8B665b76B3b6D',
  },
  providers: {
    sumsub: { name: 'Sumsub', purpose: 'KYC/CDD, Sanctions, PEP', costRange: '$10-50K/yr', color: '#10b981' },
    chainalysis: { name: 'Chainalysis', purpose: 'Wallet risk, exposure, monitoring', costRange: '$100-500K/yr', color: '#3b82f6' },
    notabene: { name: 'Notabene', purpose: 'Travel Rule (IVMS101)', costRange: '$10-50K/yr', color: '#f59e0b' },
  },
  fragmentation: {
    totalCostRange: '$1.3-4.4M/year',
    partiesPerTrade: 4,
    euDexDecline: '18.9%',
    euWalletDecline: '22%',
    offshoreSwitch: '40%',
  },
  workflows: {
    identity: { name: 'identity-verification', trigger: 'HTTP' },
    perTrade: { name: 'per-trade-compliance', trigger: 'EVM Log' },
    audit: { name: 'identity-audit', trigger: 'HTTP' },
  },
  integration: {
    pattern1: `function trade(...) external {
    require(consumer.isVerified(msg.sender), "Not compliant");
    // existing trade logic
}`,
    pattern2: `function trade(...) external runPolicy {
    // compliance check is transparent
    // existing trade logic
}`,
    pattern3: `// 1. Trigger check
emit ComplianceCheckRequested(tradeId, msg.sender, counterparty, asset, amount);

// 2. Receive result (called by CRE via ComplianceReportConsumer)
function onComplianceApproved(bytes32 tradeId) external onlyForwarder {
    _settleTrade(tradeId);
}`,
  },
  sampleCredential: {
    walletAddress: '0xCEf99c170d0A92E49864DC00a2b86AfBd3cDc3ff',
    ccid: '0x7a3b...compliance-v1',
    credentialTypeId: 'KYC_VERIFIED',
    expiresAt: '2027-04-04T00:00:00Z',
    credentialData: {
      kycLevel: 2,
      riskScore: 1,
      jurisdiction: 'DE',
      brokerAppId: '0xbroker_xyz...',
      workspaceId: '0xproto_abc...',
    },
  },
  sampleReport: {
    tradeId: '0xabc123...',
    trader: '0xCEf99c170d0A92E49864DC00a2b86AfBd3cDc3ff',
    counterparty: '0xLP_address...',
    approved: true,
    riskScore: 2,
    auditHash: '0x9f2e...keccak256',
    ipfsCid: 'QmXyz...pinata',
    timestamp: 1743696000,
  },
  sampleAuditRecord: {
    tradeId: '0xabc123...',
    workspaceId: '0xproto_abc...',
    brokerAppId: '0xbroker_xyz...',
    sumsub: { reviewStatus: 'completed', reviewAnswer: 'GREEN', sanctionsHit: false, pepStatus: false, jurisdiction: 'DE' },
    traderWalletRisk: { riskScore: 2.1, sanctionedExposure: 0, darknetExposure: 0, mixerExposure: 0 },
    counterpartyWalletRisk: { riskScore: 1.8, sanctionedExposure: 0, darknetExposure: 0, mixerExposure: 0 },
    jurisdictionCheck: { allowed: true, jurisdiction: 'DE', regulation: 'MiCA' },
    decision: { approved: true, riskScore: 2, flags: [], reasoning: 'All checks passed.' },
  },
}

export const CANVAS = {
  overview: { width: 1200, height: 400 },
  drillDown: { width: 1400, height: 800 },
}
