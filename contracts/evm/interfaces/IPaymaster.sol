pragma solidity ^0.8.0;

import "./IUserOperation.sol";

interface IPaymaster {
    function validatePaymasterUserOp(
        IUserOperation.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (bytes validationData);

    // TODO: Add other necessary paymaster functions (e.g., withdraw, addStake)
} 