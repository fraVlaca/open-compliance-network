// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IReceiver} from "@chainlink/contracts/src/v0.8/keystone/interfaces/IReceiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IIdentityRegistry} from "@chainlink/cross-chain-identity/interfaces/IIdentityRegistry.sol";
import {ICredentialRegistry} from "@chainlink/cross-chain-identity/interfaces/ICredentialRegistry.sol";

/// @title ComplianceCredentialConsumer
/// @notice Receives DON-signed identity verification reports from CRE Workflow A
///         and writes credentials into the ACE IdentityRegistry + CredentialRegistry.
///         Also exposes a simple `isVerified(address)` view for 1-line protocol integration.
contract ComplianceCredentialConsumer is IReceiver, Ownable {
  // --- Storage ---

  address public keystoneForwarder;
  bytes32 public expectedWorkflowId;
  address public expectedWorkflowOwner;

  IIdentityRegistry public identityRegistry;
  ICredentialRegistry public credentialRegistry;

  bytes32 public constant KYC_VERIFIED = keccak256("KYC_VERIFIED");

  // --- Errors ---

  error UnauthorizedForwarder(address sender);
  error WorkflowIdMismatch(bytes32 received, bytes32 expected);
  error WorkflowOwnerMismatch(address received, address expected);

  // --- Events ---

  event CredentialIssued(address indexed wallet, bytes32 indexed ccid, bytes32 credentialTypeId, uint40 expiresAt);
  event ConfigUpdated(address keystoneForwarder, bytes32 workflowId, address workflowOwner);

  constructor(
    address _keystoneForwarder,
    bytes32 _expectedWorkflowId,
    address _expectedWorkflowOwner,
    address _identityRegistry,
    address _credentialRegistry,
    address _owner
  ) Ownable(_owner) {
    keystoneForwarder = _keystoneForwarder;
    expectedWorkflowId = _expectedWorkflowId;
    expectedWorkflowOwner = _expectedWorkflowOwner;
    identityRegistry = IIdentityRegistry(_identityRegistry);
    credentialRegistry = ICredentialRegistry(_credentialRegistry);
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

  // --- IReceiver ---

  /// @notice Handles incoming DON-signed reports from the KeystoneForwarder.
  /// @dev Validates the forwarder, extracts workflow metadata, verifies workflowId and owner,
  ///      then registers the identity and credential in the ACE registries.
  function onReport(bytes calldata metadata, bytes calldata report) external override {
    if (msg.sender != keystoneForwarder) {
      revert UnauthorizedForwarder(msg.sender);
    }

    // Extract metadata: workflowId at offset 0 (32 bytes), workflowOwner at offset 42 (20 bytes)
    (bytes32 workflowId, address workflowOwner) = _extractMetadata(metadata);

    if (expectedWorkflowId != bytes32(0) && workflowId != expectedWorkflowId) {
      revert WorkflowIdMismatch(workflowId, expectedWorkflowId);
    }
    if (expectedWorkflowOwner != address(0) && workflowOwner != expectedWorkflowOwner) {
      revert WorkflowOwnerMismatch(workflowOwner, expectedWorkflowOwner);
    }

    // Decode the report
    (
      address walletAddress,
      bytes32 ccid,
      bytes32 credentialTypeId,
      uint40 expiresAt,
      bytes memory credentialData
    ) = abi.decode(report, (address, bytes32, bytes32, uint40, bytes));

    // Register identity (wallet -> CCID mapping) if not already registered
    if (identityRegistry.getIdentity(walletAddress) == bytes32(0)) {
      identityRegistry.registerIdentity(ccid, walletAddress, "");
    }

    // Register credential
    credentialRegistry.registerCredential(ccid, credentialTypeId, expiresAt, credentialData, "");

    emit CredentialIssued(walletAddress, ccid, credentialTypeId, expiresAt);
  }

  // --- Simple integration view ---

  /// @notice Returns whether a wallet has a valid (non-expired) KYC_VERIFIED credential.
  /// @dev This is the 1-line integration point for protocols:
  ///      `require(consumer.isVerified(msg.sender), "Not compliant")`
  function isVerified(address wallet) external view returns (bool) {
    bytes32 ccid = identityRegistry.getIdentity(wallet);
    if (ccid == bytes32(0)) return false;
    return credentialRegistry.validate(ccid, KYC_VERIFIED, "");
  }

  /// @notice Check if a wallet has a specific credential type.
  function hasCredential(address wallet, bytes32 credentialTypeId) external view returns (bool) {
    bytes32 ccid = identityRegistry.getIdentity(wallet);
    if (ccid == bytes32(0)) return false;
    return credentialRegistry.validate(ccid, credentialTypeId, "");
  }

  // --- ERC165 ---

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
  }

  // --- Internal ---

  /// @dev Extracts workflowId and workflowOwner from the KeystoneForwarder metadata.
  ///      Metadata layout: [32 bytes workflowCid][10 bytes workflowName][20 bytes workflowOwner][2 bytes reportName]
  function _extractMetadata(bytes calldata metadata) internal pure returns (bytes32 workflowId, address workflowOwner) {
    // workflowId (workflow_cid) starts at offset 0, size 32
    // workflowOwner starts at offset 42 (32 + 10), size 20
    assembly {
      workflowId := calldataload(metadata.offset)
      workflowOwner := shr(96, calldataload(add(metadata.offset, 42)))
    }
  }
}
