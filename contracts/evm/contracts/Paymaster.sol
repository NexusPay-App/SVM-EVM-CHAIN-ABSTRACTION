pragma solidity ^0.8.20;

import "./interfaces/IUserOperation.sol";
import "./interfaces/IPaymaster.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title Paymaster
 * @dev ERC-4337 compatible paymaster with flexible policy engine
 */
contract Paymaster is IPaymaster, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Constants
    uint256 public constant STAKE_MINIMUM = 1 ether;
    uint256 public constant UNSTAKE_DELAY_SEC = 1 days;
    uint256 private constant VALID_TIMESTAMP_OFFSET = 20;
    uint256 private constant SIGNATURE_OFFSET = 84;

    // State variables
    address public immutable entryPoint;
    mapping(address => bool) public whitelist;
    mapping(address => uint256) public userSpendLimits;
    mapping(address => uint256) public userSpentAmounts;
    mapping(bytes32 => bool) public processedOperations;
    
    uint256 public globalSpendLimit = 10 ether;
    uint256 public totalSpent;
    bool public paymasterEnabled = true;

    // Events
    event UserOpSponsored(
        bytes32 indexed userOpHash,
        address indexed sender,
        uint256 actualGasCost
    );
    event WhitelistUpdated(address indexed user, bool whitelisted);
    event UserLimitUpdated(address indexed user, uint256 newLimit);
    event PaymasterConfigUpdated(uint256 newGlobalLimit, bool enabled);

    // Custom errors
    error OnlyEntryPoint();
    error PaymasterDisabled();
    error UserNotWhitelisted();
    error SpendLimitExceeded();
    error InvalidSignature();
    error OperationAlreadyProcessed();
    error PostOpReverted();

    /**
     * @dev Constructor
     * @param _entryPoint Address of the EntryPoint contract
     */
    constructor(address _entryPoint) Ownable(msg.sender) {
        entryPoint = _entryPoint;
    }

    /**
     * @dev Modifier to restrict access to EntryPoint
     */
    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert OnlyEntryPoint();
        _;
    }

    /**
     * @dev Validate paymaster user operation
     * @param userOp User operation to validate
     * @param userOpHash Hash of the user operation
     * @param maxCost Maximum cost that could be paid by this paymaster
     * @return context Paymaster context for post-operation
     * @return validationData Validation result
     */
    function validatePaymasterUserOp(
        IUserOperation.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override onlyEntryPoint returns (bytes memory context, uint256 validationData) {
        if (!paymasterEnabled) {
            revert PaymasterDisabled();
        }

        // Check if operation was already processed
        if (processedOperations[userOpHash]) {
            revert OperationAlreadyProcessed();
        }

        // Parse paymaster data
        (
            uint48 validUntil,
            uint48 validAfter,
            bytes memory signature
        ) = _parsePaymasterAndData(userOp.paymasterAndData);

        // Validate signature and timestamp
        if (!_validateSignature(userOp, userOpHash, signature)) {
            return ("", 1); // Signature validation failed
        }

        // Check time validity
        if (validUntil != 0 && block.timestamp > validUntil) {
            return ("", 1); // Time validation failed
        }
        if (validAfter != 0 && block.timestamp < validAfter) {
            return ("", 1); // Time validation failed
        }

        // Policy validation
        if (!_validatePolicy(userOp.sender, maxCost)) {
            return ("", 1); // Policy validation failed
        }

        // Mark operation as processed
        processedOperations[userOpHash] = true;

        // Update spending tracking
        userSpentAmounts[userOp.sender] += maxCost;
        totalSpent += maxCost;

        // Create context for post-operation
        context = abi.encode(
            userOp.sender,
            maxCost,
            userOpHash
        );

        // Pack validation data
        validationData = _packValidationData(false, validUntil, validAfter);
        
        return (context, validationData);
    }

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
    ) external override onlyEntryPoint {
        (address sender, uint256 maxCost, bytes32 userOpHash) = abi.decode(
            context,
            (address, uint256, bytes32)
        );

        if (mode == PostOpMode.postOpReverted) {
            revert PostOpReverted();
        }

        // Adjust spending amounts based on actual cost
        uint256 overspent = maxCost > actualGasCost ? maxCost - actualGasCost : 0;
        if (overspent > 0) {
            userSpentAmounts[sender] -= overspent;
            totalSpent -= overspent;
        }

        emit UserOpSponsored(userOpHash, sender, actualGasCost);
    }

    /**
     * @dev Parse paymaster and data field
     * @param paymasterAndData Packed paymaster data
     * @return validUntil Timestamp until which the operation is valid
     * @return validAfter Timestamp after which the operation is valid
     * @return signature Paymaster signature
     */
    function _parsePaymasterAndData(
        bytes calldata paymasterAndData
    ) internal pure returns (uint48 validUntil, uint48 validAfter, bytes memory signature) {
        if (paymasterAndData.length < SIGNATURE_OFFSET) {
            return (0, 0, "");
        }

        validUntil = uint48(bytes6(paymasterAndData[VALID_TIMESTAMP_OFFSET:VALID_TIMESTAMP_OFFSET + 6]));
        validAfter = uint48(bytes6(paymasterAndData[VALID_TIMESTAMP_OFFSET + 6:VALID_TIMESTAMP_OFFSET + 12]));
        signature = paymasterAndData[SIGNATURE_OFFSET:];
    }

    /**
     * @dev Validate paymaster signature
     * @param userOp User operation
     * @param userOpHash Hash of user operation
     * @param signature Paymaster signature
     * @return Whether signature is valid
     */
    function _validateSignature(
        IUserOperation.UserOperation calldata userOp,
        bytes32 userOpHash,
        bytes memory signature
    ) internal view returns (bool) {
        bytes32 hash = keccak256(abi.encode(
            userOpHash,
            userOp.sender,
            userOp.nonce
        )).toEthSignedMessageHash();
        
        address signer = hash.recover(signature);
        return signer == owner();
    }

    /**
     * @dev Validate spending policy
     * @param sender User address
     * @param cost Operation cost
     * @return Whether policy allows the operation
     */
    function _validatePolicy(address sender, uint256 cost) internal view returns (bool) {
        // Check whitelist
        if (!whitelist[sender]) {
            return false;
        }

        // Check user spending limit
        uint256 userLimit = userSpendLimits[sender];
        if (userLimit > 0 && userSpentAmounts[sender] + cost > userLimit) {
            return false;
        }

        // Check global spending limit
        if (totalSpent + cost > globalSpendLimit) {
            return false;
        }

        return true;
    }

    /**
     * @dev Pack validation data according to ERC-4337
     * @param sigFailed Whether signature validation failed
     * @param validUntil Valid until timestamp
     * @param validAfter Valid after timestamp
     * @return Packed validation data
     */
    function _packValidationData(
        bool sigFailed,
        uint48 validUntil,
        uint48 validAfter
    ) internal pure returns (uint256) {
        return uint256(validUntil) << 160 | uint256(validAfter) << 208 | (sigFailed ? 1 : 0);
    }

    // Admin functions
    
    /**
     * @dev Add or remove user from whitelist
     * @param user User address
     * @param whitelisted Whether to whitelist the user
     */
    function setWhitelist(address user, bool whitelisted) external onlyOwner {
        whitelist[user] = whitelisted;
        emit WhitelistUpdated(user, whitelisted);
    }

    /**
     * @dev Set spending limit for a user
     * @param user User address
     * @param limit New spending limit
     */
    function setUserSpendLimit(address user, uint256 limit) external onlyOwner {
        userSpendLimits[user] = limit;
        emit UserLimitUpdated(user, limit);
    }

    /**
     * @dev Update paymaster configuration
     * @param newGlobalLimit New global spending limit
     * @param enabled Whether paymaster is enabled
     */
    function updateConfig(uint256 newGlobalLimit, bool enabled) external onlyOwner {
        globalSpendLimit = newGlobalLimit;
        paymasterEnabled = enabled;
        emit PaymasterConfigUpdated(newGlobalLimit, enabled);
    }

    /**
     * @dev Reset spending amounts (emergency function)
     */
    function resetSpending() external onlyOwner {
        totalSpent = 0;
        // Note: Individual user spending amounts need to be reset individually if needed
    }

    /**
     * @dev Reset user spending amount
     * @param user User address
     */
    function resetUserSpending(address user) external onlyOwner {
        userSpentAmounts[user] = 0;
    }

    /**
     * @dev Withdraw ETH from paymaster
     * @param to Withdrawal address
     * @param amount Amount to withdraw
     */
    function withdraw(address payable to, uint256 amount) external onlyOwner nonReentrant {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success,) = to.call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    // View functions

    /**
     * @dev Get user spending information
     * @param user User address
     * @return limit User spending limit
     * @return spent Amount spent by user
     * @return isWhitelisted Whether user is whitelisted
     */
    function getUserInfo(address user) external view returns (
        uint256 limit,
        uint256 spent,
        bool isWhitelisted
    ) {
        return (userSpendLimits[user], userSpentAmounts[user], whitelist[user]);
    }

    /**
     * @dev Get paymaster statistics
     * @return totalLimit Global spending limit
     * @return totalSpentAmount Total amount spent
     * @return enabled Whether paymaster is enabled
     */
    function getPaymasterStats() external view returns (
        uint256 totalLimit,
        uint256 totalSpentAmount,
        bool enabled
    ) {
        return (globalSpendLimit, totalSpent, paymasterEnabled);
    }

    /**
     * @dev Deposit ETH to paymaster
     */
    function deposit() external payable {
        // ETH deposited for gas sponsorship
    }

    /**
     * @dev Receive ETH function
     */
    receive() external payable {
        // Accept ETH deposits
    }
} 