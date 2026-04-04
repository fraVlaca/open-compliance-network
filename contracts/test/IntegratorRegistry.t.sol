// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IntegratorRegistry} from "../src/registries/IntegratorRegistry.sol";

contract IntegratorRegistryTest is Test {
  IntegratorRegistry public registry;

  address public owner = address(0x1);
  address public protocolAdmin = address(0x10);
  address public broker = address(0x20);
  address public lp = address(0x30);

  function setUp() public {
    registry = new IntegratorRegistry(owner);
  }

  // --- Workspace Creation ---

  function test_createWorkspace() public {
    vm.prank(protocolAdmin);
    bytes32 appId = registry.createWorkspace("my-protocol", false);

    (string memory name, address admin, bool active, bool requiresApproval) = registry.getWorkspace(appId);
    assertEq(name, "my-protocol");
    assertEq(admin, protocolAdmin);
    assertTrue(active);
    assertFalse(requiresApproval);

    // Admin is auto-registered as PROTOCOL integrator
    (bytes32 intAppId, bytes32 wsId, IntegratorRegistry.Role role, bool intActive) =
      registry.getIntegrator(protocolAdmin);
    assertTrue(intAppId != bytes32(0));
    assertEq(wsId, appId);
    assertEq(uint8(role), uint8(IntegratorRegistry.Role.PROTOCOL));
    assertTrue(intActive);
  }

  function test_createWorkspace_emitsEvents() public {
    vm.prank(protocolAdmin);

    vm.expectEmit(false, true, false, true);
    emit IntegratorRegistry.WorkspaceCreated(bytes32(0), protocolAdmin, "test");

    registry.createWorkspace("test", false);
  }

  // --- Join Workspace ---

  function test_joinWorkspace_broker() public {
    vm.prank(protocolAdmin);
    bytes32 wsId = registry.createWorkspace("proto", false);

    vm.prank(broker);
    bytes32 brokerAppId = registry.joinWorkspace(wsId, IntegratorRegistry.Role.BROKER);

    (bytes32 appId, bytes32 workspaceId, IntegratorRegistry.Role role, bool active) =
      registry.getIntegrator(broker);
    assertEq(appId, brokerAppId);
    assertEq(workspaceId, wsId);
    assertEq(uint8(role), uint8(IntegratorRegistry.Role.BROKER));
    assertTrue(active); // auto-active (no approval required)
  }

  function test_joinWorkspace_lp() public {
    vm.prank(protocolAdmin);
    bytes32 wsId = registry.createWorkspace("proto", false);

    vm.prank(lp);
    registry.joinWorkspace(wsId, IntegratorRegistry.Role.LP);

    (, , IntegratorRegistry.Role role, bool active) = registry.getIntegrator(lp);
    assertEq(uint8(role), uint8(IntegratorRegistry.Role.LP));
    assertTrue(active);
  }

  function test_joinWorkspace_requiresApproval() public {
    vm.prank(protocolAdmin);
    bytes32 wsId = registry.createWorkspace("gated-proto", true);

    vm.prank(broker);
    registry.joinWorkspace(wsId, IntegratorRegistry.Role.BROKER);

    (, , , bool active) = registry.getIntegrator(broker);
    assertFalse(active); // pending approval
  }

  function test_joinWorkspace_revertsIfAlreadyRegistered() public {
    vm.prank(protocolAdmin);
    bytes32 wsId = registry.createWorkspace("proto", false);

    vm.prank(broker);
    registry.joinWorkspace(wsId, IntegratorRegistry.Role.BROKER);

    vm.prank(broker);
    vm.expectRevert(abi.encodeWithSelector(IntegratorRegistry.AlreadyRegistered.selector, broker));
    registry.joinWorkspace(wsId, IntegratorRegistry.Role.LP);
  }

  function test_joinWorkspace_revertsIfWorkspaceNotFound() public {
    bytes32 fakeWs = keccak256("fake");
    vm.prank(broker);
    vm.expectRevert(abi.encodeWithSelector(IntegratorRegistry.WorkspaceNotFound.selector, fakeWs));
    registry.joinWorkspace(fakeWs, IntegratorRegistry.Role.BROKER);
  }

  // --- Approval ---

  function test_approveIntegrator() public {
    vm.prank(protocolAdmin);
    bytes32 wsId = registry.createWorkspace("gated", true);

    vm.prank(broker);
    registry.joinWorkspace(wsId, IntegratorRegistry.Role.BROKER);

    (, , , bool activeBefore) = registry.getIntegrator(broker);
    assertFalse(activeBefore);

    vm.prank(protocolAdmin);
    registry.approveIntegrator(broker);

    (, , , bool activeAfter) = registry.getIntegrator(broker);
    assertTrue(activeAfter);
  }

  function test_approveIntegrator_revertsIfNotAdmin() public {
    vm.prank(protocolAdmin);
    bytes32 wsId = registry.createWorkspace("gated", true);

    vm.prank(broker);
    registry.joinWorkspace(wsId, IntegratorRegistry.Role.BROKER);

    vm.prank(address(0xBAD));
    vm.expectRevert(abi.encodeWithSelector(IntegratorRegistry.NotWorkspaceAdmin.selector, wsId, address(0xBAD)));
    registry.approveIntegrator(broker);
  }

  // --- Deactivation ---

  function test_deactivateIntegrator_byAdmin() public {
    vm.prank(protocolAdmin);
    bytes32 wsId = registry.createWorkspace("proto", false);

    vm.prank(broker);
    registry.joinWorkspace(wsId, IntegratorRegistry.Role.BROKER);

    vm.prank(protocolAdmin);
    registry.deactivateIntegrator(broker);

    assertFalse(registry.isActive(broker));
  }

  function test_deactivateIntegrator_byOwner() public {
    vm.prank(protocolAdmin);
    bytes32 wsId = registry.createWorkspace("proto", false);

    vm.prank(broker);
    registry.joinWorkspace(wsId, IntegratorRegistry.Role.BROKER);

    vm.prank(owner); // engine owner, not workspace admin
    registry.deactivateIntegrator(broker);

    assertFalse(registry.isActive(broker));
  }

  // --- Views ---

  function test_isActive() public {
    assertFalse(registry.isActive(address(0xDEAD))); // unregistered

    vm.prank(protocolAdmin);
    registry.createWorkspace("proto", false);
    assertTrue(registry.isActive(protocolAdmin)); // auto-registered
  }

  function test_isWorkspaceAdmin() public {
    vm.prank(protocolAdmin);
    bytes32 wsId = registry.createWorkspace("proto", false);

    assertTrue(registry.isWorkspaceAdmin(wsId, protocolAdmin));
    assertFalse(registry.isWorkspaceAdmin(wsId, broker));
  }

  // --- Multiple workspaces ---

  function test_multipleWorkspaces_isolatedScoping() public {
    vm.prank(protocolAdmin);
    bytes32 ws1 = registry.createWorkspace("proto-1", false);

    address protocolAdmin2 = address(0x11);
    vm.prank(protocolAdmin2);
    bytes32 ws2 = registry.createWorkspace("proto-2", false);

    assertTrue(ws1 != ws2);

    // Broker joins ws1
    vm.prank(broker);
    registry.joinWorkspace(ws1, IntegratorRegistry.Role.BROKER);

    (, bytes32 brokerWs, , ) = registry.getIntegrator(broker);
    assertEq(brokerWs, ws1);

    // LP joins ws2
    vm.prank(lp);
    registry.joinWorkspace(ws2, IntegratorRegistry.Role.LP);

    (, bytes32 lpWs, , ) = registry.getIntegrator(lp);
    assertEq(lpWs, ws2);
  }
}
