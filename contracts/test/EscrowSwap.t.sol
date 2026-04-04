// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {EscrowSwap} from "../src/demo/EscrowSwap.sol";
import {IComplianceCallback} from "../src/interfaces/IComplianceCallback.sol";
import {ComplianceCredentialConsumer} from "../src/consumers/ComplianceCredentialConsumer.sol";
import {ComplianceReportConsumer} from "../src/consumers/ComplianceReportConsumer.sol";
import {IdentityRegistry} from "@chainlink/cross-chain-identity/IdentityRegistry.sol";
import {CredentialRegistry} from "@chainlink/cross-chain-identity/CredentialRegistry.sol";
import {PolicyEngine} from "@chainlink/policy-management/core/PolicyEngine.sol";
import {OnlyAuthorizedSenderPolicy} from "@chainlink/policy-management/policies/OnlyAuthorizedSenderPolicy.sol";
import {Policy} from "@chainlink/policy-management/core/Policy.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Simple mock ERC20 for testing
contract MockUSDC is ERC20 {
  constructor() ERC20("Mock USDC", "USDC") {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }
}

contract MockEURC is ERC20 {
  constructor() ERC20("Mock EURC", "EURC") {}

  function mint(address to, uint256 amount) external {
    _mint(to, amount);
  }
}

contract EscrowSwapTest is Test {
  // Contracts
  EscrowSwap public escrow;
  ComplianceCredentialConsumer public credConsumer;
  ComplianceReportConsumer public reportConsumer;
  IdentityRegistry public identityRegistry;
  CredentialRegistry public credentialRegistry;
  PolicyEngine public policyEngine;
  MockUSDC public usdc;
  MockEURC public eurc;

  // Actors
  address public owner = address(0x1);
  address public forwarder = address(0x2);
  bytes32 public workflowId = keccak256("test-workflow");
  address public workflowOwner = address(0x3);

  address public maker = address(0xA);
  address public taker = address(0xB);
  address public unverified = address(0xC);

  bytes32 public KYC_VERIFIED = keccak256("KYC_VERIFIED");

  function setUp() public {
    vm.startPrank(owner);

    // Deploy tokens
    usdc = new MockUSDC();
    eurc = new MockEURC();

    // Deploy ACE stack
    PolicyEngine peImpl = new PolicyEngine();
    policyEngine = PolicyEngine(
      address(new ERC1967Proxy(address(peImpl), abi.encodeCall(PolicyEngine.initialize, (true, owner))))
    );

    IdentityRegistry irImpl = new IdentityRegistry();
    identityRegistry = IdentityRegistry(
      address(new ERC1967Proxy(address(irImpl), abi.encodeCall(IdentityRegistry.initialize, (address(policyEngine), owner))))
    );

    CredentialRegistry crImpl = new CredentialRegistry();
    credentialRegistry = CredentialRegistry(
      address(new ERC1967Proxy(address(crImpl), abi.encodeCall(CredentialRegistry.initialize, (address(policyEngine), owner))))
    );

    // Deploy consumers
    credConsumer = new ComplianceCredentialConsumer(
      forwarder, workflowId, workflowOwner, address(identityRegistry), address(credentialRegistry), owner
    );

    reportConsumer = new ComplianceReportConsumer(forwarder, workflowId, workflowOwner, owner);

    // Allow credConsumer to write to registries
    OnlyAuthorizedSenderPolicy spImpl = new OnlyAuthorizedSenderPolicy();
    OnlyAuthorizedSenderPolicy senderPolicy = OnlyAuthorizedSenderPolicy(
      address(new ERC1967Proxy(address(spImpl), abi.encodeCall(Policy.initialize, (address(policyEngine), owner, ""))))
    );
    senderPolicy.authorizeSender(address(credConsumer));

    bytes32[] memory noParams = new bytes32[](0);
    policyEngine.addPolicy(address(identityRegistry), IdentityRegistry.registerIdentity.selector, address(senderPolicy), noParams);
    policyEngine.addPolicy(address(credentialRegistry), CredentialRegistry.registerCredential.selector, address(senderPolicy), noParams);

    // Deploy escrow
    escrow = new EscrowSwap(address(credConsumer), address(reportConsumer));

    // Register callback for auto-execution
    reportConsumer.registerCallback(address(escrow));

    // Mint tokens
    usdc.mint(maker, 10_000e6);
    usdc.mint(taker, 10_000e6);
    eurc.mint(maker, 10_000e6);
    eurc.mint(taker, 10_000e6);

    vm.stopPrank();

    // Approve escrow to spend tokens
    vm.prank(maker);
    usdc.approve(address(escrow), type(uint256).max);
    vm.prank(maker);
    eurc.approve(address(escrow), type(uint256).max);
    vm.prank(taker);
    usdc.approve(address(escrow), type(uint256).max);
    vm.prank(taker);
    eurc.approve(address(escrow), type(uint256).max);
  }

  // --- Helpers ---

  function _issueCredential(address wallet) internal {
    bytes32 ccid = keccak256(abi.encodePacked("compliance-v1", wallet));
    bytes memory credData = abi.encode(uint8(2), uint8(1), "US", bytes32(0), bytes32(0));
    bytes memory report = abi.encode(wallet, ccid, KYC_VERIFIED, uint40(block.timestamp + 365 days), credData);
    bytes memory metadata = abi.encodePacked(workflowId, bytes10("test-wf"), workflowOwner, bytes2("01"));

    vm.prank(forwarder);
    credConsumer.onReport(metadata, report);
  }

  function _buildTradeReport(
    bytes32 tradeId,
    address trader,
    address counterparty,
    bool approved
  ) internal view returns (bytes memory metadata, bytes memory report) {
    metadata = abi.encodePacked(workflowId, bytes10("trade-chk"), workflowOwner, bytes2("01"));

    ComplianceReportConsumer.ComplianceReport memory r = ComplianceReportConsumer.ComplianceReport({
      tradeId: tradeId,
      trader: trader,
      counterparty: counterparty,
      sourceContract: address(escrow),
      approved: approved,
      riskScore: approved ? 1 : 8,
      auditHash: keccak256("audit"),
      ipfsCid: "",
      timestamp: block.timestamp
    });
    report = abi.encode(r);
  }

  // =========================================================================
  // Pattern 1: Synchronous (fillOrder with isVerified)
  // =========================================================================

  function test_fillOrder_verified() public {
    _issueCredential(maker);
    _issueCredential(taker);

    vm.prank(maker);
    bytes32 orderId = escrow.createOrder(address(0), address(usdc), address(eurc), 100e6, 90e6);

    uint256 makerUsdcBefore = usdc.balanceOf(maker);
    uint256 takerEurcBefore = eurc.balanceOf(taker);

    vm.prank(taker);
    escrow.fillOrder(orderId);

    // Maker got EURC, taker got USDC
    assertEq(eurc.balanceOf(maker), 10_000e6 + 90e6);
    assertEq(usdc.balanceOf(taker), 10_000e6 + 100e6);
  }

  function test_fillOrder_revertsUnverified() public {
    _issueCredential(maker);
    // taker NOT verified

    vm.prank(maker);
    bytes32 orderId = escrow.createOrder(address(0), address(usdc), address(eurc), 100e6, 90e6);

    vm.prank(unverified);
    vm.expectRevert(abi.encodeWithSelector(EscrowSwap.NotVerified.selector, unverified));
    escrow.fillOrder(orderId);
  }

  function test_createOrder_revertsUnverified() public {
    vm.prank(unverified);
    vm.expectRevert(abi.encodeWithSelector(EscrowSwap.NotVerified.selector, unverified));
    escrow.createOrder(address(0), address(usdc), address(eurc), 100e6, 90e6);
  }

  // =========================================================================
  // Pattern 3: Async (fillOrderAsync → CRE → auto-callback)
  // =========================================================================

  function test_fillOrderAsync_approved() public {
    _issueCredential(maker);

    vm.prank(maker);
    bytes32 orderId = escrow.createOrder(address(0), address(usdc), address(eurc), 100e6, 90e6);

    // Taker fills async (no KYC check yet — CRE will check)
    vm.prank(taker);
    escrow.fillOrderAsync(orderId);

    // Order is pending
    (, , , , , , , EscrowSwap.OrderStatus status) = escrow.orders(orderId);
    assertEq(uint8(status), uint8(EscrowSwap.OrderStatus.PendingCompliance));

    // Both tokens now in escrow
    assertEq(usdc.balanceOf(address(escrow)), 100e6);
    assertEq(eurc.balanceOf(address(escrow)), 90e6);

    // CRE approves → ComplianceReportConsumer calls back escrow
    (bytes memory metadata, bytes memory report) = _buildTradeReport(orderId, taker, maker, true);
    vm.prank(forwarder);
    reportConsumer.onReport(metadata, report);

    // Order is now filled
    (, , , , , , , EscrowSwap.OrderStatus statusAfter) = escrow.orders(orderId);
    assertEq(uint8(statusAfter), uint8(EscrowSwap.OrderStatus.Filled));

    // Tokens settled
    assertEq(eurc.balanceOf(maker), 10_000e6 + 90e6);
    assertEq(usdc.balanceOf(taker), 10_000e6 + 100e6);
  }

  function test_fillOrderAsync_rejected() public {
    _issueCredential(maker);

    vm.prank(maker);
    bytes32 orderId = escrow.createOrder(address(0), address(usdc), address(eurc), 100e6, 90e6);

    uint256 makerUsdcBefore = usdc.balanceOf(maker);
    uint256 takerEurcBefore = eurc.balanceOf(taker);

    vm.prank(taker);
    escrow.fillOrderAsync(orderId);

    // CRE rejects
    (bytes memory metadata, bytes memory report) = _buildTradeReport(orderId, taker, maker, false);
    vm.prank(forwarder);
    reportConsumer.onReport(metadata, report);

    // Order rejected, tokens refunded
    (, , , , , , , EscrowSwap.OrderStatus status) = escrow.orders(orderId);
    assertEq(uint8(status), uint8(EscrowSwap.OrderStatus.Rejected));

    // Both parties got their tokens back
    // maker had 10000, deposited 100 in createOrder, got 100 back on reject = 10000
    assertEq(usdc.balanceOf(maker), 10_000e6);
    // taker had 10000, deposited 90 in fillOrderAsync, got 90 back on reject = 10000
    assertEq(eurc.balanceOf(taker), 10_000e6);
  }

  // =========================================================================
  // Order management
  // =========================================================================

  function test_cancelOrder() public {
    _issueCredential(maker);

    vm.prank(maker);
    bytes32 orderId = escrow.createOrder(address(0), address(usdc), address(eurc), 100e6, 90e6);

    uint256 makerBefore = usdc.balanceOf(maker);

    vm.prank(maker);
    escrow.cancelOrder(orderId);

    // Maker got tokens back
    assertEq(usdc.balanceOf(maker), makerBefore + 100e6);

    (, , , , , , , EscrowSwap.OrderStatus status) = escrow.orders(orderId);
    assertEq(uint8(status), uint8(EscrowSwap.OrderStatus.Cancelled));
  }

  function test_cancelOrder_revertsIfNotMaker() public {
    _issueCredential(maker);

    vm.prank(maker);
    bytes32 orderId = escrow.createOrder(address(0), address(usdc), address(eurc), 100e6, 90e6);

    vm.prank(taker);
    vm.expectRevert(abi.encodeWithSelector(EscrowSwap.NotMaker.selector, orderId));
    escrow.cancelOrder(orderId);
  }

  // =========================================================================
  // Callback error handling
  // =========================================================================

  function test_callback_failureDoesNotPreventReportStorage() public {
    // Deploy a contract that always reverts on callback
    RevertingCallback revertingContract = new RevertingCallback();
    vm.prank(owner);
    reportConsumer.registerCallback(address(revertingContract));

    bytes32 tradeId = keccak256("fail-callback");
    bytes memory metadata = abi.encodePacked(workflowId, bytes10("trade-chk"), workflowOwner, bytes2("01"));
    ComplianceReportConsumer.ComplianceReport memory r = ComplianceReportConsumer.ComplianceReport({
      tradeId: tradeId,
      trader: taker,
      counterparty: maker,
      sourceContract: address(revertingContract),
      approved: true,
      riskScore: 1,
      auditHash: keccak256("audit"),
      ipfsCid: "",
      timestamp: block.timestamp
    });

    vm.prank(forwarder);
    reportConsumer.onReport(metadata, abi.encode(r));

    // Report was stored despite callback failure
    assertTrue(reportConsumer.hasReport(tradeId));
    assertTrue(reportConsumer.isApproved(tradeId));
  }
}

/// @dev Mock contract that always reverts on callback — used to test try-catch in ComplianceReportConsumer
contract RevertingCallback is IComplianceCallback {
  function onComplianceApproved(bytes32) external pure override {
    revert("intentional revert");
  }

  function onComplianceRejected(bytes32, string calldata) external pure override {
    revert("intentional revert");
  }
}
