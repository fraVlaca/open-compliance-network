// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IComplianceCallback
/// @notice Interface for protocol contracts that receive automatic callbacks
///         from the ComplianceReportConsumer when a per-trade compliance check completes.
interface IComplianceCallback {
  /// @notice Called by the ComplianceReportConsumer when a trade is approved.
  /// @param tradeId The trade that was approved.
  function onComplianceApproved(bytes32 tradeId) external;

  /// @notice Called by the ComplianceReportConsumer when a trade is rejected.
  /// @param tradeId The trade that was rejected.
  /// @param reason Human-readable rejection reason.
  function onComplianceRejected(bytes32 tradeId, string calldata reason) external;
}
