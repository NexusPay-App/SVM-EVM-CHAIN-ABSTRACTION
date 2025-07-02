// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IUserOperation.sol";

/**
 * @title IPaymaster
 * @dev Interface for ERC-4337 compatible paymasters
 */
interface IPaymaster {
    
    enum PostOpMode {
        opSucceeded, // user op succeeded
        opReverted,  // user op reverted. still has to pay for gas.
        postOpReverted //user op succeeded, but caused postOp to revert
    }

    /**
     * @dev Validate paymaster user operation
     * @param userOp User operation to validate
     * @param userOpHash Hash of the user operation
     * @param maxCost Maximum cost that could be paid by this paymaster
     * @return context Paymaster context for post-operation
     * @return validationData Validation result packed with valid time range
     */
    function validatePaymasterUserOp(
        IUserOperation.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    /**
     * @dev Post-operation hook called after user operation execution
     * @param mode Post-operation mode (opSucceeded, opReverted, postOpReverted)
     * @param context Context data from validatePaymasterUserOp
     * @param actualGasCost Actual gas cost of the operation
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external;

    // TODO: Add other necessary paymaster functions (e.g., withdraw, addStake)
} 