pragma solidity ^0.8.0;

import "../interfaces/IUserOperation.sol";

library UserOperationLib {
    function getUserOpHash(
        IUserOperation.UserOperation calldata userOp,
        address entryPoint,
        uint256 chainId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            userOp.sender,
            userOp.nonce,
            keccak256(userOp.initCode),
            keccak256(userOp.callData),
            userOp.callGasLimit,
            userOp.verificationGasLimit,
            userOp.preVerificationGas,
            userOp.maxFeePerGas,
            userOp.maxPriorityFeePerGas,
            keccak256(userOp.paymasterAndData),
            keccak256(userOp.signature),
            entryPoint,
            chainId
        ));
    }
} 