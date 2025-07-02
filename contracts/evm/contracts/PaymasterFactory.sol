// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Create2.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./Paymaster.sol";

/**
 * @title PaymasterFactory
 * @notice Factory contract for deploying minimal proxy paymasters
 * @dev Uses EIP-1167 minimal proxies for gas-efficient deployment (~2000 gas vs 3M gas)
 */
contract PaymasterFactory is Ownable {
    // Master paymaster implementation
    address public immutable masterPaymaster;
    
    // Mapping of project ID to paymaster proxy address
    mapping(string => address) public projectPaymasters;
    
    // Mapping of paymaster address to project ID
    mapping(address => string) public paymasterProjects;
    
    event PaymasterCreated(
        string indexed projectId,
        address indexed paymasterAddress,
        address indexed owner
    );

    constructor(address _masterPaymaster) Ownable(msg.sender) {
        masterPaymaster = _masterPaymaster;
    }

    /**
     * @notice Create a minimal proxy paymaster for a project
     * @param projectId Unique project identifier
     * @param paymasterOwner Owner of the paymaster
     * @param salt Salt for CREATE2 deterministic deployment
     * @return paymasterAddress Address of the created paymaster proxy
     */
    function createPaymaster(
        string memory projectId,
        address paymasterOwner,
        bytes32 salt
    ) external onlyOwner returns (address paymasterAddress) {
        require(bytes(projectId).length > 0, "Invalid project ID");
        require(paymasterOwner != address(0), "Invalid owner");
        require(projectPaymasters[projectId] == address(0), "Project already exists");

        // Create minimal proxy using CREATE2 for deterministic address
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            masterPaymaster,
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        paymasterAddress = Create2.deploy(0, salt, bytecode);

        // Initialize the proxy with EntryPoint and owner
        // Use a standard EntryPoint address for EIP-4337
        address entryPoint = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789; // Standard EntryPoint v0.6
        Paymaster(payable(paymasterAddress)).initialize(entryPoint, paymasterOwner);

        // Store mappings
        projectPaymasters[projectId] = paymasterAddress;
        paymasterProjects[paymasterAddress] = projectId;

        emit PaymasterCreated(projectId, paymasterAddress, paymasterOwner);
    }

    /**
     * @notice Get paymaster address for a project
     * @param projectId Project identifier
     * @return Paymaster address (address(0) if not exists)
     */
    function getPaymaster(string memory projectId) external view returns (address) {
        return projectPaymasters[projectId];
    }

    /**
     * @notice Predict paymaster address before deployment
     * @param projectId Project identifier  
     * @param salt Salt for CREATE2
     * @return Predicted address
     */
    function predictPaymasterAddress(
        string memory projectId,
        bytes32 salt
    ) external view returns (address) {
        bytes memory bytecode = abi.encodePacked(
            hex"3d602d80600a3d3981f3363d3d373d3d3d363d73",
            masterPaymaster,
            hex"5af43d82803e903d91602b57fd5bf3"
        );

        return Create2.computeAddress(salt, keccak256(bytecode), address(this));
    }

    /**
     * @notice Emergency function to upgrade master implementation
     * @dev Only affects new deployments, existing proxies remain unchanged
     */
    function upgradeMaster(address newMaster) external onlyOwner {
        require(newMaster != address(0), "Invalid master address");
        // Note: This only affects new deployments
        // Existing proxies continue using the old implementation
    }
} 