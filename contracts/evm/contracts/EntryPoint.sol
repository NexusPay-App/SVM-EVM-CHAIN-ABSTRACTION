pragma solidity ^0.8.20;

import "./interfaces/IUserOperation.sol";
import "./interfaces/IWallet.sol";
import "./interfaces/IPaymaster.sol";
import "./utils/UserOperationLib.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title EntryPoint
 * @dev Main entry point for ERC-4337 Account Abstraction
 * Handles UserOperation validation, execution, and gas accounting
 */
contract EntryPoint is ERC165, ReentrancyGuard {
    using UserOperationLib for IUserOperation.UserOperation;

    // Constants
    uint256 public constant STAKE_MINIMUM = 1 ether;
    uint256 public constant UNSTAKE_DELAY_SEC = 1 days;
    uint256 private constant INNER_OUT_OF_GAS_BUFFER = 50000;

    // State variables
    uint256 public immutable chainId;
    mapping(address => uint256) public balanceOf;
    
    // Stake management for paymasters
    struct StakeInfo {
        uint256 stake;
        uint256 unstakeDelaySec;
        uint256 withdrawTime;
    }
    mapping(address => StakeInfo) public stakes;

    // Gas tracking for operations
    struct UserOpInfo {
        uint256 preOpGas;
        uint256 prefund;
        bool success;
        uint256 actualGasCost;
    }
    mapping(bytes32 => UserOpInfo) public userOpInfo;

    // Events
    event UserOperationEvent(
        bytes32 indexed userOpHash,
        address indexed sender,
        address indexed paymaster,
        uint256 nonce,
        bool success,
        uint256 actualGasCost,
        uint256 actualGasUsed
    );

    event AccountDeployed(
        bytes32 indexed userOpHash,
        address indexed sender,
        address factory,
        address paymaster
    );

    event Deposited(address indexed account, uint256 totalDeposit);
    event Withdrawn(address indexed account, address withdrawAddress, uint256 amount);
    event StakeLocked(address indexed account, uint256 totalStaked, uint256 unstakeDelaySec);
    event StakeUnlocked(address indexed account, uint256 withdrawTime);
    event StakeWithdrawn(address indexed account, address withdrawAddress, uint256 amount);

    // Custom errors for gas efficiency
    error FailedOp(uint256 opIndex, string reason);
    error SignatureValidationFailed();
    error PaymasterValidationFailed();
    error InvalidStake();
    error StakeTooLow();
    error StakeWithdrawTooSoon();

    constructor() {
        chainId = block.chainid;
    }

    // ERC-165 support
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Main entry point for handling user operations
     * @param ops Array of user operations to execute
     * @param beneficiary Address to receive gas payments
     */
    function handleOps(
        IUserOperation.UserOperation[] calldata ops,
        address payable beneficiary
    ) external nonReentrant {
        uint256 opsLength = ops.length;
        require(opsLength > 0, "EntryPoint: empty ops array");

        uint256 collected = 0;
        
        for (uint256 i = 0; i < opsLength; i++) {
            collected += _handleOp(i, ops[i], beneficiary);
        }

        if (collected > 0) {
            (bool success,) = beneficiary.call{value: collected}("");
            require(success, "EntryPoint: beneficiary transfer failed");
        }
    }

    /**
     * @dev Simulate validation of a user operation
     * @param userOp The user operation to validate
     * @return validationResult Validation result with gas estimates
     */
    function simulateValidation(
        IUserOperation.UserOperation calldata userOp
    ) external returns (IUserOperation.ValidationResult memory validationResult) {
        uint256 preOpGas = gasleft();
        
        // Create wallet if needed
        _createWalletIfNeeded(userOp);
        
        uint256 validationGas = preOpGas - gasleft();
        
        // Validate with wallet
        uint256 walletValidationData = _validateWallet(userOp, validationGas);
        
        // Handle paymaster validation if present
        bytes memory paymasterContext;
        uint256 paymasterValidationData = 0;
        
        if (userOp.paymasterAndData.length > 0) {
            (paymasterValidationData, paymasterContext) = _validatePaymaster(userOp, validationGas);
        }
        
        // Calculate prefund needed
        uint256 gasUsed = preOpGas - gasleft();
        uint256 prefund = _calculatePrefund(userOp, gasUsed);
        
        validationResult = IUserOperation.ValidationResult({
            preOpGas: gasUsed,
            prefund: prefund,
            sigFailed: walletValidationData == 1,
            validAfter: uint48(walletValidationData >> 160),
            validUntil: uint48(walletValidationData >> 208),
            paymasterContext: paymasterContext
        });
    }

    /**
     * @dev Handle individual user operation
     */
    function _handleOp(
        uint256 opIndex,
        IUserOperation.UserOperation calldata userOp,
        address payable beneficiary
    ) internal returns (uint256 collected) {
        uint256 preOpGas = gasleft();
        bytes32 userOpHash = userOp.hash(address(this), chainId);
        
        UserOpInfo storage opInfo = userOpInfo[userOpHash];
        opInfo.preOpGas = preOpGas;
        
        try this._validateAndExecuteOp(userOp, userOpHash, opIndex) returns (uint256 actualGasCost) {
            opInfo.success = true;
            opInfo.actualGasCost = actualGasCost;
            collected = actualGasCost;
        } catch Error(string memory reason) {
            revert FailedOp(opIndex, reason);
        } catch {
            revert FailedOp(opIndex, "Unknown error");
        }
        
        uint256 actualGasUsed = preOpGas - gasleft();
        
        emit UserOperationEvent(
            userOpHash,
            userOp.sender,
            _getPaymasterAddress(userOp),
            userOp.nonce,
            opInfo.success,
            opInfo.actualGasCost,
            actualGasUsed
        );
    }

    /**
     * @dev External function for validation and execution (used in try-catch)
     */
    function _validateAndExecuteOp(
        IUserOperation.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 opIndex
    ) external returns (uint256 actualGasCost) {
        require(msg.sender == address(this), "EntryPoint: only self call");
        
        // Create wallet if needed
        _createWalletIfNeeded(userOp);
        
        // Validate signatures and nonces
        uint256 validationData = _validateWallet(userOp, 0);
        if (validationData == 1) {
            revert SignatureValidationFailed();
        }
        
        // Handle paymaster
        bytes memory paymasterContext;
        if (userOp.paymasterAndData.length > 0) {
            uint256 paymasterValidationData;
            (paymasterValidationData, paymasterContext) = _validatePaymaster(userOp, 0);
            if (paymasterValidationData == 1) {
                revert PaymasterValidationFailed();
            }
        }
        
        // Execute the operation
        uint256 callGasLimit = userOp.callGasLimit;
        if (callGasLimit == 0) callGasLimit = gasleft() - INNER_OUT_OF_GAS_BUFFER;
        
        bool success = _executeUserOp(userOp.sender, userOp.callData, callGasLimit);
        
        // Calculate actual gas cost
        actualGasCost = _calculateActualGasCost(userOp, success);
        
        return actualGasCost;
    }

    /**
     * @dev Create wallet if initCode is provided
     */
    function _createWalletIfNeeded(IUserOperation.UserOperation calldata userOp) internal {
        if (userOp.initCode.length > 0) {
            address factory = address(bytes20(userOp.initCode[0:20]));
            bytes memory initCallData = userOp.initCode[20:];
            
            (bool success,) = factory.call(initCallData);
            require(success, "EntryPoint: wallet creation failed");
            
            emit AccountDeployed(
                userOp.hash(address(this), chainId),
                userOp.sender,
                factory,
                _getPaymasterAddress(userOp)
            );
        }
    }

    /**
     * @dev Validate wallet signature and nonce
     */
    function _validateWallet(
        IUserOperation.UserOperation calldata userOp,
        uint256 missingAccountFunds
    ) internal returns (uint256 validationData) {
        try IWallet(userOp.sender).validateUserOp(userOp, userOp.hash(address(this), chainId), missingAccountFunds) 
            returns (uint256 result) {
            return result;
        } catch {
            return 1; // Validation failed
        }
    }

    /**
     * @dev Validate paymaster
     */
    function _validatePaymaster(
        IUserOperation.UserOperation calldata userOp,
        uint256 missingAccountFunds
    ) internal returns (uint256 validationData, bytes memory context) {
        address paymaster = _getPaymasterAddress(userOp);
        
        // Check paymaster stake
        require(stakes[paymaster].stake >= STAKE_MINIMUM, "Paymaster: insufficient stake");
        
        try IPaymaster(paymaster).validatePaymasterUserOp(userOp, userOp.hash(address(this), chainId), missingAccountFunds)
            returns (bytes memory _context, uint256 _validationData) {
            return (_validationData, _context);
        } catch {
            return (1, ""); // Validation failed
        }
    }

    /**
     * @dev Execute user operation call data
     */
    function _executeUserOp(
        address wallet,
        bytes calldata callData,
        uint256 callGasLimit
    ) internal returns (bool success) {
        if (callData.length > 0) {
            (success,) = wallet.call{gas: callGasLimit}(callData);
        } else {
            success = true;
        }
    }

    /**
     * @dev Calculate prefund needed for operation
     */
    function _calculatePrefund(
        IUserOperation.UserOperation calldata userOp,
        uint256 gasUsed
    ) internal pure returns (uint256) {
        uint256 gasPrice = userOp.maxFeePerGas;
        uint256 gasLimit = userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas;
        return (gasLimit + gasUsed) * gasPrice;
    }

    /**
     * @dev Calculate actual gas cost after execution
     */
    function _calculateActualGasCost(
        IUserOperation.UserOperation calldata userOp,
        bool success
    ) internal pure returns (uint256) {
        uint256 gasPrice = success ? userOp.maxFeePerGas : userOp.maxPriorityFeePerGas;
        return (userOp.callGasLimit + userOp.verificationGasLimit + userOp.preVerificationGas) * gasPrice;
    }

    /**
     * @dev Get paymaster address from paymasterAndData
     */
    function _getPaymasterAddress(IUserOperation.UserOperation calldata userOp) internal pure returns (address) {
        if (userOp.paymasterAndData.length == 0) return address(0);
        return address(bytes20(userOp.paymasterAndData[0:20]));
    }

    // Stake management functions
    function addStake(uint256 unstakeDelaySec) external payable {
        StakeInfo storage info = stakes[msg.sender];
        info.stake += msg.value;
        info.unstakeDelaySec = unstakeDelaySec;
        emit StakeLocked(msg.sender, info.stake, unstakeDelaySec);
    }

    function unlockStake() external {
        StakeInfo storage info = stakes[msg.sender];
        require(info.stake > 0, "EntryPoint: no stake");
        info.withdrawTime = block.timestamp + info.unstakeDelaySec;
        emit StakeUnlocked(msg.sender, info.withdrawTime);
    }

    function withdrawStake(address payable withdrawAddress) external {
        StakeInfo storage info = stakes[msg.sender];
        require(info.withdrawTime > 0 && block.timestamp >= info.withdrawTime, "EntryPoint: stake withdrawal too soon");
        
        uint256 stake = info.stake;
        info.stake = 0;
        info.withdrawTime = 0;
        
        (bool success,) = withdrawAddress.call{value: stake}("");
        require(success, "EntryPoint: stake withdrawal failed");
        
        emit StakeWithdrawn(msg.sender, withdrawAddress, stake);
    }

    // Deposit functions for gas payments
    function depositTo(address account) external payable {
        balanceOf[account] += msg.value;
        emit Deposited(account, balanceOf[account]);
    }

    function withdrawTo(address payable withdrawAddress, uint256 withdrawAmount) external {
        require(balanceOf[msg.sender] >= withdrawAmount, "EntryPoint: insufficient balance");
        balanceOf[msg.sender] -= withdrawAmount;
        
        (bool success,) = withdrawAddress.call{value: withdrawAmount}("");
        require(success, "EntryPoint: withdrawal failed");
        
        emit Withdrawn(msg.sender, withdrawAddress, withdrawAmount);
    }

    // Fallback to receive ETH
    receive() external payable {
        balanceOf[msg.sender] += msg.value;
        emit Deposited(msg.sender, balanceOf[msg.sender]);
    }
} 