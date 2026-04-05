// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IComplianceCredentialConsumer} from "../interfaces/IComplianceCredentialConsumer.sol";
import {IComplianceCallback} from "../interfaces/IComplianceCallback.sol";

/// @title EscrowSwap
/// @notice A simple USDC escrow-based swap for the Arc Testnet hackathon demo.
///         Demonstrates compliance integration with real token transfers:
///
///   Pattern 1 (swapSimple): Maker creates order → taker fills immediately
///           with synchronous isVerified() check on both sides.
///
///   Pattern 3 (swap): Maker creates order → taker fills → emits event →
///           CRE runs per-trade compliance → auto-callback executes or rejects.
contract EscrowSwap is IComplianceCallback {
  using SafeERC20 for IERC20;

  // --- Types ---

  struct Order {
    address maker;
    address taker; // address(0) = open to any taker
    address tokenIn; // token maker deposits
    address tokenOut; // token taker deposits
    uint256 amountIn;
    uint256 amountOut;
    uint256 createdAt;
    OrderStatus status;
  }

  enum OrderStatus {
    None,
    Open, // maker deposited, waiting for taker
    PendingCompliance, // taker matched, waiting for CRE approval
    Filled, // completed
    Cancelled, // maker cancelled
    Rejected // CRE rejected the trade
  }

  // --- Storage ---

  IComplianceCredentialConsumer public complianceConsumer;
  address public reportConsumer; // ComplianceReportConsumer that calls back
  mapping(bytes32 orderId => Order) public orders;
  mapping(bytes32 orderId => address) public pendingTakers; // taker for orders in PendingCompliance

  uint256 private _nonce;

  // --- Events ---

  event OrderCreated(bytes32 indexed orderId, address indexed maker, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
  event OrderFilled(bytes32 indexed orderId, address indexed maker, address indexed taker);
  event OrderCancelled(bytes32 indexed orderId);
  event OrderRejected(bytes32 indexed orderId, string reason);

  /// @notice Emitted to trigger CRE Workflow B (per-trade compliance)
  event ComplianceCheckRequested(
    bytes32 indexed tradeId, address indexed trader, address counterparty, address asset, uint256 amount
  );

  // --- Errors ---

  error NotVerified(address wallet);
  error OrderNotFound(bytes32 orderId);
  error OrderNotOpen(bytes32 orderId);
  error OrderNotPending(bytes32 orderId);
  error NotMaker(bytes32 orderId);
  error NotReportConsumer();
  error InvalidTaker(bytes32 orderId);

  constructor(address _complianceConsumer, address _reportConsumer) {
    complianceConsumer = IComplianceCredentialConsumer(_complianceConsumer);
    reportConsumer = _reportConsumer;
  }

  // =========================================================================
  // Pattern 1: Synchronous compliance check (isVerified on both sides)
  // =========================================================================

  /// @notice Create an order. Maker deposits tokenIn. Requires KYC.
  function createOrder(
    address taker,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 amountOut
  ) external returns (bytes32 orderId) {
    if (!complianceConsumer.isVerified(msg.sender)) revert NotVerified(msg.sender);

    orderId = keccak256(abi.encodePacked(msg.sender, _nonce++, block.timestamp));

    orders[orderId] = Order({
      maker: msg.sender,
      taker: taker,
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      amountIn: amountIn,
      amountOut: amountOut,
      createdAt: block.timestamp,
      status: OrderStatus.Open
    });

    IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

    emit OrderCreated(orderId, msg.sender, tokenIn, tokenOut, amountIn, amountOut);
  }

  /// @notice Fill an order with synchronous compliance check. Taker deposits tokenOut.
  function fillOrder(bytes32 orderId) external {
    Order storage order = orders[orderId];
    if (order.status != OrderStatus.Open) revert OrderNotOpen(orderId);
    if (order.taker != address(0) && order.taker != msg.sender) revert InvalidTaker(orderId);
    if (!complianceConsumer.isVerified(msg.sender)) revert NotVerified(msg.sender);

    order.status = OrderStatus.Filled;

    // Taker sends tokenOut to maker
    IERC20(order.tokenOut).safeTransferFrom(msg.sender, order.maker, order.amountOut);
    // Maker's escrowed tokenIn goes to taker
    IERC20(order.tokenIn).safeTransfer(msg.sender, order.amountIn);

    emit OrderFilled(orderId, order.maker, msg.sender);
  }

  // =========================================================================
  // Pattern 3: Async compliance (CRE per-trade check + auto-callback)
  // =========================================================================

  /// @notice Fill an order with async per-trade compliance. Taker deposits tokenOut
  ///         into escrow. CRE runs checks. If approved, auto-callback settles.
  function fillOrderAsync(bytes32 orderId) external {
    Order storage order = orders[orderId];
    if (order.status != OrderStatus.Open) revert OrderNotOpen(orderId);
    if (order.taker != address(0) && order.taker != msg.sender) revert InvalidTaker(orderId);

    order.status = OrderStatus.PendingCompliance;
    pendingTakers[orderId] = msg.sender;

    // Taker deposits tokenOut into escrow (held until compliance decision)
    IERC20(order.tokenOut).safeTransferFrom(msg.sender, address(this), order.amountOut);

    // Emit event for CRE Workflow B
    emit ComplianceCheckRequested(orderId, msg.sender, order.maker, order.tokenIn, order.amountIn);
  }

  // =========================================================================
  // IComplianceCallback - auto-called by ComplianceReportConsumer
  // =========================================================================

  function onComplianceApproved(bytes32 tradeId) external override {
    if (msg.sender != reportConsumer) revert NotReportConsumer();

    Order storage order = orders[tradeId];
    if (order.status != OrderStatus.PendingCompliance) revert OrderNotPending(tradeId);

    address taker = pendingTakers[tradeId];
    order.status = OrderStatus.Filled;
    delete pendingTakers[tradeId];

    // Settle: taker's escrowed tokenOut → maker, maker's escrowed tokenIn → taker
    IERC20(order.tokenOut).safeTransfer(order.maker, order.amountOut);
    IERC20(order.tokenIn).safeTransfer(taker, order.amountIn);

    emit OrderFilled(tradeId, order.maker, taker);
  }

  function onComplianceRejected(bytes32 tradeId, string calldata reason) external override {
    if (msg.sender != reportConsumer) revert NotReportConsumer();

    Order storage order = orders[tradeId];
    if (order.status != OrderStatus.PendingCompliance) revert OrderNotPending(tradeId);

    address taker = pendingTakers[tradeId];
    order.status = OrderStatus.Rejected;
    delete pendingTakers[tradeId];

    // Refund: return taker's escrowed tokenOut, return maker's escrowed tokenIn
    IERC20(order.tokenOut).safeTransfer(taker, order.amountOut);
    IERC20(order.tokenIn).safeTransfer(order.maker, order.amountIn);

    emit OrderRejected(tradeId, reason);
  }

  // =========================================================================
  // Order management
  // =========================================================================

  /// @notice Cancel an open order. Only the maker can cancel.
  function cancelOrder(bytes32 orderId) external {
    Order storage order = orders[orderId];
    if (order.status != OrderStatus.Open) revert OrderNotOpen(orderId);
    if (order.maker != msg.sender) revert NotMaker(orderId);

    order.status = OrderStatus.Cancelled;

    // Return maker's escrowed tokenIn
    IERC20(order.tokenIn).safeTransfer(msg.sender, order.amountIn);

    emit OrderCancelled(orderId);
  }
}
