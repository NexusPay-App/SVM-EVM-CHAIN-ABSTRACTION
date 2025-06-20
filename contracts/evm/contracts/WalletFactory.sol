// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Wallet.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

/**
 * @title WalletFactory
 * @dev Factory for creating deterministic smart contract wallets using CREATE2
 */
contract WalletFactory {
    address public immutable entryPoint;
    
    event WalletCreated(address indexed wallet, address indexed owner, uint256 salt);

    constructor(address _entryPoint) {
        require(_entryPoint != address(0), "WalletFactory: EntryPoint cannot be zero address");
        entryPoint = _entryPoint;
    }

    /**
     * @dev Create a new wallet with deterministic address
     * @param owner Owner of the wallet
     * @param salt Salt for CREATE2 deployment
     * @return wallet Address of the created wallet
     */
    function createWallet(address owner, uint256 salt) external returns (address wallet) {
        bytes32 saltBytes = keccak256(abi.encodePacked(owner, salt));
        
        // Check if wallet already exists
        wallet = getWalletAddress(owner, salt);
        if (wallet.code.length > 0) {
            return wallet;
        }
        
        bytes memory bytecode = abi.encodePacked(
            type(Wallet).creationCode,
            abi.encode(entryPoint)
        );
        
        wallet = Create2.deploy(0, saltBytes, bytecode);
        
        // Transfer ownership to the specified owner
        Wallet(payable(wallet)).transferOwnership(owner);
        
        emit WalletCreated(wallet, owner, salt);
    }

    /**
     * @dev Get the deterministic address of a wallet before deployment
     * @param owner Owner of the wallet (used in salt calculation)
     * @param salt Salt for CREATE2 deployment
     * @return wallet Predicted address of the wallet
     */
    function getWalletAddress(address owner, uint256 salt) public view returns (address wallet) {
        bytes32 saltBytes = keccak256(abi.encodePacked(owner, salt));
        bytes memory bytecode = abi.encodePacked(
            type(Wallet).creationCode,
            abi.encode(entryPoint)
        );
        
        wallet = Create2.computeAddress(saltBytes, keccak256(bytecode), address(this));
    }

    /**
     * @dev Check if a wallet has been deployed at the predicted address
     * @param owner Owner of the wallet
     * @param salt Salt used for deployment
     * @return Whether the wallet exists
     */
    function isWalletDeployed(address owner, uint256 salt) external view returns (bool) {
        address walletAddress = getWalletAddress(owner, salt);
        return walletAddress.code.length > 0;
    }
} 