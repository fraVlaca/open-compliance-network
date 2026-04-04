// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EmitEvent {
    event ComplianceCheckRequested(
        bytes32 indexed tradeId, address indexed trader, address counterparty, address asset, uint256 amount
    );

    function emitCheck(address counterparty, address asset, uint256 amount) external {
        bytes32 tradeId = keccak256(abi.encodePacked(msg.sender, counterparty, asset, amount, block.timestamp));
        emit ComplianceCheckRequested(tradeId, msg.sender, counterparty, asset, amount);
    }
}
