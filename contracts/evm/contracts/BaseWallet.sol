// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IUserOperation.sol";
import "./interfaces/IWallet.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BaseWallet
 * @dev Base smart contract wallet implementing ERC-4337 Account Abstraction
 */
abstract contract BaseWallet is IWallet, ReentrancyGuard, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Constants
    uint256 private constant SIG_VALIDATION_FAILED = 1;
    uint256 private constant SIG_VALIDATION_SUCCESS = 0;

    // State variables
    address public immutable entryPoint;
    mapping(uint256 => bool) private _usedNonces;
    uint256 private _nonce;

    // Events
    event ExecutionSuccess(address indexed target, uint256 value, bytes data);
    event ExecutionFailure(address indexed target, uint256 value, bytes data, string reason);

    // Custom errors
    error OnlyEntryPoint();
    error OnlyOwnerOrEntryPoint();
    error ExecutionFailed();
    error InvalidNonce();
    error InvalidSignature();

    /**
     * @dev Constructor sets the EntryPoint address
     * @param _entryPoint Address of the EntryPoint contract
     */
    constructor(address _entryPoint) Ownable(msg.sender) {
        entryPoint = _entryPoint;
    }

    /**
     * @dev Modifier to restrict access to EntryPoint only
     */
    modifier onlyEntryPoint() {
        if (msg.sender != entryPoint) revert OnlyEntryPoint();
        _;
    }

    /**
     * @dev Modifier to restrict access to owner or EntryPoint
     */
    modifier onlyOwnerOrEntryPoint() {
        if (msg.sender != owner() && msg.sender != entryPoint) revert OnlyOwnerOrEntryPoint();
        _;
    }

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
    ) external virtual override onlyEntryPoint returns (uint256 validationData) {
        // Check nonce
        if (userOp.nonce != _nonce) {
            return SIG_VALIDATION_FAILED;
        }

        // Validate signature
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        address signer = hash.recover(userOp.signature);
        
        if (signer != owner()) {
            return SIG_VALIDATION_FAILED;
        }

        // Mark nonce as used and increment
        _usedNonces[userOp.nonce] = true;
        _nonce++;

        // Handle missing account funds
        if (missingAccountFunds > 0) {
            (bool success,) = payable(msg.sender).call{value: missingAccountFunds}("");
            if (!success) {
                return SIG_VALIDATION_FAILED;
            }
        }

        return SIG_VALIDATION_SUCCESS;
    }

    /**
     * @dev Internal execute function without reentrancy guard
     * @param target Target contract address
     * @param value ETH value to send
     * @param data Call data to execute
     * @return success Whether the execution was successful
     */
    function _execute(
        address target,
        uint256 value,
        bytes calldata data
    ) internal returns (bool success) {
        (success,) = target.call{value: value}(data);
        
        if (success) {
            emit ExecutionSuccess(target, value, data);
        } else {
            emit ExecutionFailure(target, value, data, "Call failed");
        }
        
        return success;
    }

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
    ) public virtual override onlyOwnerOrEntryPoint nonReentrant returns (bool success) {
        return _execute(target, value, data);
    }

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
    ) public virtual override onlyOwnerOrEntryPoint nonReentrant returns (bool[] memory successes) {
        require(targets.length == values.length && targets.length == data.length, "Length mismatch");
        
        successes = new bool[](targets.length);
        
        for (uint256 i = 0; i < targets.length; i++) {
            successes[i] = _execute(targets[i], values[i], data[i]);
        }
        
        return successes;
    }

    /**
     * @dev Get the current nonce for this wallet
     * @return Current nonce value
     */
    function getNonce() public view virtual override returns (uint256) {
        return _nonce;
    }

    /**
     * @dev Check if a nonce has been used
     * @param nonce Nonce to check
     * @return Whether the nonce has been used
     */
    function isNonceUsed(uint256 nonce) public view returns (bool) {
        return _usedNonces[nonce];
    }

    /**
     * @dev Deposit ETH to this wallet
     */
    function deposit() public payable {
        // ETH deposited, no additional logic needed
    }

    /**
     * @dev Get the wallet's ETH balance
     * @return ETH balance in wei
     */
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @dev Emergency withdrawal function (only owner)
     * @param to Address to send ETH to
     * @param amount Amount of ETH to withdraw
     */
    function withdraw(address payable to, uint256 amount) public onlyOwner {
        require(address(this).balance >= amount, "Insufficient balance");
        (bool success,) = to.call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Check if the wallet supports a specific interface
     * @param interfaceId Interface ID to check
     * @return Whether the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) public view virtual returns (bool) {
        return interfaceId == type(IWallet).interfaceId;
    }

    /**
     * @dev Receive ETH function
     */
    receive() external payable {
        // Accept ETH deposits
    }

    /**
     * @dev Fallback function for unknown calls
     */
    fallback() external payable {
        // Accept ETH and unknown calls
    }
} 