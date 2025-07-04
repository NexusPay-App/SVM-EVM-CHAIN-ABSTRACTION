/**
 * Phone Wallet Demo - Real Blockchain Wallet Creation
 * Using NexusSDK v1.2.1 with live backend deployment
 * 🚀 REAL WALLET DEPLOYMENT - NO MOCK DATA
 */

// Load configuration
const config = window.CONFIG;

// NexusSDK instance (will be initialized)
let nexusSDK = null;

// Application state
let currentUser = null;
let userWallets = null;
let isLoading = false;
let selectedChain = 'ethereum';

// Wait for SDK to be loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 NexusPay Phone Wallet Demo - Real Blockchain Deployment with SDK v1.2.1');
    
    // Wait for SDK to load
    if (window.sdkReady) {
        initializeApp();
    } else {
        window.addEventListener('sdkLoaded', initializeApp);
    }
});

// Initialize the application
async function initializeApp() {
    console.log('📱 Initializing Phone Wallet Demo...');
    
    try {
        // Initialize NexusSDK with simplified configuration
        console.log('⚡ Initializing NexusSDK...');
        
        // Check if SDK is loaded
        if (typeof NexusSDK === 'undefined') {
            throw new Error('NexusSDK not loaded. Please check if the SDK script is included.');
        }
        
        // Initialize with just 2 parameters!
        nexusSDK = new NexusSDK({
            projectName: config.projectName,
            apiKey: config.apiKey
            // baseURL is auto-configured to https://backend-amber-zeta-94.vercel.app
        });
        
        console.log('✅ NexusSDK initialized successfully');
        console.log('🌐 Backend:', config.backendUrl);
        console.log('🔑 Project:', config.projectName);
        
        // Set up event listeners
        setupEventListeners();
        
        // Check if user is already logged in
        const savedUser = localStorage.getItem('nexuspay_user');
        if (savedUser) {
            try {
                currentUser = JSON.parse(savedUser);
                console.log('👤 User already logged in:', currentUser.phoneNumber);
                showWalletSection();
            } catch (error) {
                console.error('❌ Failed to load saved user:', error);
                showLoginSection();
            }
        } else {
            showLoginSection();
        }
        
    } catch (error) {
        console.error('❌ Failed to initialize app:', error);
        showStatus('❌ Failed to initialize: ' + error.message, 'error');
        showLoginSection();
    }
}

// Set up event listeners
function setupEventListeners() {
    // Login button
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    
    // Chain selector buttons
    const chainBtns = document.querySelectorAll('.chain-btn');
    chainBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            chainBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            selectedChain = e.target.dataset.chain;
        });
    });
    
    // Show send button
    const showSendBtn = document.getElementById('showSendBtn');
    if (showSendBtn) {
        showSendBtn.addEventListener('click', () => {
            const sendSection = document.getElementById('sendSection');
            if (sendSection) {
                sendSection.classList.toggle('show');
            }
        });
    }
    
    // Send button
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendFunds);
    }
    
    // Cancel send button
    const cancelSendBtn = document.getElementById('cancelSendBtn');
    if (cancelSendBtn) {
        cancelSendBtn.addEventListener('click', () => {
            const sendSection = document.getElementById('sendSection');
            if (sendSection) {
                sendSection.classList.remove('show');
            }
        });
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadWalletBalances);
    }
    
    // Phone number formatting
    const phoneInput = document.getElementById('phoneNumber');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            const value = e.target.value.replace(/\D/g, '');
            if (value.length <= 10) {
                e.target.value = value.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
            }
        });
    }
}

// Show login section
function showLoginSection() {
    const loginSection = document.getElementById('loginSection');
    const walletSection = document.getElementById('walletSection');
    
    if (loginSection) loginSection.style.display = 'block';
    if (walletSection) walletSection.classList.remove('show');
    
    showStatus('Enter your phone number to create real blockchain wallets', 'info');
}

// Show wallet section
function showWalletSection() {
    const loginSection = document.getElementById('loginSection');
    const walletSection = document.getElementById('walletSection');
    
    if (loginSection) loginSection.style.display = 'none';
    if (walletSection) walletSection.classList.add('show');
    
    // Load user wallets
    loadUserWallets();
}

// Handle login
async function handleLogin() {
    const phoneNumber = document.getElementById('phoneNumber').value;
    const password = document.getElementById('password').value;
    
    if (!phoneNumber || !password) {
        showStatus('Please enter both phone number and password', 'error');
        return;
    }
    
    await loginUser(phoneNumber, password);
}

// Login user
async function loginUser(phoneNumber, password) {
    setLoading(true);
    showStatus('🔐 Authenticating user...', 'info');
    
    try {
        // Format phone number
        const formattedPhone = formatPhoneNumber(phoneNumber);
        
        // Simple authentication (in production, use proper auth)
        const userId = btoa(formattedPhone + password);
        
        currentUser = {
            id: userId,
            phoneNumber: formattedPhone,
            password: password,
            loginTime: new Date().toISOString()
        };
        
        // Save user to localStorage
        localStorage.setItem('nexuspay_user', JSON.stringify(currentUser));
        
        console.log('✅ User authenticated successfully');
        showStatus('✅ Authentication successful', 'success');
        
        // Show wallet section
        showWalletSection();
        
    } catch (error) {
        console.error('❌ Authentication failed:', error);
        showStatus('❌ Authentication failed: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Load user wallets using NexusSDK
async function loadUserWallets() {
    if (!currentUser || !nexusSDK) return;
    
    setLoading(true);
    showStatus('🚀 Creating real blockchain wallets with NexusSDK...', 'info');
    
    try {
        console.log('📱 Using NexusSDK to create real wallets for:', currentUser.phoneNumber);
        
        // First, try to get existing wallet
        let wallet = null;
        try {
            console.log('🔍 Checking for existing wallet...');
            wallet = await nexusSDK.getWallet(currentUser.phoneNumber, 'phone');
            console.log('✅ Found existing wallet:', wallet);
            showStatus('✅ Retrieved existing wallet', 'success');
        } catch (error) {
            console.log('📱 No existing wallet found, creating new one...');
            
            // Create new wallet using simplified SDK
            console.log('🚀 Creating new real blockchain wallet...');
            wallet = await nexusSDK.createWallet({
                socialId: currentUser.phoneNumber,
                socialType: 'phone'
                // chains: auto-configured to all project chains
                // gasless: auto-enabled
            });
            
            console.log('🎉 Real blockchain wallet created successfully:', wallet);
            showStatus('🎉 Real blockchain wallet created successfully!', 'success');
        }
        
        // Handle different response structures
        if (!wallet) {
            throw new Error('Wallet creation returned empty response');
        }
        
        console.log('📊 Wallet object structure:', wallet);
        
        // Store wallet data with fallbacks for different response structures
        userWallets = {
            walletId: wallet.id || wallet.walletId || `wallet_${Date.now()}`,
            addresses: wallet.addresses || {},
            gaslessEnabled: wallet.gasless_enabled !== false,
            status: wallet.status || 'created',
            deploymentStatus: wallet.deployment_status || {},
            socialId: wallet.socialId || currentUser.phoneNumber,
            socialType: wallet.socialType || 'phone',
            projectId: wallet.project_id || 'unknown',
            createdAt: wallet.created_at || new Date().toISOString(),
            realBlockchain: true
        };
        
        // Update UI
        updateWalletDisplay();
        
        // Load balances
        await loadWalletBalances();
        
        console.log('💳 Wallet setup complete:', userWallets);
        
    } catch (error) {
        console.error('❌ Failed to create/load wallet:', error);
        
        // Show detailed error with suggestions
        let errorMessage = error.message;
        if (error.suggestions && error.suggestions.length > 0) {
            errorMessage += '\n\nSuggestions:\n' + error.suggestions.map(s => `• ${s}`).join('\n');
        }
        
        showStatus('❌ Failed to create wallet: ' + errorMessage, 'error');
    } finally {
        setLoading(false);
    }
}

// Update wallet display
function updateWalletDisplay() {
    const walletAddresses = document.getElementById('walletAddresses');
    const walletBalances = document.getElementById('walletBalances');
    
    if (!userWallets || !userWallets.addresses || !walletAddresses) {
        if (walletAddresses) walletAddresses.innerHTML = '<p>No wallets available</p>';
        return;
    }
    
    // Show wallet addresses
    walletAddresses.innerHTML = `
        <h3>🏦 Wallet Addresses</h3>
        <div class="wallet-summary">
            <div class="detail-item">
                <strong>🆔 Wallet ID:</strong> ${formatAddress(userWallets.walletId)}
            </div>
            <div class="detail-item">
                <strong>📱 Phone:</strong> ${userWallets.socialId}
            </div>
            <div class="detail-item">
                <strong>🔗 Chains:</strong> ${Object.keys(userWallets.addresses).length}
            </div>
            <div class="detail-item">
                <strong>💳 Gasless:</strong> ${userWallets.gaslessEnabled ? '✅ Enabled' : '❌ Disabled'}
            </div>
            <div class="detail-item">
                <strong>🚀 Status:</strong> ${userWallets.status} - Real Blockchain
            </div>
        </div>
        <div class="addresses-list">
            ${Object.entries(userWallets.addresses).map(([chain, address]) => {
                const deploymentStatus = userWallets.deploymentStatus ? userWallets.deploymentStatus[chain] : 'confirmed';
                const isDeployed = deploymentStatus === 'confirmed';
                
                return `
                    <div class="address-item">
                        <div class="chain-header">
                            <span class="chain-name">${getChainEmoji(chain)} ${chain.charAt(0).toUpperCase() + chain.slice(1)}</span>
                            <span class="status ${isDeployed ? 'deployed' : 'pending'}">
                                ${isDeployed ? '✅ Deployed' : '⏳ ' + deploymentStatus}
                            </span>
                        </div>
                        <div class="address-display">
                            <span class="address">${formatAddress(address)}</span>
                            <button onclick="copyAddress('${address}')" class="copy-btn">📋</button>
                        </div>
                        <div class="address-links">
                            <a href="${getExplorerUrl(chain, address)}" target="_blank" class="explorer-link">
                                🔍 View on ${chain.charAt(0).toUpperCase() + chain.slice(1)} Explorer
                            </a>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// Load wallet balances using NexusSDK
async function loadWalletBalances() {
    if (!userWallets || !userWallets.addresses || !nexusSDK) return;
    
    const walletBalances = document.getElementById('walletBalances');
    if (!walletBalances) return;
    
    console.log('💰 Loading real blockchain balances...');
    walletBalances.innerHTML = '<h3>💰 Loading balances...</h3>';
    
    try {
        // Use NexusSDK to get wallet balances
        const balances = await nexusSDK.getWalletBalances(currentUser.phoneNumber, 'phone');
        console.log('💰 Loaded balances:', balances);
        
        // Update balance display
        const balanceItems = Object.entries(userWallets.addresses).map(([chain]) => {
            const chainBalance = balances[chain];
            
            if (chainBalance && chainBalance.native) {
                const nativeBalance = chainBalance.native;
                return `
                    <div class="chain-balance">
                        <div class="chain-name">${getChainEmoji(chain)} ${chain.charAt(0).toUpperCase() + chain.slice(1)}</div>
                        <div class="chain-balance-amount">
                            <div class="native-balance">
                                ${parseFloat(nativeBalance.balance).toFixed(4)} ${nativeBalance.symbol}
                            </div>
                            <div class="usd-balance">
                                $${parseFloat(nativeBalance.usd_value).toFixed(2)} USD
                            </div>
                            ${chainBalance.tokens && chainBalance.tokens.length > 0 ? `
                                <div class="token-count">
                                    +${chainBalance.tokens.length} tokens
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="chain-balance">
                        <div class="chain-name">${getChainEmoji(chain)} ${chain.charAt(0).toUpperCase() + chain.slice(1)}</div>
                        <div class="chain-balance-amount">
                            <div class="balance-unavailable">Balance unavailable</div>
                        </div>
                    </div>
                `;
            }
        }).join('');
        
        walletBalances.innerHTML = `
            <h3>💰 Wallet Balances</h3>
            <div class="balances-list">
                ${balanceItems}
            </div>
        `;
        
    } catch (error) {
        console.error('❌ Error loading balances:', error);
        walletBalances.innerHTML = `
            <h3>💰 Wallet Balances</h3>
            <div class="balance-error">
                ❌ Error loading balances: ${error.message}
            </div>
        `;
    }
}

// Handle send funds
async function handleSendFunds() {
    const recipientPhone = document.getElementById('recipientPhone').value;
    const amount = document.getElementById('amount').value;
    
    if (!recipientPhone || !amount) {
        showStatus('Please enter recipient phone and amount', 'error');
        return;
    }
    
    await sendFunds(selectedChain, recipientPhone, amount);
}

// Send funds using NexusSDK
async function sendFunds(chain, recipientPhone, amount) {
    setLoading(true);
    showStatus(`💸 Sending ${amount} ${chain.toUpperCase()} to ${recipientPhone}...`, 'info');
    
    try {
        // First, get recipient's wallet address
        let recipientAddress;
        try {
            const recipientWallet = await nexusSDK.getWallet(recipientPhone, 'phone');
            recipientAddress = recipientWallet.addresses[chain];
        } catch (error) {
            showStatus('❌ Recipient wallet not found. They need to create a wallet first.', 'error');
            return;
        }
        
        // Use NexusSDK for gasless transaction
        const result = await nexusSDK.sendTransaction({
            socialId: currentUser.phoneNumber,
            socialType: 'phone',
            chain: chain,
            to: recipientAddress,
            value: (parseFloat(amount) * 1e18).toString() // Convert to wei
        });
        
        console.log('✅ Transaction sent:', result);
        showStatus(`✅ Transaction sent! Hash: ${result.transactionHash}`, 'success');
        
        // Hide send section
        const sendSection = document.getElementById('sendSection');
        if (sendSection) {
            sendSection.classList.remove('show');
        }
        
        // Clear form
        document.getElementById('recipientPhone').value = '';
        document.getElementById('amount').value = '';
        
        // Refresh balances
        setTimeout(() => loadWalletBalances(), 3000);
        
    } catch (error) {
        console.error('❌ Transaction failed:', error);
        showStatus('❌ Transaction failed: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Utility functions
function formatPhoneNumber(phone) {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    
    // Add country code if missing
    if (!digits.startsWith('1') && digits.length === 10) {
        return '+1' + digits;
    } else if (digits.startsWith('1') && digits.length === 11) {
        return '+' + digits;
    }
    
    return phone; // Return as-is if format is unclear
}

function formatAddress(address) {
    if (!address) return '';
    if (address.length <= 12) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

function getChainEmoji(chain) {
    const emojis = {
        ethereum: '⟡',
        arbitrum: '🔵',
        solana: '🌟'
    };
    return emojis[chain] || '🔗';
}

function getExplorerUrl(chain, address) {
    const explorers = {
        ethereum: `https://sepolia.etherscan.io/address/${address}`, // Sepolia testnet
        arbitrum: `https://sepolia.arbiscan.io/address/${address}`, // Arbitrum Sepolia testnet  
        solana: `https://explorer.solana.com/account/${address}?cluster=devnet` // Solana devnet
    };
    return explorers[chain] || '#';
}

function copyAddress(address) {
    navigator.clipboard.writeText(address).then(() => {
        showStatus(`📋 Address copied: ${formatAddress(address)}`, 'success');
    }).catch(() => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = address;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showStatus(`📋 Address copied: ${formatAddress(address)}`, 'success');
    });
}

function showStatus(message, type = 'info') {
    const statusMessages = document.getElementById('statusMessages');
    if (!statusMessages) return;
    
    const statusEl = document.createElement('div');
    statusEl.className = `status ${type}`;
    statusEl.textContent = message;
    
    statusMessages.appendChild(statusEl);
    
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Auto-clear success/error messages after 5 seconds
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            if (statusEl.parentNode) {
                statusEl.parentNode.removeChild(statusEl);
            }
        }, 5000);
    }
}

function setLoading(loading) {
    isLoading = loading;
    
    // Update login button
    const loginBtn = document.getElementById('loginBtn');
    const loginText = document.getElementById('loginText');
    const loginLoader = document.getElementById('loginLoader');
    
    if (loginBtn) {
        loginBtn.disabled = loading;
        if (loginText) loginText.textContent = loading ? 'Creating Wallets...' : 'Login / Create Wallet';
        if (loginLoader) loginLoader.classList.toggle('hidden', !loading);
    }
    
    // Update send button
    const sendBtn = document.getElementById('sendBtn');
    const sendText = document.getElementById('sendText');
    const sendLoader = document.getElementById('sendLoader');
    
    if (sendBtn) {
        sendBtn.disabled = loading;
        if (sendText) sendText.textContent = loading ? 'Sending...' : '⚡ Send (Gasless)';
        if (sendLoader) sendLoader.classList.toggle('hidden', !loading);
    }
}

// Make functions available globally for onclick handlers
window.copyAddress = copyAddress;

console.log('✅ Real Blockchain Wallet Demo initialized'); 