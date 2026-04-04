// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IExtractor} from "@chainlink/policy-management/interfaces/IExtractor.sol";
import {IPolicyEngine} from "@chainlink/policy-management/interfaces/IPolicyEngine.sol";

/// @title SwapExtractor
/// @notice Extracts trader and counterparty addresses from swap function calls
///         so that the ACE PolicyEngine can pass them to credential validation policies.
contract SwapExtractor is IExtractor {
  string public constant override typeAndVersion = "SwapExtractor 1.0.0";

  bytes32 public constant PARAM_FROM = keccak256("from");
  bytes32 public constant PARAM_TO = keccak256("to");
  bytes32 public constant PARAM_AMOUNT = keccak256("amount");

  // Selectors matching DemoSwapProtocol / EscrowSwap functions
  bytes4 public constant SWAP_SIMPLE_SELECTOR = bytes4(keccak256("swapSimple(address,address,uint256)"));
  bytes4 public constant SWAP_ACE_SELECTOR = bytes4(keccak256("swapACE(address,address,uint256)"));
  bytes4 public constant SWAP_SELECTOR = bytes4(keccak256("swap(address,address,uint256)"));

  function extract(IPolicyEngine.Payload calldata payload) public pure returns (IPolicyEngine.Parameter[] memory) {
    if (
      payload.selector == SWAP_SIMPLE_SELECTOR || payload.selector == SWAP_ACE_SELECTOR
        || payload.selector == SWAP_SELECTOR
    ) {
      (address counterparty,, uint256 amount) = abi.decode(payload.data, (address, address, uint256));

      IPolicyEngine.Parameter[] memory result = new IPolicyEngine.Parameter[](3);
      result[0] = IPolicyEngine.Parameter(PARAM_FROM, abi.encode(payload.sender));
      result[1] = IPolicyEngine.Parameter(PARAM_TO, abi.encode(counterparty));
      result[2] = IPolicyEngine.Parameter(PARAM_AMOUNT, abi.encode(amount));
      return result;
    }

    revert IPolicyEngine.UnsupportedSelector(payload.selector);
  }
}
