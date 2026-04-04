// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {PolicyEngine} from "@chainlink/policy-management/core/PolicyEngine.sol";
import {IdentityRegistry} from "@chainlink/cross-chain-identity/IdentityRegistry.sol";
import {CredentialRegistry} from "@chainlink/cross-chain-identity/CredentialRegistry.sol";
import {OnlyAuthorizedSenderPolicy} from "@chainlink/policy-management/policies/OnlyAuthorizedSenderPolicy.sol";
import {Policy} from "@chainlink/policy-management/core/Policy.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ComplianceCredentialConsumer} from "../src/consumers/ComplianceCredentialConsumer.sol";
import {ComplianceReportConsumer} from "../src/consumers/ComplianceReportConsumer.sol";
import {IntegratorRegistry} from "../src/registries/IntegratorRegistry.sol";
import {EscrowSwap} from "../src/demo/EscrowSwap.sol";

/// @title Deploy — Deploys the full compliance engine stack to Arc Testnet
/// @dev Run: forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.network --broadcast
contract Deploy is Script {
  // -----------------------------------------------------------------------
  // Configuration — update these before deploying
  // -----------------------------------------------------------------------

  // KeystoneForwarder on Arc Testnet (from Chainlink CRE Forwarder Directory)
  address constant KEYSTONE_FORWARDER = 0x6E9EE680ef59ef64Aa8C7371279c27E496b5eDc1;

  // CRE workflow identity — set after deploying workflows via `cre workflow deploy`
  // Initial deploy uses bytes32(0) to skip validation; update via setConfig() after workflow deploy
  bytes32 constant IDENTITY_WORKFLOW_ID = bytes32(0);
  bytes32 constant PERTRADE_WORKFLOW_ID = bytes32(0);
  address constant WORKFLOW_OWNER = address(0); // set to your CRE deployer wallet after workflow deploy

  // USDC on Arc Testnet — native stablecoin (also used for gas)
  // Note: native USDC uses 18 decimals for gas, but ERC-20 interface uses 6 decimals
  address constant USDC = 0x3600000000000000000000000000000000000000;

  function run() external {
    uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
    address deployer = vm.addr(deployerPrivateKey);

    console.log("Deployer:", deployer);
    console.log("Chain ID:", block.chainid);

    vm.startBroadcast(deployerPrivateKey);

    // =====================================================================
    // 1. Deploy PolicyEngine (proxy)
    // =====================================================================
    PolicyEngine peImpl = new PolicyEngine();
    PolicyEngine policyEngine = PolicyEngine(
      address(
        new ERC1967Proxy(
          address(peImpl),
          abi.encodeCall(PolicyEngine.initialize, (true, deployer)) // defaultAllow=true
        )
      )
    );
    console.log("PolicyEngine:", address(policyEngine));

    // =====================================================================
    // 2. Deploy IdentityRegistry (proxy)
    // =====================================================================
    IdentityRegistry irImpl = new IdentityRegistry();
    IdentityRegistry identityRegistry = IdentityRegistry(
      address(
        new ERC1967Proxy(
          address(irImpl),
          abi.encodeCall(IdentityRegistry.initialize, (address(policyEngine), deployer))
        )
      )
    );
    console.log("IdentityRegistry:", address(identityRegistry));

    // =====================================================================
    // 3. Deploy CredentialRegistry (proxy)
    // =====================================================================
    CredentialRegistry crImpl = new CredentialRegistry();
    CredentialRegistry credentialRegistry = CredentialRegistry(
      address(
        new ERC1967Proxy(
          address(crImpl),
          abi.encodeCall(CredentialRegistry.initialize, (address(policyEngine), deployer))
        )
      )
    );
    console.log("CredentialRegistry:", address(credentialRegistry));

    // =====================================================================
    // 4. Deploy ComplianceCredentialConsumer
    // =====================================================================
    ComplianceCredentialConsumer credConsumer = new ComplianceCredentialConsumer(
      KEYSTONE_FORWARDER,
      IDENTITY_WORKFLOW_ID,
      WORKFLOW_OWNER,
      address(identityRegistry),
      address(credentialRegistry),
      deployer
    );
    console.log("ComplianceCredentialConsumer:", address(credConsumer));

    // =====================================================================
    // 5. Deploy ComplianceReportConsumer
    // =====================================================================
    ComplianceReportConsumer reportConsumer = new ComplianceReportConsumer(
      KEYSTONE_FORWARDER,
      PERTRADE_WORKFLOW_ID,
      WORKFLOW_OWNER,
      deployer
    );
    console.log("ComplianceReportConsumer:", address(reportConsumer));

    // =====================================================================
    // 6. Authorize credConsumer to write to registries
    // =====================================================================
    OnlyAuthorizedSenderPolicy spImpl = new OnlyAuthorizedSenderPolicy();
    OnlyAuthorizedSenderPolicy senderPolicy = OnlyAuthorizedSenderPolicy(
      address(
        new ERC1967Proxy(
          address(spImpl),
          abi.encodeCall(Policy.initialize, (address(policyEngine), deployer, ""))
        )
      )
    );
    senderPolicy.authorizeSender(address(credConsumer));

    bytes32[] memory noParams = new bytes32[](0);
    policyEngine.addPolicy(
      address(identityRegistry),
      IdentityRegistry.registerIdentity.selector,
      address(senderPolicy),
      noParams
    );
    policyEngine.addPolicy(
      address(credentialRegistry),
      CredentialRegistry.registerCredential.selector,
      address(senderPolicy),
      noParams
    );
    console.log("OnlyAuthorizedSenderPolicy:", address(senderPolicy));

    // =====================================================================
    // 7. Deploy IntegratorRegistry
    // =====================================================================
    IntegratorRegistry intRegistry = new IntegratorRegistry(deployer);
    console.log("IntegratorRegistry:", address(intRegistry));

    // =====================================================================
    // 8. Deploy EscrowSwap (demo)
    // =====================================================================
    EscrowSwap escrow = new EscrowSwap(address(credConsumer), address(reportConsumer));
    console.log("EscrowSwap:", address(escrow));

    // Register escrow for auto-callbacks
    reportConsumer.registerCallback(address(escrow));

    // =====================================================================
    // 9. Create demo workspace
    // =====================================================================
    bytes32 demoWorkspaceId = intRegistry.createWorkspace("demo-protocol", false);
    console.log("Demo workspace ID:");
    console.logBytes32(demoWorkspaceId);

    vm.stopBroadcast();

    // =====================================================================
    // Print summary for CRE config
    // =====================================================================
    console.log("\n=== DEPLOYMENT SUMMARY ===");
    console.log("Update CRE workflow config.json files with these addresses:");
    console.log("  consumerContractAddress:", address(credConsumer));
    console.log("  reportConsumerAddress:", address(reportConsumer));
    console.log("  integratorRegistryAddress:", address(intRegistry));
    console.log("  identityRegistryAddress:", address(identityRegistry));
    console.log("  credentialRegistryAddress:", address(credentialRegistry));
    console.log("  escrowSwapAddress:", address(escrow));
    console.log("\nAfter deploying CRE workflows, update consumer configs:");
    console.log("  credConsumer.setConfig(forwarder, workflowId, workflowOwner)");
    console.log("  reportConsumer.setConfig(forwarder, workflowId, workflowOwner)");
  }
}
