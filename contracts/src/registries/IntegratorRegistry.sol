// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title IntegratorRegistry
/// @notice On-chain registry for workspaces and integrator identities.
///         CRE workflows read this contract to determine a requester's role,
///         appId, and workspace - enforcing scoped access to compliance data.
///         Wallets registered here act as "API keys" - no backend needed.
contract IntegratorRegistry is Ownable {
  // --- Types ---

  enum Role {
    PROTOCOL,
    BROKER,
    LP
  }

  struct Workspace {
    bytes32 appId;
    string name;
    address admin;
    bool active;
    bool requiresApproval; // if true, integrators must be approved by admin
  }

  struct Integrator {
    bytes32 appId; // unique integrator ID
    bytes32 workspaceId; // linked workspace
    Role role;
    address wallet;
    bool active;
  }

  // --- Storage ---

  mapping(bytes32 workspaceId => Workspace) public workspaces;
  mapping(address wallet => Integrator) public integrators;

  uint256 private _workspaceNonce;
  uint256 private _integratorNonce;

  // --- Events ---

  event WorkspaceCreated(bytes32 indexed appId, address indexed admin, string name);
  event IntegratorJoined(bytes32 indexed workspaceAppId, bytes32 indexed integratorAppId, address indexed wallet, Role role);
  event IntegratorApproved(bytes32 indexed workspaceAppId, address indexed wallet);
  event IntegratorDeactivated(bytes32 indexed workspaceAppId, address indexed wallet);

  // --- Errors ---

  error WorkspaceNotFound(bytes32 workspaceId);
  error WorkspaceNotActive(bytes32 workspaceId);
  error AlreadyRegistered(address wallet);
  error NotWorkspaceAdmin(bytes32 workspaceId, address caller);
  error IntegratorNotFound(address wallet);
  error RequiresApproval(bytes32 workspaceId);

  constructor(address _owner) Ownable(_owner) {}

  // --- Workspace Management ---

  /// @notice Create a new workspace. Caller becomes the admin.
  /// @param name Human-readable workspace name.
  /// @param requiresApproval If true, integrators must be approved by admin after joining.
  /// @return appId The deterministic workspace APP-ID.
  function createWorkspace(string calldata name, bool requiresApproval) external returns (bytes32 appId) {
    appId = keccak256(abi.encodePacked("workspace", msg.sender, _workspaceNonce++));

    workspaces[appId] = Workspace({
      appId: appId,
      name: name,
      admin: msg.sender,
      active: true,
      requiresApproval: requiresApproval
    });

    // Register the admin as a PROTOCOL integrator in their own workspace
    bytes32 integratorAppId = keccak256(abi.encodePacked("integrator", msg.sender, _integratorNonce++));
    integrators[msg.sender] = Integrator({
      appId: integratorAppId,
      workspaceId: appId,
      role: Role.PROTOCOL,
      wallet: msg.sender,
      active: true
    });

    emit WorkspaceCreated(appId, msg.sender, name);
    emit IntegratorJoined(appId, integratorAppId, msg.sender, Role.PROTOCOL);
  }

  // --- Integrator Registration ---

  /// @notice Join an existing workspace as a broker or LP.
  /// @param workspaceId The workspace APP-ID to join.
  /// @param role BROKER or LP (not PROTOCOL - that's set at workspace creation).
  function joinWorkspace(bytes32 workspaceId, Role role) external returns (bytes32 integratorAppId) {
    Workspace storage ws = workspaces[workspaceId];
    if (ws.admin == address(0)) revert WorkspaceNotFound(workspaceId);
    if (!ws.active) revert WorkspaceNotActive(workspaceId);
    if (integrators[msg.sender].wallet != address(0)) revert AlreadyRegistered(msg.sender);

    integratorAppId = keccak256(abi.encodePacked("integrator", msg.sender, _integratorNonce++));

    integrators[msg.sender] = Integrator({
      appId: integratorAppId,
      workspaceId: workspaceId,
      role: role,
      wallet: msg.sender,
      active: !ws.requiresApproval // auto-active if no approval required
    });

    emit IntegratorJoined(workspaceId, integratorAppId, msg.sender, role);
  }

  /// @notice Approve a pending integrator (only workspace admin).
  function approveIntegrator(address wallet) external {
    Integrator storage integ = integrators[wallet];
    if (integ.wallet == address(0)) revert IntegratorNotFound(wallet);

    Workspace storage ws = workspaces[integ.workspaceId];
    if (ws.admin != msg.sender) revert NotWorkspaceAdmin(integ.workspaceId, msg.sender);

    integ.active = true;
    emit IntegratorApproved(integ.workspaceId, wallet);
  }

  /// @notice Deactivate an integrator (workspace admin or engine owner).
  function deactivateIntegrator(address wallet) external {
    Integrator storage integ = integrators[wallet];
    if (integ.wallet == address(0)) revert IntegratorNotFound(wallet);

    Workspace storage ws = workspaces[integ.workspaceId];
    if (ws.admin != msg.sender && owner() != msg.sender) {
      revert NotWorkspaceAdmin(integ.workspaceId, msg.sender);
    }

    integ.active = false;
    emit IntegratorDeactivated(integ.workspaceId, wallet);
  }

  // --- Views (read by CRE workflows) ---

  /// @notice Get integrator details for a wallet. Primary read function for CRE.
  function getIntegrator(address wallet) external view returns (
    bytes32 appId,
    bytes32 workspaceId,
    Role role,
    bool active
  ) {
    Integrator storage integ = integrators[wallet];
    return (integ.appId, integ.workspaceId, integ.role, integ.active);
  }

  /// @notice Get workspace details.
  function getWorkspace(bytes32 workspaceId) external view returns (
    string memory name,
    address admin,
    bool active,
    bool requiresApproval
  ) {
    Workspace storage ws = workspaces[workspaceId];
    return (ws.name, ws.admin, ws.active, ws.requiresApproval);
  }

  /// @notice Check if a wallet is a registered and active integrator.
  function isActive(address wallet) external view returns (bool) {
    return integrators[wallet].active;
  }

  /// @notice Check if a wallet is the admin of a workspace.
  function isWorkspaceAdmin(bytes32 workspaceId, address wallet) external view returns (bool) {
    return workspaces[workspaceId].admin == wallet;
  }
}
