// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ComplianceReportConsumer} from "../src/consumers/ComplianceReportConsumer.sol";
import {IReceiver} from "@chainlink/contracts/src/v0.8/keystone/interfaces/IReceiver.sol";

contract ComplianceReportConsumerTest is Test {
  ComplianceReportConsumer public consumer;

  address public owner = address(0x1);
  address public keystoneForwarder = address(0x2);
  bytes32 public workflowId = keccak256("per-trade-workflow");
  address public workflowOwner = address(0x3);

  address public trader = address(0xA);
  address public counterparty = address(0xB);

  function setUp() public {
    consumer = new ComplianceReportConsumer(keystoneForwarder, workflowId, workflowOwner, owner);
  }

  function _buildMetadata(bytes32 _workflowId, address _workflowOwner) internal pure returns (bytes memory) {
    bytes10 workflowName = bytes10("trade-chk");
    bytes2 reportName = bytes2("01");
    return abi.encodePacked(_workflowId, workflowName, _workflowOwner, reportName);
  }

  function _buildReport(
    bytes32 tradeId,
    address _trader,
    address _counterparty,
    bool approved,
    uint8 riskScore,
    bytes32 auditHash
  ) internal view returns (bytes memory) {
    ComplianceReportConsumer.ComplianceReport memory r = ComplianceReportConsumer.ComplianceReport({
      tradeId: tradeId,
      trader: _trader,
      counterparty: _counterparty,
      sourceContract: address(0),
      approved: approved,
      riskScore: riskScore,
      auditHash: auditHash,
      ipfsCid: "",
      timestamp: block.timestamp
    });
    return abi.encode(r);
  }

  function test_onReport_storesReport() public {
    bytes32 tradeId = keccak256("trade-1");
    bytes32 auditHash = keccak256("audit-data");
    bytes memory metadata = _buildMetadata(workflowId, workflowOwner);
    bytes memory report = _buildReport(tradeId, trader, counterparty, true, 2, auditHash);

    vm.prank(keystoneForwarder);
    consumer.onReport(metadata, report);

    assertTrue(consumer.isApproved(tradeId));
    assertTrue(consumer.hasReport(tradeId));
    assertEq(consumer.getAuditHash(tradeId), auditHash);

    ComplianceReportConsumer.ComplianceReport memory stored = consumer.getReport(tradeId);
    assertEq(stored.trader, trader);
    assertEq(stored.counterparty, counterparty);
    assertTrue(stored.approved);
    assertEq(stored.riskScore, 2);
  }

  function test_onReport_rejectedTrade() public {
    bytes32 tradeId = keccak256("trade-rejected");
    bytes memory metadata = _buildMetadata(workflowId, workflowOwner);
    bytes memory report = _buildReport(tradeId, trader, counterparty, false, 8, keccak256("audit"));

    vm.prank(keystoneForwarder);
    consumer.onReport(metadata, report);

    assertFalse(consumer.isApproved(tradeId));
    assertTrue(consumer.hasReport(tradeId));
  }

  function test_onReport_emitsEvent() public {
    bytes32 tradeId = keccak256("trade-event");
    bytes32 auditHash = keccak256("audit");
    bytes memory metadata = _buildMetadata(workflowId, workflowOwner);
    bytes memory report = _buildReport(tradeId, trader, counterparty, true, 1, auditHash);

    vm.expectEmit(true, true, false, true);
    emit ComplianceReportConsumer.ComplianceCheckCompleted(tradeId, trader, true, 1, auditHash);

    vm.prank(keystoneForwarder);
    consumer.onReport(metadata, report);
  }

  function test_onReport_revertsOnDuplicate() public {
    bytes32 tradeId = keccak256("trade-dup");
    bytes memory metadata = _buildMetadata(workflowId, workflowOwner);
    bytes memory report = _buildReport(tradeId, trader, counterparty, true, 1, keccak256("audit"));

    vm.prank(keystoneForwarder);
    consumer.onReport(metadata, report);

    vm.prank(keystoneForwarder);
    vm.expectRevert(abi.encodeWithSelector(ComplianceReportConsumer.ReportAlreadyExists.selector, tradeId));
    consumer.onReport(metadata, report);
  }

  function test_onReport_revertsIfNotForwarder() public {
    bytes memory metadata = _buildMetadata(workflowId, workflowOwner);
    bytes memory report = _buildReport(keccak256("t"), trader, counterparty, true, 1, keccak256("a"));

    vm.prank(address(0xBAD));
    vm.expectRevert(abi.encodeWithSelector(ComplianceReportConsumer.UnauthorizedForwarder.selector, address(0xBAD)));
    consumer.onReport(metadata, report);
  }

  function test_isApproved_returnsFalseForUnknownTrade() public view {
    assertFalse(consumer.isApproved(keccak256("nonexistent")));
  }

  function test_supportsInterface() public view {
    assertTrue(consumer.supportsInterface(type(IReceiver).interfaceId));
  }
}
