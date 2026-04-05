// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {PolicyProtected} from "@chainlink/policy-management/core/PolicyProtected.sol";
import {ComplianceReportConsumer} from "../consumers/ComplianceReportConsumer.sol";
import {IComplianceCallback} from "../interfaces/IComplianceCallback.sol";
import {IComplianceCredentialConsumer} from "../interfaces/IComplianceCredentialConsumer.sol";

/// @title DemoSwapProtocol
/// @notice Demonstrates all compliance integration patterns:
///   Pattern 1: `swapSimple` - 1-line require(isVerified) check (cached credentials)
///   Pattern 2: `swapACE` - ACE runPolicy modifier (transparent policy check)
///   Pattern 3: `swap` - single tx, CRE runs per-trade checks, auto-callbacks to execute
contract DemoSwapProtocol is PolicyProtected, IComplianceCallback {
  // --- Types ---

  struct PendingTrade {
    address trader;
    address counterparty;
    address asset;
    uint256 amount;
    uint256 submittedAt;
  }

  // --- Storage ---

  /// @notice The credential consumer for simple isVerified() checks
  IComplianceCredentialConsumer public credentialConsumer;

  /// @notice The report consumer for per-trade checks + auto-callbacks
  ComplianceReportConsumer public reportConsumer;

  /// @notice Pending trades awaiting compliance approval
  mapping(bytes32 tradeId => PendingTrade) public pendingTrades;

  // --- Events ---

  event TradeExecuted(bytes32 indexed tradeId, address indexed trader, address counterparty, address asset, uint256 amount);
  event TradeRejected(bytes32 indexed tradeId, address indexed trader, string reason);

  /// @notice Emitted to trigger CRE Workflow B (per-trade compliance)
  event ComplianceCheckRequested(
    bytes32 indexed tradeId, address indexed trader, address counterparty, address asset, uint256 amount
  );

  // --- Errors ---

  error NotVerified(address wallet);
  error TradeNotFound(bytes32 tradeId);
  error OnlyReportConsumer();

  constructor(
    address _credentialConsumer,
    address _reportConsumer,
    address _policyEngine,
    address _owner
  ) PolicyProtected(_owner, _policyEngine) {
    credentialConsumer = IComplianceCredentialConsumer(_credentialConsumer);
    reportConsumer = ComplianceReportConsumer(_reportConsumer);
  }

  // =========================================================================
  // Pattern 1: Simplest - 1-line require (cached KYC credential)
  // =========================================================================

  /// @notice Swap with cached credential check. Synchronous, single tx.
  /// @dev Best for: protocols that only need KYC gating, not per-trade deep checks.
  function swapSimple(address counterparty, address asset, uint256 amount) external {
    if (!credentialConsumer.isVerified(msg.sender)) revert NotVerified(msg.sender);

    bytes32 tradeId = _generateTradeId(msg.sender, counterparty, asset, amount);
    _executeTrade(tradeId, msg.sender, counterparty, asset, amount);
  }

  // =========================================================================
  // Pattern 2: ACE PolicyEngine - transparent policy check
  // =========================================================================

  /// @notice Swap with ACE PolicyEngine. Synchronous, single tx.
  /// @dev Best for: protocols already using ACE that want the full policy chain.
  function swapACE(address counterparty, address asset, uint256 amount) external runPolicy {
    bytes32 tradeId = _generateTradeId(msg.sender, counterparty, asset, amount);
    _executeTrade(tradeId, msg.sender, counterparty, asset, amount);
  }

  // =========================================================================
  // Pattern 3: Per-trade deep check - single user tx, CRE auto-callbacks
  // =========================================================================

  /// @notice Swap with full per-trade compliance (sanctions, counterparty, jurisdiction).
  /// @dev User calls this once. CRE runs all checks asynchronously, then auto-calls
  ///      onComplianceApproved() to execute the trade. No second tx needed.
  function swap(address counterparty, address asset, uint256 amount) external {
    bytes32 tradeId = _generateTradeId(msg.sender, counterparty, asset, amount);

    pendingTrades[tradeId] = PendingTrade({
      trader: msg.sender,
      counterparty: counterparty,
      asset: asset,
      amount: amount,
      submittedAt: block.timestamp
    });

    // This event triggers CRE Workflow B via EVM Log Trigger
    emit ComplianceCheckRequested(tradeId, msg.sender, counterparty, asset, amount);
  }

  // =========================================================================
  // IComplianceCallback - auto-called by ComplianceReportConsumer
  // =========================================================================

  /// @notice Called by ComplianceReportConsumer when the DON approves the trade.
  function onComplianceApproved(bytes32 tradeId) external override {
    if (msg.sender != address(reportConsumer)) revert OnlyReportConsumer();

    PendingTrade memory trade = pendingTrades[tradeId];
    if (trade.submittedAt == 0) revert TradeNotFound(tradeId);

    delete pendingTrades[tradeId];
    _executeTrade(tradeId, trade.trader, trade.counterparty, trade.asset, trade.amount);
  }

  /// @notice Called by ComplianceReportConsumer when the DON rejects the trade.
  function onComplianceRejected(bytes32 tradeId, string calldata reason) external override {
    if (msg.sender != address(reportConsumer)) revert OnlyReportConsumer();

    PendingTrade memory trade = pendingTrades[tradeId];
    if (trade.submittedAt == 0) revert TradeNotFound(tradeId);

    delete pendingTrades[tradeId];
    emit TradeRejected(tradeId, trade.trader, reason);
  }

  // --- Internal ---

  function _executeTrade(
    bytes32 tradeId,
    address trader,
    address counterparty,
    address asset,
    uint256 amount
  ) internal {
    // In a real protocol: transfer tokens, update balances, etc.
    emit TradeExecuted(tradeId, trader, counterparty, asset, amount);
  }

  function _generateTradeId(
    address trader,
    address counterparty,
    address asset,
    uint256 amount
  ) internal view returns (bytes32) {
    return keccak256(abi.encodePacked(trader, counterparty, asset, amount, block.timestamp, block.number));
  }
}
