# 📱 Phone Wallet Demo

A simple standalone demo showing how to build a phone number-based wallet application using the NexusPay SDK. Users can create wallets, check balances, and send gasless transactions across Ethereum, Arbitrum, and Solana using just their phone numbers.

## 🎯 Demo Features

- **Phone Number Authentication**: Users create accounts with phone + password
- **Cross-Chain Wallets**: Automatic wallet creation on Ethereum, Arbitrum, and Solana
- **Gasless Transactions**: Send funds without gas fees using paymasters
- **Real-time Balances**: View token balances across all chains
- **Auto-Wallet Creation**: Automatically creates wallets for new recipients
- **Transaction History**: Track all sent transactions

## 🔧 Developer Setup

### 1. Configure Your API Key

In `config.js`, replace the placeholder API key with your actual NexusPay API key:

```javascript
// 🔧 DEVELOPER CONFIGURATION - EDIT THESE VALUES
const CONFIG = {
    // 🔑 Your NexusPay API Key (REQUIRED)
    API_KEY: 'npay_proj_your_actual_api_key_here', // Replace with your actual API key
    
    // ... other configuration options
};
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Demo

```bash
npm start
# or
npm run dev
```

Open `http://localhost:3000` in your browser.

## 👥 User Experience

### For End Users:
1. Enter phone number (e.g., `+1234567890`)
2. Enter password (minimum 6 characters)
3. Choose "Login" or "Register"
4. Start sending cross-chain transactions!

### Demo Credentials:
- **Phone**: Any valid phone number (e.g., `+1234567890`)
- **Password**: `demo123` or any password with 6+ characters

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Input    │    │   Your App      │    │   NexusPay SDK  │
│                 │    │                 │    │                 │
│ Phone: +1234... │───▶│ API Key Config  │───▶│ Backend API     │
│ Password: ***   │    │ Auth Logic      │    │ Blockchain RPCs │
│                 │    │ UI/UX           │    │ Paymasters      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Points:
- **API Key**: Configured by developer in app code (not user input)
- **Authentication**: Handle user auth in your app, use SDK for blockchain operations
- **Security**: Password validation should be done server-side in production
- **Cross-Chain**: SDK handles all blockchain interactions automatically

## 📝 Implementation Guide

### Basic Integration

```javascript
// 1. Configure SDK with your API key
const sdk = new NexusSDK({
    apiKey: 'your_nexus_api_key',
    enableBridging: true,
    enableGasless: true,
    baseURL: 'https://your-backend.com'
});

// 2. Create wallet for user
const wallet = await sdk.createWallet({
    socialId: phoneNumber,
    socialType: 'phone',
    chains: ['ethereum', 'arbitrum', 'solana'],
    enableGasless: true
});

// 3. Send gasless transaction
const transaction = await sdk.executeTransaction({
    chain: 'ethereum',
    userWalletAddress: wallet.addresses.ethereum,
    transaction: {
        to: recipientAddress,
        value: amountInWei
    },
    usePaymaster: true
});
```

### Production Considerations

1. **API Key Security**: 
   - Store API keys in environment variables
   - Use server-side API key validation
   - Never expose API keys in client-side code

2. **User Authentication**:
   - Implement proper password hashing
   - Use JWT tokens for session management
   - Add multi-factor authentication

3. **Error Handling**:
   - Graceful fallbacks for network issues
   - User-friendly error messages
   - Retry mechanisms for failed transactions

## 🎮 Demo Flow

1. **User Registration/Login**
   ```
   Phone: +1234567890
   Password: demo123
   Mode: Register/Login
   ```

2. **Wallet Creation**
   ```
   ✅ Wallet created across all chains
   📱 Addresses generated
   💰 Balances loaded
   ```

3. **Send Transaction**
   ```
   Recipient: +1987654321
   Amount: 0.01 ETH
   Chain: Ethereum
   ⚡ Gasless: Yes
   ```

## 🚀 Integration Examples

### React Integration
```jsx
import { NexusSDK } from '@nexuspay/sdk';

const sdk = new NexusSDK({
    apiKey: process.env.NEXUS_API_KEY,
    enableGasless: true
});

function WalletApp() {
    const [user, setUser] = useState(null);
    
    const handleLogin = async (phone, password) => {
        // Your authentication logic
        const wallet = await sdk.getWalletBySocialId(phone, 'phone');
        setUser({ phone, wallet });
    };
    
    return (
        <div>
            {user ? <Dashboard user={user} /> : <LoginForm onLogin={handleLogin} />}
        </div>
    );
}
```

### Node.js Backend
```javascript
const express = require('express');
const { NexusSDK } = require('@nexuspay/sdk');

const sdk = new NexusSDK({
    apiKey: process.env.NEXUS_API_KEY,
    enableBridging: true,
    enableGasless: true
});

app.post('/api/create-wallet', async (req, res) => {
    const { phoneNumber, hashedPassword } = req.body;
    
    try {
        const wallet = await sdk.createWallet({
            socialId: phoneNumber,
            socialType: 'phone',
            chains: ['ethereum', 'arbitrum', 'solana'],
            enableGasless: true
        });
        
        res.json({ success: true, wallet });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
```

## 🔒 Security Best Practices

1. **Never expose API keys in client-side code**
2. **Use environment variables for sensitive data**
3. **Implement proper password hashing (bcrypt, argon2)**
4. **Add rate limiting to prevent abuse**
5. **Validate all user inputs**
6. **Use HTTPS in production**
7. **Implement session management**

## 📊 SDK Features Used

- ✅ **Wallet Creation**: `createWallet()`
- ✅ **Wallet Retrieval**: `getWalletBySocialId()`
- ✅ **Balance Checking**: `getWalletBalances()`
- ✅ **Gasless Transactions**: `executeTransaction()`
- ✅ **Cross-Chain Support**: Ethereum, Arbitrum, Solana
- ✅ **Auto-Recipient Creation**: Creates wallets for new recipients
- ✅ **Transaction History**: Track all operations

## 🎨 Customization

### Styling
- Modern CSS with gradients and animations
- Mobile-responsive design
- Dark theme support ready
- Custom chain icons and emojis

### Features to Add
- [ ] Multi-language support
- [ ] QR code scanning for addresses
- [ ] Transaction receipts
- [ ] Address book
- [ ] Notification system
- [ ] Transaction scheduling

## 📱 Mobile Support

The demo is fully responsive and works on:
- 📱 Mobile browsers
- 💻 Desktop browsers
- 🖥️ Tablet devices

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📞 Support

- 📧 Email: support@nexuspay.io
- 📖 Documentation: https://docs.nexuspay.io
- 💬 Discord: https://discord.gg/nexuspay
- 🐦 Twitter: @NexusPayHQ

## 📜 License

MIT License - see LICENSE file for details.

---

**Ready to integrate?** Get your API key from the [NexusPay Dashboard](https://dashboard.nexuspay.io) and start building! 