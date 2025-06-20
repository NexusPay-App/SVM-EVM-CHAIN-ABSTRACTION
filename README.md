# NexusDeFi SVM Programs

This directory contains the Solana (SVM) implementation of NexusDeFi's cross-chain infrastructure, providing account abstraction, fee sponsorship, and cross-chain bridging capabilities.

## 🏗️ Architecture Overview

The SVM side consists of four main programs that work together to provide ERC-4337-like functionality on Solana:

### 1. **Wallet Program** (`nexus-wallet`)
- **Purpose**: PDA-based smart wallets with account abstraction
- **Features**:
  - Social recovery with guardian system
  - Daily spending limits and security controls
  - Batch transaction execution
  - Cross-chain compatibility with EVM wallets
  - User operation validation and execution

### 2. **Entry Point Program** (`nexus-entry-point`)
- **Purpose**: Central coordinator for user operations (Solana's ERC-4337 equivalent)
- **Features**:
  - User operation validation and bundling
  - Paymaster integration for sponsored transactions
  - Stake management for paymasters
  - Gas accounting and refund mechanisms
  - Batch operation processing

### 3. **Paymaster Program** (`nexus-paymaster`)
- **Purpose**: Flexible fee sponsorship and token-based payments
- **Features**:
  - Sponsor transaction fees for users
  - Accept SPL tokens as payment for gas
  - Rate limiting and policy controls
  - Multi-token support with oracle integration
  - Developer-configurable fee policies

### 4. **Bridge Program** (`nexus-bridge`)
- **Purpose**: Cross-chain asset transfers between EVM and SVM
- **Features**:
  - Lock/mint mechanism for asset transfers
  - Multi-signature validation for security
  - Support for both native tokens (SOL/ETH) and SPL/ERC-20 tokens
  - Transaction correlation across chains
  - Validator consensus for cross-chain operations

## 🚀 Key Features

### **Account Abstraction**
- **Unified Wallets**: Single wallet address works across EVM and SVM chains
- **Social Recovery**: Guardian-based recovery system eliminates seed phrase dependency
- **Flexible Authentication**: Support for phone, email, Google, ENS, and social logins
- **Daily Limits**: Built-in spending controls for enhanced security

### **Fee Sponsorship**
- **Gasless Transactions**: Developers can sponsor user fees completely
- **Token Payments**: Users can pay fees in SPL tokens instead of SOL
- **Flexible Policies**: Configurable fee sponsorship rules (e.g., "first 100 transactions free")
- **Rate Limiting**: Built-in protection against abuse

### **Cross-Chain Bridging**
- **Secure Transfers**: Multi-signature validation ensures security
- **Asset Support**: Bridge both native tokens and custom tokens
- **Transaction Correlation**: Unified tracking across EVM and SVM explorers
- **Validator Network**: Decentralized validator set for cross-chain consensus

## 📁 Project Structure

```
contracts/svm/
├── Cargo.toml              # Workspace configuration
├── Anchor.toml             # Anchor framework configuration
├── lib.rs                  # Unified interface and legacy compatibility
├── README.md              # This file
├── programs/
│   ├── wallet/            # Smart wallet program
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── entry_point/       # Entry point program
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   ├── paymaster/         # Paymaster program
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   └── bridge/            # Bridge program
│       ├── Cargo.toml
│       └── src/lib.rs
└── tests/                 # Integration tests (to be added)
```

## 🛠️ Development Setup

### Prerequisites
- Rust 1.70+
- Solana CLI 1.18.2+
- Anchor Framework 0.29.0+
- Node.js 18+ (for testing)

### Installation

1. **Install Solana CLI**:
```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.2/install)"
```

2. **Install Anchor**:
```bash
npm install -g @coral-xyz/anchor-cli@0.29.0
```

3. **Install Rust dependencies**:
```bash
cd contracts/svm
cargo build-bpf
```

4. **Build all programs**:
```bash
anchor build
```

### Local Development

1. **Start local validator**:
```bash
solana-test-validator
```

2. **Deploy programs**:
```bash
anchor deploy
```

3. **Run tests**:
```bash
anchor test
```

## 🔧 Program IDs

### Localnet/Devnet
- **Wallet Program**: `NxWaLLeTProgram11111111111111111111111111111`
- **Entry Point Program**: `NxEntryPoint11111111111111111111111111111111`
- **Paymaster Program**: `NxPayMaster11111111111111111111111111111111`
- **Bridge Program**: `NxBridge111111111111111111111111111111111111`

## 🌐 Cross-Chain Integration

### EVM Compatibility
The SVM programs are designed to work seamlessly with the EVM contracts:

1. **Unified Addresses**: Wallets have deterministic addresses on both chains
2. **Transaction Correlation**: Bridge program correlates transactions across chains
3. **Shared Security**: Multi-signature validation ensures cross-chain security
4. **Unified UX**: Users interact with a single interface across all chains

### Integration Flow
```
User Action → Wallet Program → Entry Point Program → Paymaster Program
                    ↓
            Bridge Program ← → EVM Bridge Contract
                    ↓
            Cross-Chain Transaction Execution
```

## 📊 Usage Examples

### Creating a Unified Wallet
```rust
use nexus_wallet::*;

// Initialize wallet with social recovery
let wallet_ix = initialize_wallet(
    owner_pubkey,
    recovery_hash,
    daily_limit_lamports,
);
```

### Sponsoring User Fees
```rust
use nexus_paymaster::*;

// Configure paymaster to sponsor fees
let paymaster_config = PaymasterConfig {
    max_operations_per_hour: 100,
    max_cost_per_operation: 1_000_000, // 0.001 SOL
    allowed_users: vec![], // Empty = all users allowed
    rate_limit_per_user: 10,
    require_pre_deposit: false,
};
```

### Cross-Chain Transfer
```rust
use nexus_bridge::*;

// Lock tokens for cross-chain transfer
let lock_ix = lock_tokens(
    amount,
    destination_chain_id, // e.g., 1 for Ethereum
    destination_address,  // EVM address
    token_mint,          // SPL token mint
);
```

## 🔐 Security Features

### Multi-Signature Validation
- Bridge operations require consensus from multiple validators
- Configurable threshold (e.g., 5 of 7 validators)
- Validator rotation capabilities

### Access Controls
- Owner-only functions for sensitive operations
- Guardian-based social recovery
- Emergency pause mechanisms
- Rate limiting and spending controls

### Audit Considerations
- All programs use Anchor framework for additional safety
- Comprehensive error handling and validation
- Event emission for off-chain monitoring
- Deterministic address generation

## 🧪 Testing Strategy

### Unit Tests
- Individual instruction testing
- Account validation testing
- Error condition testing

### Integration Tests
- Cross-program interactions
- End-to-end user flows
- Cross-chain scenarios

### Security Tests
- Access control validation
- Overflow/underflow protection
- Reentrancy protection

## 🚀 Deployment Guide

### Devnet Deployment
```bash
# Set cluster to devnet
solana config set --url https://api.devnet.solana.com

# Deploy all programs
anchor deploy --provider.cluster devnet
```

### Mainnet Deployment
```bash
# Set cluster to mainnet
solana config set --url https://api.mainnet-beta.solana.com

# Deploy with verification
anchor deploy --provider.cluster mainnet --verify
```

## 📈 Roadmap

### Phase 1: Core Functionality ✅
- [x] Wallet program with PDA-based accounts
- [x] Entry point for user operation handling
- [x] Basic paymaster functionality
- [x] Bridge program for cross-chain transfers

### Phase 2: Enhanced Features (In Progress)
- [ ] Advanced signature verification (secp256k1 for EVM compatibility)
- [ ] Oracle integration for token pricing
- [ ] Enhanced security features
- [ ] Comprehensive testing suite

### Phase 3: Production Ready
- [ ] Security audits
- [ ] Performance optimization
- [ ] Mainnet deployment
- [ ] SDK development

### Phase 4: Advanced Features
- [ ] Multi-signature wallets
- [ ] Time-locked transactions
- [ ] Advanced DeFi integrations
- [ ] Governance mechanisms

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Related Resources

- [EVM Contracts](../evm/README.md)
- [NexusDeFi Documentation](../../docs/)
- [Solana Development](https://docs.solana.com/)
- [Anchor Framework](https://www.anchor-lang.com/)

---

**Note**: This is the SVM (Solana) implementation of NexusDeFi. For the complete cross-chain experience, it works in conjunction with the EVM contracts in the `../evm` directory. 