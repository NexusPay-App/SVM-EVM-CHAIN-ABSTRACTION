// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IUserOperation.sol";

/**
 * @title IWallet
 * @dev Interface for ERC-4337 compatible smart wallets
 */
interface IWallet {
    /**
     * @dev Validate user operation signature and nonce
     * @param userOp User operation to validate
     * @param userOpHash Hash of the user operation
     * @param missingAccountFunds Amount of ETH needed for gas payment
     * @return validationData Validation result (0 = success, 1 = failure)
     */
    function validateUserOp(
        IUserOperation.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);

    /**
     * @dev Execute a transaction from this wallet
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Call data to execute
     * @return success Whether the execution was successful
     */
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external returns (bool success);

    /**
     * @dev Execute multiple transactions in a batch
     * @param targets Array of target addresses
     * @param values Array of ETH values
     * @param data Array of call data
     * @return successes Array of success status for each call
     */
    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata data
    ) external returns (bool[] memory successes);

    /**
     * @dev Get the current nonce for this wallet
     * @return Current nonce value
     */
    function getNonce() external view returns (uint256);

    // TODO: Add other necessary wallet functions (e.g., fallback, token recovery)
} 