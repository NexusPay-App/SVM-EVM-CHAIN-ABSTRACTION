// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./BaseWallet.sol";

/**
 * @title Wallet
 * @dev Simple implementation of a smart contract wallet
 */
contract Wallet is BaseWallet {
    
    /**
     * @dev Constructor
     * @param entryPoint Address of the EntryPoint contract
     */
    constructor(
        address entryPoint
    ) BaseWallet(entryPoint) {
        // BaseWallet constructor will set the owner to msg.sender
    }

    // The wallet inherits all functionality from BaseWallet
    // including validateUserOp, execute, executeBatch, etc.
} 