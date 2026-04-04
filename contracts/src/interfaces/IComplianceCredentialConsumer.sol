// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IComplianceCredentialConsumer
/// @notice Interface for reading compliance credential status.
///         Used by protocols for the 1-line integration pattern.
interface IComplianceCredentialConsumer {
  /// @notice Returns whether a wallet has a valid KYC_VERIFIED credential.
  function isVerified(address wallet) external view returns (bool);

  /// @notice Check if a wallet has a specific credential type.
  function hasCredential(address wallet, bytes32 credentialTypeId) external view returns (bool);
}
