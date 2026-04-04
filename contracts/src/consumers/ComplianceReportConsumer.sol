// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IReceiver} from "@chainlink/contracts/src/v0.8/keystone/interfaces/IReceiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IComplianceCallback} from "../interfaces/IComplianceCallback.sol";

/// @title ComplianceReportConsumer
/// @notice Receives DON-signed per-trade compliance reports from CRE Workflow B.
///         Stores reports on-chain and exposes views for protocol integration.
///         Supports configurable auto-callbacks: when a report arrives, the consumer
///         calls back the registered protocol contract to execute or reject the trade.
contract ComplianceReportConsumer is IReceiver, Ownable {
  // --- Types ---

  struct ComplianceReport {
    bytes32 tradeId;
    address trader;
    address counterparty;
    address sourceContract; // protocol that emitted ComplianceCheckRequested
    bool approved;
    uint8 riskScore; // 0-10 scale
    bytes32 auditHash; // keccak256 of full off-chain AuditRecord
    string ipfsCid; // IPFS content identifier for the full encrypted AuditRecord
    uint256 timestamp;
  }

  // --- Storage ---

  address public keystoneForwarder;
  bytes32 public expectedWorkflowId;
  address public expectedWorkflowOwner;

  mapping(bytes32 tradeId => ComplianceReport) public reports;

  /// @notice Registered callback contracts per protocol. When a report arrives,
  ///         the consumer auto-calls the protocol's onComplianceApproved/Rejected.
  mapping(address protocol => bool) public registeredCallbacks;

  // --- Errors ---

  error UnauthorizedForwarder(address sender);
  error WorkflowIdMismatch(bytes32 received, bytes32 expected);
  error WorkflowOwnerMismatch(address received, address expected);
  error ReportAlreadyExists(bytes32 tradeId);
  event CallbackFailed(bytes32 indexed tradeId, address indexed protocol);

  // --- Events ---

  event ComplianceCheckCompleted(
    bytes32 indexed tradeId, address indexed trader, bool approved, uint8 riskScore, bytes32 auditHash
  );
  event ConfigUpdated(address keystoneForwarder, bytes32 workflowId, address workflowOwner);
  event CallbackRegistered(address indexed protocol);
  event CallbackRemoved(address indexed protocol);

  constructor(
    address _keystoneForwarder,
    bytes32 _expectedWorkflowId,
    address _expectedWorkflowOwner,
    address _owner
  ) Ownable(_owner) {
    keystoneForwarder = _keystoneForwarder;
    expectedWorkflowId = _expectedWorkflowId;
    expectedWorkflowOwner = _expectedWorkflowOwner;
  }

  // --- Configuration ---

  function setConfig(
    address _keystoneForwarder,
    bytes32 _expectedWorkflowId,
    address _expectedWorkflowOwner
  ) external onlyOwner {
    keystoneForwarder = _keystoneForwarder;
    expectedWorkflowId = _expectedWorkflowId;
    expectedWorkflowOwner = _expectedWorkflowOwner;
    emit ConfigUpdated(_keystoneForwarder, _expectedWorkflowId, _expectedWorkflowOwner);
  }

  // --- Callback Registration ---

  /// @notice Register a protocol contract to receive auto-callbacks on compliance results.
  function registerCallback(address protocol) external onlyOwner {
    registeredCallbacks[protocol] = true;
    emit CallbackRegistered(protocol);
  }

  /// @notice Remove a protocol's callback registration.
  function removeCallback(address protocol) external onlyOwner {
    registeredCallbacks[protocol] = false;
    emit CallbackRemoved(protocol);
  }

  // --- IReceiver ---

  function onReport(bytes calldata metadata, bytes calldata report) external override {
    if (msg.sender != keystoneForwarder) {
      revert UnauthorizedForwarder(msg.sender);
    }

    (bytes32 workflowId, address workflowOwner) = _extractMetadata(metadata);

    if (expectedWorkflowId != bytes32(0) && workflowId != expectedWorkflowId) {
      revert WorkflowIdMismatch(workflowId, expectedWorkflowId);
    }
    if (expectedWorkflowOwner != address(0) && workflowOwner != expectedWorkflowOwner) {
      revert WorkflowOwnerMismatch(workflowOwner, expectedWorkflowOwner);
    }

    ComplianceReport memory r = abi.decode(report, (ComplianceReport));

    if (reports[r.tradeId].timestamp != 0) {
      revert ReportAlreadyExists(r.tradeId);
    }

    reports[r.tradeId] = r;

    emit ComplianceCheckCompleted(r.tradeId, r.trader, r.approved, r.riskScore, r.auditHash);

    // Auto-callback: if the source protocol is registered, call it back.
    // Wrapped in try-catch so the report is always stored even if callback fails.
    if (r.sourceContract != address(0) && registeredCallbacks[r.sourceContract]) {
      if (r.approved) {
        try IComplianceCallback(r.sourceContract).onComplianceApproved(r.tradeId) {}
        catch { emit CallbackFailed(r.tradeId, r.sourceContract); }
      } else {
        try IComplianceCallback(r.sourceContract).onComplianceRejected(r.tradeId, "Compliance check failed") {}
        catch { emit CallbackFailed(r.tradeId, r.sourceContract); }
      }
    }
  }

  // --- Views for protocol integration ---

  /// @notice Check if a trade has been approved.
  function isApproved(bytes32 tradeId) external view returns (bool) {
    return reports[tradeId].approved;
  }

  /// @notice Check if a report exists for a trade.
  function hasReport(bytes32 tradeId) external view returns (bool) {
    return reports[tradeId].timestamp != 0;
  }

  /// @notice Get the full compliance report for a trade.
  function getReport(bytes32 tradeId) external view returns (ComplianceReport memory) {
    return reports[tradeId];
  }

  /// @notice Get the audit hash for off-chain record verification.
  function getAuditHash(bytes32 tradeId) external view returns (bytes32) {
    return reports[tradeId].auditHash;
  }

  // --- ERC165 ---

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
  }

  // --- Internal ---

  function _extractMetadata(bytes calldata metadata) internal pure returns (bytes32 workflowId, address workflowOwner) {
    assembly {
      workflowId := calldataload(metadata.offset)
      workflowOwner := shr(96, calldataload(add(metadata.offset, 42)))
    }
  }
}
