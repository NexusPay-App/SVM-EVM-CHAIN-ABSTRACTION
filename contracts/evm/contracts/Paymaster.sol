// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces/IPaymaster.sol";
import "./interfaces/IUserOperation.sol";

/**
 * @title NexusPay Paymaster
 * @dev EIP-4337 compliant paymaster contract that sponsors gas fees for user transactions
 */
contract Paymaster is IPaymaster {

    address public entryPoint;
    address public owner;
    mapping(address => bool) public authorizedSpenders;
    mapping(address => uint256) public spendingLimits; // Per-address daily spending limits
    mapping(address => uint256) public dailySpent; // Track daily spending per address
    mapping(address => uint256) public lastResetDay; // Track last reset day for spending limits
    
    uint256 public totalDeposit;
    uint256 public totalSpent;
    bool public paused;
    bool private initialized;

    event PaymasterDeposit(address indexed sender, uint256 amount);
    event PaymasterWithdraw(address indexed recipient, uint256 amount);
    event UserOperationSponsored(address indexed sender, uint256 actualGasCost);
    event SpendingLimitSet(address indexed spender, uint256 limit);
    event AuthorizedSpenderAdded(address indexed spender);
    event AuthorizedSpenderRemoved(address indexed spender);
    event PaymasterPaused();
    event PaymasterUnpaused();

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyEntryPoint() {
        require(msg.sender == address(entryPoint), "Only EntryPoint");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Paymaster is paused");
        _;
    }

    constructor() {
        // Disable initializers for implementation contract
        initialized = true;
    }

    /**
     * @notice Initialize the paymaster (for proxy contracts)
     * @param _entryPoint EntryPoint contract address
     * @param _owner Owner of the paymaster
     */
    function initialize(address _entryPoint, address _owner) external {
        require(!initialized, "Already initialized");
        require(_entryPoint != address(0), "Invalid entryPoint");
        require(_owner != address(0), "Invalid owner");
        
        initialized = true;
        entryPoint = _entryPoint;
        owner = _owner;
        paused = false;
    }

    /**
     * @dev Validate paymaster user operation (EIP-4337)
     * @param userOp The user operation to validate
     * @param userOpHash Hash of the user operation
     * @param maxCost Maximum cost that can be charged
     * @return context Data to be passed to postOp
     * @return validationData Packed validation data (authorizer, validUntil, validAfter)
     */
    function validatePaymasterUserOp(
        IUserOperation.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external override onlyEntryPoint whenNotPaused returns (bytes memory context, uint256 validationData) {
        // Basic validation - check if we have enough deposit
        require(getDeposit() >= maxCost, "Insufficient deposit");
        
        address sender = userOp.sender;
        
        // Check if sender is authorized (optional - can be set to allow all)
        bool isAuthorized = authorizedSpenders[sender] || authorizedSpenders[address(0)]; // address(0) means allow all
        require(isAuthorized, "Sender not authorized");
        
        // Check spending limits
        uint256 currentDay = block.timestamp / 1 days;
        if (lastResetDay[sender] < currentDay) {
            dailySpent[sender] = 0;
            lastResetDay[sender] = currentDay;
        }
        
        uint256 limit = spendingLimits[sender];
        if (limit > 0) {
            require(dailySpent[sender] + maxCost <= limit, "Daily spending limit exceeded");
        }

        // Return success validation
        return (abi.encode(sender, maxCost), 0);
    }

    /**
     * @dev Post-operation handler (EIP-4337)
     * @param mode Whether the operation succeeded or reverted
     * @param context Data from validatePaymasterUserOp
     * @param actualGasCost Actual gas cost paid
     */
    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external override onlyEntryPoint {
        (address sender, uint256 maxCost) = abi.decode(context, (address, uint256));
        
        // Update spending tracking
        dailySpent[sender] += actualGasCost;
        totalSpent += actualGasCost;
        
        emit UserOperationSponsored(sender, actualGasCost);
        
        // Handle failed operations if needed
        if (mode == PostOpMode.postOpReverted) {
            // Could implement refund logic here
        }
    }

    /**
     * @dev Deposit funds to the paymaster
     */
    function deposit() public payable {
        require(msg.value > 0, "Must deposit some ETH");
        (bool success,) = entryPoint.call{value: msg.value}(abi.encodeWithSignature("depositTo(address)", address(this)));
        totalDeposit += msg.value;
        emit PaymasterDeposit(msg.sender, msg.value);
    }

    /**
     * @dev Get current deposit balance
     */
    function getDeposit() public view returns (uint256) {
        (bool success, bytes memory data) = entryPoint.staticcall(abi.encodeWithSignature("balanceOf(address)", address(this)));
        if (success && data.length >= 32) {
            return abi.decode(data, (uint256));
        }
        return 0;
    }

    /**
     * @dev Withdraw funds from the paymaster (owner only)
     * @param recipient Address to receive the funds
     * @param amount Amount to withdraw
     */
    function withdraw(address payable recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount <= getDeposit(), "Insufficient balance");
        
        (bool success,) = entryPoint.call(abi.encodeWithSignature("withdrawTo(address,uint256)", recipient, amount));
        require(success, "EntryPoint withdraw failed");
        emit PaymasterWithdraw(recipient, amount);
    }

    /**
     * @dev Add stake to EntryPoint (required for paymaster operation)
     * @param unstakeDelay Delay before stake can be withdrawn
     */
    function addStake(uint32 unstakeDelay) external payable onlyOwner {
        (bool success,) = entryPoint.call{value: msg.value}(abi.encodeWithSignature("addStake(uint32)", unstakeDelay));
        require(success, "EntryPoint addStake failed");
    }

    /**
     * @dev Unlock stake (first step of withdrawal)
     */
    function unlockStake() external onlyOwner {
        (bool success,) = entryPoint.call(abi.encodeWithSignature("unlockStake()"));
        require(success, "EntryPoint unlockStake failed");
    }

    /**
     * @dev Withdraw stake (after unlock delay)
     * @param recipient Address to receive the stake
     */
    function withdrawStake(address payable recipient) external onlyOwner {
        (bool success,) = entryPoint.call(abi.encodeWithSignature("withdrawStake(address)", recipient));
        require(success, "EntryPoint withdrawStake failed");
    }

    /**
     * @dev Set spending limit for an address
     * @param spender Address to set limit for
     * @param limit Daily spending limit (0 = no limit)
     */
    function setSpendingLimit(address spender, uint256 limit) external onlyOwner {
        spendingLimits[spender] = limit;
        emit SpendingLimitSet(spender, limit);
    }

    /**
     * @dev Add authorized spender
     * @param spender Address to authorize (use address(0) to allow all)
     */
    function addAuthorizedSpender(address spender) external onlyOwner {
        authorizedSpenders[spender] = true;
        emit AuthorizedSpenderAdded(spender);
    }

    /**
     * @dev Remove authorized spender
     * @param spender Address to remove authorization
     */
    function removeAuthorizedSpender(address spender) external onlyOwner {
        authorizedSpenders[spender] = false;
        emit AuthorizedSpenderRemoved(spender);
    }

    /**
     * @dev Pause the paymaster
     */
    function pause() external onlyOwner {
        paused = true;
        emit PaymasterPaused();
    }

    /**
     * @dev Unpause the paymaster
     */
    function unpause() external onlyOwner {
        paused = false;
        emit PaymasterUnpaused();
    }

    /**
     * @dev Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }

    /**
     * @dev Get paymaster statistics
     */
    function getStats() external view returns (
        uint256 currentDeposit,
        uint256 totalDeposited,
        uint256 totalSpentAmount,
        bool isPaused,
        uint256 stakInfo
    ) {
        return (
            getDeposit(),
            totalDeposit,
            totalSpent,
            paused,
            0 // Simplified - would need to call getDepositInfo on EntryPoint
        );
    }

    /**
     * @dev Emergency withdraw (in case of contract issues)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = getDeposit();
        if (balance > 0) {
            (bool success,) = entryPoint.call(abi.encodeWithSignature("withdrawTo(address,uint256)", payable(owner), balance));
            require(success, "Emergency withdraw failed");
        }
    }

    /**
     * @dev Receive ETH and automatically deposit to EntryPoint
     */
    receive() external payable {
        if (msg.value > 0) {
            deposit();
        }
    }

    /**
     * @dev Fallback function
     */
    fallback() external payable {
        revert("Function not found");
    }
} 