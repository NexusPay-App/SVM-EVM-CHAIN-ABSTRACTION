pragma solidity ^0.8.20;

import "../interfaces/IUserOperation.sol";

/**
 * @title UserOperationLib
 * @dev Utility library for UserOperation hashing and validation
 */
library UserOperationLib {
    
    /**
     * @dev Calculate hash of UserOperation for signing and validation
     * @param userOp The user operation to hash
     * @param entryPoint The entry point address
     * @param chainId The chain ID
     * @return Hash of the user operation
     */
    function hash(
        IUserOperation.UserOperation memory userOp,
        address entryPoint,
        uint256 chainId
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(pack(userOp), entryPoint, chainId));
    }

    /**
     * @dev Pack user operation for hashing (excluding signature)
     * @param userOp The user operation to pack
     * @return Packed user operation data
     */
    function pack(IUserOperation.UserOperation memory userOp) internal pure returns (bytes32) {
        address paymaster;
        uint256 paymasterVerificationGasLimit;
        uint256 paymasterPostOpGasLimit;
        bytes memory paymasterData;
        
        if (userOp.paymasterAndData.length == 0) {
            paymaster = address(0);
            paymasterVerificationGasLimit = 0;
            paymasterPostOpGasLimit = 0;
            paymasterData = "";
        } else {
            // Extract paymaster address (first 20 bytes)
            bytes memory paymasterAndData = userOp.paymasterAndData;
            assembly {
                paymaster := mload(add(paymasterAndData, 20))
            }
            
            // Extract verification gas limit (bytes 20-52)
            if (paymasterAndData.length >= 52) {
                assembly {
                    paymasterVerificationGasLimit := mload(add(paymasterAndData, 52))
            }
            }
            
            // Extract post-op gas limit (bytes 52-84)  
            if (paymasterAndData.length >= 84) {
                assembly {
                    paymasterPostOpGasLimit := mload(add(paymasterAndData, 84))
                }
            }
            
            // Extract remaining data (after byte 84)
            if (paymasterAndData.length > 84) {
                paymasterData = new bytes(paymasterAndData.length - 84);
                for (uint256 i = 0; i < paymasterData.length; i++) {
                    paymasterData[i] = paymasterAndData[i + 84];
                }
            }
        }

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
            paymaster,
            paymasterVerificationGasLimit,
            paymasterPostOpGasLimit,
            keccak256(paymasterData)
        ));
    }

    /**
     * @dev Get request ID for tracking
     * @param userOp The user operation
     * @return Request ID
     */
    function getRequestId(IUserOperation.UserOperation memory userOp) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(userOp.sender, userOp.nonce)));
    }

    /**
     * @dev Validate UserOperation structure
     * @param userOp The user operation to validate
     * @return True if valid structure
     */
    function validateStructure(IUserOperation.UserOperation memory userOp) internal pure returns (bool) {
        return userOp.sender != address(0) &&
               userOp.callGasLimit > 0 &&
               userOp.verificationGasLimit > 0 &&
               userOp.maxFeePerGas > 0;
    }

    /**
     * @dev Get gas price for operation
     * @param userOp The user operation
     * @return Effective gas price
     */
    function gasPrice(IUserOperation.UserOperation memory userOp) internal view returns (uint256) {
        unchecked {
            uint256 baseFee = block.basefee;
            uint256 priorityFee = userOp.maxPriorityFeePerGas;
            uint256 maxFee = userOp.maxFeePerGas;
            
            if (maxFee == priorityFee) {
                // Legacy gas pricing
                return maxFee;
            }
            
            return min(maxFee, baseFee + priorityFee);
        }
    }

    /**
     * @dev Helper function to get minimum of two values
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }
} 