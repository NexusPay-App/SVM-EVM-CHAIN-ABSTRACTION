/**
 * Phone Wallet Demo Configuration
 * 
 * DEVELOPER SETUP INSTRUCTIONS:
 * 1. Get your API key from https://dashboard.nexuspay.io
 * 2. Replace 'YOUR_NEXUS_API_KEY_HERE' with your actual API key
 * 3. Configure your backend URL if different from default
 * 4. Set up supported chains and features
 */

// NexusPay SDK Configuration
const CONFIG = {
    // 🚀 SIMPLIFIED: Only 2 parameters needed!
    projectName: 'AnotherOne',  // Your project name from dashboard
    apiKey: 'npay_proj_proj_1751541763399_30f0c499_02cf9557_production_962c0bdf2e5003db31d106868b38277a',
    
    // Optional: Backend Configuration (auto-configured)
    backendUrl: 'https://backend-amber-zeta-94.vercel.app',
    
    // Supported chains for wallet deployment
    supportedChains: [
        'ethereum',
        'arbitrum', 
        'solana'
    ],
    
    // App Configuration
    appName: 'NexusPay Phone Wallet Demo',
    appDescription: 'Create crypto wallets with just your phone number',
    
    // Features
    features: {
        gaslessTransactions: true,
        crossChainSupport: true,
        paymasterEnabled: true,
        realBlockchainDeployment: true
    },
    
    // UI Configuration
    theme: {
        primary: '#6366f1',
        secondary: '#8b5cf6',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b'
    },
    
    // Development/Testing
    isDevelopment: false,
    enableDebugLogs: true,
    
    // Validation
    validateAPIKey: function() {
        if (!this.apiKey || !this.apiKey.startsWith('npay_proj_')) {
            console.error('❌ Invalid API key format');
            return false;
        }
        
        if (!this.projectName) {
            console.error('❌ Project name is required');
            return false;
        }
        
        console.log('✅ API key validation passed');
        return true;
    }
};

// Auto-validate configuration
if (CONFIG.validateAPIKey()) {
    console.log('🎉 NexusPay SDK configured successfully');
    console.log(`📱 App: ${CONFIG.appName}`);
    console.log(`🔑 Project: ${CONFIG.projectName}`);
    console.log(`🌐 Chains: ${CONFIG.supportedChains.join(', ')}`);
    console.log(`💳 Paymaster: ${CONFIG.features.paymasterEnabled ? 'Enabled' : 'Disabled'}`);
} else {
    console.error('❌ Configuration validation failed');
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
} else {
    window.CONFIG = CONFIG;
} 