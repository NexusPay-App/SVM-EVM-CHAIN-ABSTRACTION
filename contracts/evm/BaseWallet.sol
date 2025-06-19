pragma solidity ^0.8.0;

import "./interfaces/IWallet.sol";
import "./interfaces/IUserOperation.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

// TODO: Consider inheriting from Context or Ownable if ownership is desired

contract BaseWallet is IWallet, ERC165 {
    // The address of the EntryPoint contract, set during deployment
    address public immutable i_entryPoint;
    // Counter for user operation nonces
    uint256 public nextNonce;

    // Event to emit when a call is executed
    event WalletCallExecuted(address indexed dest, uint256 value, bytes func);

    // Modifier to restrict calls to only the EntryPoint contract
    modifier onlyEntryPoint() {
        require(msg.sender == i_entryPoint, "BaseWallet: not from EntryPoint");
        _;
    }

    constructor(address entryPointAddress) {
        require(entryPointAddress != address(0), "BaseWallet: EntryPoint address cannot be zero");
        i_entryPoint = entryPointAddress;
    }

    // ERC-165 support for IWallet interface
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IWallet).interfaceId || super.supportsInterface(interfaceId);
    }

    // Fallback function to receive ETH
    receive() external payable {}

    // Function to execute a single call, callable only by EntryPoint
    function execute(address dest, uint256 value, bytes calldata func) external virtual onlyEntryPoint {
        (bool success,) = dest.call{value: value}(func);
        require(success, "Wallet: call failed");
        emit WalletCallExecuted(dest, value, func);
    }

    // Function to execute a batch of calls, callable only by EntryPoint
    function executeBatch(address[] calldata dest, uint256[] calldata value, bytes[] calldata func) external virtual onlyEntryPoint {
        require(dest.length == value.length && dest.length == func.length, "Wallet: array length mismatch");
        for (uint256 i = 0; i < dest.length; i++) {
            (bool success,) = dest[i].call{value: value[i]}(func[i]);
            require(success, "Wallet: call failed");
            emit WalletCallExecuted(dest[i], value[i], func[i]);
        }
    }

    function validateUserOp(
        IUserOperation.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external virtual override returns (uint256 validationData) {
        // Only EntryPoint can call validateUserOp directly
        require(msg.sender == i_entryPoint, "BaseWallet: not from EntryPoint");

        // 1. Nonce validation
        require(userOp.nonce == nextNonce, "BaseWallet: invalid nonce");
        nextNonce++; // Increment nonce for the next operation

        // 2. Signature validation
        // TODO: Implement actual signature verification here. This will depend on the wallet's authentication mechanism.
        // For now, we'll assume a valid signature if we reach this point.

        // The return value (validationData) encodes information about the validation result,
        // including the signature validation period and aggregator information.
        // For simplicity, we return a success code. In a real ERC-4337 implementation,
        // this would be a more complex encoding.
        validationData = 1; // Placeholder for successful validation
    }
} 