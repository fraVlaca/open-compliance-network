// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ComplianceCredentialConsumer} from "../src/consumers/ComplianceCredentialConsumer.sol";
import {IdentityRegistry} from "@chainlink/cross-chain-identity/IdentityRegistry.sol";
import {CredentialRegistry} from "@chainlink/cross-chain-identity/CredentialRegistry.sol";
import {PolicyEngine} from "@chainlink/policy-management/core/PolicyEngine.sol";
import {OnlyAuthorizedSenderPolicy} from "@chainlink/policy-management/policies/OnlyAuthorizedSenderPolicy.sol";
import {Policy} from "@chainlink/policy-management/core/Policy.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IReceiver} from "@chainlink/contracts/src/v0.8/keystone/interfaces/IReceiver.sol";

contract ComplianceCredentialConsumerTest is Test {
  ComplianceCredentialConsumer public consumer;
  IdentityRegistry public identityRegistry;
  CredentialRegistry public credentialRegistry;
  PolicyEngine public registryPolicyEngine;
  OnlyAuthorizedSenderPolicy public senderPolicy;

  address public owner = address(0x1);
  address public keystoneForwarder = address(0x2);
  bytes32 public workflowId = keccak256("test-workflow-id");
  address public workflowOwner = address(0x3);

  address public userWallet = address(0xA);
  bytes32 public userCcid = keccak256(abi.encodePacked("compliance-v1", userWallet));
  bytes32 public KYC_VERIFIED = keccak256("KYC_VERIFIED");

  function setUp() public {
    vm.startPrank(owner);

    // Deploy PolicyEngine for the registries (controls who can write to them)
    PolicyEngine policyEngineImpl = new PolicyEngine();
    registryPolicyEngine = PolicyEngine(
      address(new ERC1967Proxy(address(policyEngineImpl), abi.encodeCall(PolicyEngine.initialize, (true, owner))))
    );

    // Deploy IdentityRegistry
    IdentityRegistry identityRegistryImpl = new IdentityRegistry();
    identityRegistry = IdentityRegistry(
      address(
        new ERC1967Proxy(
          address(identityRegistryImpl),
          abi.encodeCall(IdentityRegistry.initialize, (address(registryPolicyEngine), owner))
        )
      )
    );

    // Deploy CredentialRegistry
    CredentialRegistry credentialRegistryImpl = new CredentialRegistry();
    credentialRegistry = CredentialRegistry(
      address(
        new ERC1967Proxy(
          address(credentialRegistryImpl),
          abi.encodeCall(CredentialRegistry.initialize, (address(registryPolicyEngine), owner))
        )
      )
    );

    // Deploy the consumer
    consumer = new ComplianceCredentialConsumer(
      keystoneForwarder, workflowId, workflowOwner, address(identityRegistry), address(credentialRegistry), owner
    );

    // Allow the consumer to write to the registries via OnlyAuthorizedSenderPolicy
    OnlyAuthorizedSenderPolicy senderPolicyImpl = new OnlyAuthorizedSenderPolicy();
    senderPolicy = OnlyAuthorizedSenderPolicy(
      address(
        new ERC1967Proxy(
          address(senderPolicyImpl),
          abi.encodeCall(Policy.initialize, (address(registryPolicyEngine), owner, ""))
        )
      )
    );
    senderPolicy.authorizeSender(address(consumer));

    // Add policy to IdentityRegistry's registerIdentity selector
    bytes32[] memory emptyParams = new bytes32[](0);
    registryPolicyEngine.addPolicy(
      address(identityRegistry), IdentityRegistry.registerIdentity.selector, address(senderPolicy), emptyParams
    );

    // Add policy to CredentialRegistry's registerCredential selector
    registryPolicyEngine.addPolicy(
      address(credentialRegistry), CredentialRegistry.registerCredential.selector, address(senderPolicy), emptyParams
    );

    vm.stopPrank();
  }

  // --- Helper ---

  function _buildMetadata(bytes32 _workflowId, address _workflowOwner) internal pure returns (bytes memory) {
    // Layout: [32 bytes workflowCid][10 bytes workflowName][20 bytes workflowOwner][2 bytes reportName]
    bytes10 workflowName = bytes10("test-wf");
    bytes2 reportName = bytes2("01");
    return abi.encodePacked(_workflowId, workflowName, _workflowOwner, reportName);
  }

  function _buildReport(
    address wallet,
    bytes32 ccid,
    bytes32 credentialTypeId,
    uint40 expiresAt,
    bytes memory credentialData
  ) internal pure returns (bytes memory) {
    return abi.encode(wallet, ccid, credentialTypeId, expiresAt, credentialData);
  }

  // --- Tests ---

  function test_onReport_registersIdentityAndCredential() public {
    bytes memory metadata = _buildMetadata(workflowId, workflowOwner);
    bytes memory credentialData = abi.encode(uint8(2), uint8(3), "DE");
    bytes memory report = _buildReport(userWallet, userCcid, KYC_VERIFIED, uint40(block.timestamp + 365 days), credentialData);

    vm.prank(keystoneForwarder);
    consumer.onReport(metadata, report);

    // Verify identity was registered
    assertEq(identityRegistry.getIdentity(userWallet), userCcid);

    // Verify credential was registered
    assertTrue(credentialRegistry.validate(userCcid, KYC_VERIFIED, ""));

    // Verify isVerified view
    assertTrue(consumer.isVerified(userWallet));
  }

  function test_onReport_revertsIfNotForwarder() public {
    bytes memory metadata = _buildMetadata(workflowId, workflowOwner);
    bytes memory report = _buildReport(userWallet, userCcid, KYC_VERIFIED, uint40(block.timestamp + 365 days), "");

    vm.prank(address(0xBAD));
    vm.expectRevert(abi.encodeWithSelector(ComplianceCredentialConsumer.UnauthorizedForwarder.selector, address(0xBAD)));
    consumer.onReport(metadata, report);
  }

  function test_onReport_revertsIfWorkflowIdMismatch() public {
    bytes32 wrongId = keccak256("wrong");
    bytes memory metadata = _buildMetadata(wrongId, workflowOwner);
    bytes memory report = _buildReport(userWallet, userCcid, KYC_VERIFIED, uint40(block.timestamp + 365 days), "");

    vm.prank(keystoneForwarder);
    vm.expectRevert(
      abi.encodeWithSelector(ComplianceCredentialConsumer.WorkflowIdMismatch.selector, wrongId, workflowId)
    );
    consumer.onReport(metadata, report);
  }

  function test_onReport_revertsIfWorkflowOwnerMismatch() public {
    address wrongOwner = address(0xDEAD);
    bytes memory metadata = _buildMetadata(workflowId, wrongOwner);
    bytes memory report = _buildReport(userWallet, userCcid, KYC_VERIFIED, uint40(block.timestamp + 365 days), "");

    vm.prank(keystoneForwarder);
    vm.expectRevert(
      abi.encodeWithSelector(ComplianceCredentialConsumer.WorkflowOwnerMismatch.selector, wrongOwner, workflowOwner)
    );
    consumer.onReport(metadata, report);
  }

  function test_isVerified_returnsFalseForUnknownWallet() public view {
    assertFalse(consumer.isVerified(address(0xBEEF)));
  }

  function test_hasCredential_worksForCustomTypes() public {
    bytes32 AML_CLEAR = keccak256("AML_CLEAR");
    bytes memory metadata = _buildMetadata(workflowId, workflowOwner);
    bytes memory report = _buildReport(userWallet, userCcid, AML_CLEAR, uint40(block.timestamp + 30 days), "");

    vm.prank(keystoneForwarder);
    consumer.onReport(metadata, report);

    assertTrue(consumer.hasCredential(userWallet, AML_CLEAR));
    assertFalse(consumer.hasCredential(userWallet, KYC_VERIFIED));
  }

  function test_supportsInterface() public view {
    assertTrue(consumer.supportsInterface(type(IReceiver).interfaceId));
  }

  function test_setConfig_onlyOwner() public {
    bytes32 newId = keccak256("new");
    address newOwner = address(0x99);

    vm.prank(owner);
    consumer.setConfig(address(0x5), newId, newOwner);

    assertEq(consumer.expectedWorkflowId(), newId);
    assertEq(consumer.expectedWorkflowOwner(), newOwner);
  }
}
