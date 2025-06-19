pragma solidity ^0.8.0;

import "./interfaces/IWallet.sol";
import "./Wallet.sol";

contract WalletFactory {
    address public immutable i_entryPoint; // Store the EntryPoint address

    event WalletCreated(address indexed walletAddress, address indexed owner, bytes32 salt);

    constructor(address entryPointAddress) {
        require(entryPointAddress != address(0), "WalletFactory: EntryPoint address cannot be zero");
        i_entryPoint = entryPointAddress;
    }

    function createAccount(
        address owner,
        bytes32 salt
    ) external returns (address newWallet) {
        bytes memory bytecode = type(Wallet).creationCode;
        // Pass both owner and i_entryPoint to the Wallet constructor
        bytes memory constructorArgs = abi.encodePacked(owner, i_entryPoint);
        bytes memory combinedBytecode = abi.encodePacked(bytecode, constructorArgs);

        bytes32 saltedBytecodeHash = keccak256(abi.encodePacked(combinedBytecode, salt));
        bytes32 newAddressHash = keccak256(abi.encodePacked(bytes1(0xff), address(this), saltedBytecodeHash));

        newWallet = address(uint160(uint256(newAddressHash)));

        assembly {
            newWallet := create2(0, add(combinedBytecode, 0x20), mload(combinedBytecode), salt)
        }

        require(newWallet != address(0), "WalletFactory: deployment failed");

        emit WalletCreated(newWallet, owner, salt);
    }

    function getAccountAddress(
        address owner,
        bytes32 salt
    ) public view returns (address predictedAddress) {
        bytes memory bytecode = type(Wallet).creationCode;
        // Pass both owner and i_entryPoint to the Wallet constructor for prediction
        bytes memory constructorArgs = abi.encodePacked(owner, i_entryPoint);
        bytes memory combinedBytecode = abi.encodePacked(bytecode, constructorArgs);

        bytes32 saltedBytecodeHash = keccak256(abi.encodePacked(combinedBytecode, salt));
        bytes32 newAddressHash = keccak256(abi.encodePacked(bytes1(0xff), address(this), saltedBytecodeHash));

        predictedAddress = address(uint160(uint256(newAddressHash)));
    }
} 