pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./interfaces/IPaymaster.sol";
import "./interfaces/IUserOperation.sol"; // Make sure IUserOperation is imported

contract Paymaster is IPaymaster, Ownable, ERC165 {
    address public immutable i_entryPoint;

    constructor(address initialOwner, address entryPointAddress) Ownable(initialOwner) {
        require(entryPointAddress != address(0), "Paymaster: EntryPoint address cannot be zero");
        i_entryPoint = entryPointAddress;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IPaymaster).interfaceId || super.supportsInterface(interfaceId);
    }

    // Allows anyone to deposit ETH into the paymaster for gas sponsorship
    function deposit() public payable {}

    // Allows the owner to withdraw ETH from the paymaster
    function withdraw(address payable to, uint256 amount) public onlyOwner {
        require(address(this).balance >= amount, "Paymaster: Insufficient balance");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Paymaster: ETH withdrawal failed");
    }

    // Allows the owner to stake ETH with the EntryPoint (simplified - actual staking is more complex)
    function addStake(uint256 amount) public onlyOwner {
        // In a real ERC-4337 scenario, this would call EntryPoint.addStake()
        // For now, it simply transfers ETH to EntryPoint.
        (bool success, ) = i_entryPoint.call{value: amount}("");
        require(success, "Paymaster: Staking failed");
    }

    function validatePaymasterUserOp(
        IUserOperation.UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external virtual override returns (bytes validationData) {
        require(msg.sender == i_entryPoint, "Paymaster: not from EntryPoint");

        // 1. Checking if the paymaster has enough funds to cover the estimated gas cost.
        // This is a very basic check. A more robust implementation would consider
        // the actual gas needed for the transaction, not just missingAccountFunds.
        require(address(this).balance >= missingAccountFunds, "Paymaster: Insufficient paymaster balance");

        // 2. Applying fee sponsorship policies (e.g., allowlisting, rate limiting).
        // TODO: Implement advanced policy checks here based on userOp data or external configuration.

        // 3. Verifying additional paymaster-specific data in userOp.paymasterAndData.
        // TODO: Parse and validate any custom data included by the paymaster in the user operation.

        // The return value (validationData) indicates success/failure and any specific rules
        // (e.g., valid until time, aggregator information).
        // For simplicity, we return an empty bytes which signifies success in basic implementations.
        validationData = hex"";
    }

    // TODO: Add other necessary paymaster functions (e.g., withdraw, addStake, setDeposit)

    // Fallback function to receive ETH
    receive() external payable {}

    // Fallback for non-existent functions (optional, but good for robust contracts)
    fallback() external payable {}
} 