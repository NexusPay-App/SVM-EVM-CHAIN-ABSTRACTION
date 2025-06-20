// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IUserOperation
 * @dev Interface defining the UserOperation structure for ERC-4337
 */
interface IUserOperation {
    /**
     * @dev User operation structure for ERC-4337 account abstraction
     */
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }

    struct ValidationResult {
        uint256 preOpGas;
        uint256 prefund;
        bool sigFailed;
        uint48 validAfter;
        uint48 validUntil;
        bytes paymasterContext;
    }
} 