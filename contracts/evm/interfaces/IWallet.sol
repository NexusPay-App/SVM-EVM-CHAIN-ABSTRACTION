pragma solidity ^0.8.0;

import "./IUserOperation.sol";

interface IWallet {
    function validateUserOp(
        IUserOperation.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);

    function execute(address dest, uint256 value, bytes calldata func) external;
    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external;

    // TODO: Add other necessary wallet functions (e.g., fallback, token recovery)
} 