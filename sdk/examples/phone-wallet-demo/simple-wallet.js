/**
 * SIMPLE Phone Wallet Demo
 * This is how easy it should be to integrate NexusPay SDK
 */

// 1. Import SDK (in real app: import { NexusSDK } from '@nexuspay/sdk')
const { NexusSDK } = require('@nexuspay/sdk');

// 2. Initialize SDK (ONE LINE)
const nexus = new NexusSDK({
    apiKey: 'npay_proj_1751544230530_8210d090_production_101fe1dee6de44861ca4efe0bcaeb7b4'
});

// 3. Create wallet (ONE LINE)
async function createWallet(phoneNumber) {
    return await nexus.createWallet({
        socialId: phoneNumber,
        socialType: 'phone',
        chains: ['ethereum', 'arbitrum', 'solana']
    });
}

// 4. Send transaction (ONE LINE)
async function sendFunds(fromWallet, toPhone, amount, chain = 'ethereum') {
    const toWallet = await nexus.getWalletBySocialId(toPhone, 'phone');
    
    return await nexus.executeTransaction({
        chain,
        userWalletAddress: fromWallet.addresses[chain],
        transaction: {
            to: toWallet.addresses[chain],
            value: amount
        },
        usePaymaster: true // Gasless!
    });
}

// 5. That's it! Real usage:
async function demo() {
    // Create wallet for user
    const wallet = await createWallet('+1234567890');
    console.log('Wallet created:', wallet.addresses);
    
    // Send money to friend
    const tx = await sendFunds(wallet, '+1987654321', '0.01', 'ethereum');
    console.log('Transaction:', tx.transactionHash);
}

// Export for browser
if (typeof window !== 'undefined') {
    window.SimpleWallet = {
        NexusSDK,
        createWallet,
        sendFunds,
        demo
    };
} 