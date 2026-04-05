// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockEURC - Euro Coin mock for Arc Testnet demo
contract MockEURC is ERC20 {
    constructor() ERC20("Euro Coin", "EURC") {
        _mint(msg.sender, 1_000_000 * 1e6); // 1M EURC
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Faucet - anyone can mint for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
