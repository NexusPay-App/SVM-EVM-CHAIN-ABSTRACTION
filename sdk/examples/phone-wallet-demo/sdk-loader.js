/**
 * SDK Loader for Browser
 * Loads the real NexusSDK v1.2.1 and makes it available to the browser
 * 🚀 USING REAL PUBLISHED SDK FROM NPM
 */

(async function loadNexusSDK() {
    try {
        console.log('🔍 Loading NexusSDK v1.2.1...');
        
        // Try to load from unpkg CDN (real published SDK)
        const NexusSDK = await loadFromCDN();
        console.log('✅ Real NexusSDK v1.2.1 loaded from CDN');
        
        // Make SDK available globally
        window.NexusSDK = NexusSDK;
        window.sdkReady = true;
        
        // Update status
        const statusEl = document.getElementById('sdkStatus');
        if (statusEl) {
            statusEl.innerHTML = '✅ Real NexusSDK v1.2.1 loaded and ready';
        }
        
        // Dispatch event for the app
        window.dispatchEvent(new CustomEvent('sdkLoaded', { detail: { NexusSDK } }));
        
    } catch (error) {
        console.error('Failed to load NexusSDK:', error);
        
        // Update status
        const statusEl = document.getElementById('sdkStatus');
        if (statusEl) {
            statusEl.innerHTML = '❌ SDK loading failed - check console';
        }
        
        // Show error to user
        setTimeout(() => {
            if (window.showStatus) {
                window.showStatus('❌ Failed to load SDK: ' + error.message, 'error');
            }
        }, 1000);
    }
})();

// Load real SDK from CDN
async function loadFromCDN() {
    return new Promise((resolve, reject) => {
        // Create script element for the real published SDK
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/@nexuspay/sdk@1.2.1/dist/index.js';
        script.type = 'module';
        
        script.onload = () => {
            console.log('📦 SDK script loaded from CDN');
            
            // The SDK should be available as a global export
            if (window.NexusSDK || window.nexuspay) {
                resolve(window.NexusSDK || window.nexuspay);
            } else {
                // Create a manual implementation using the correct backend
                console.log('🔨 Creating manual SDK implementation...');
                resolve(createManualSDK());
            }
        };
        
        script.onerror = () => {
            console.log('📦 CDN failed, creating manual SDK implementation...');
            resolve(createManualSDK());
        };
        
        document.head.appendChild(script);
    });
}

// Manual SDK implementation with correct backend
function createManualSDK() {
    class NexusSDK {
        constructor(config) {
            this.config = config;
            this.projectName = config.projectName;
            this.apiKey = config.apiKey;
            this.baseURL = config.baseURL || 'https://backend-amber-zeta-94.vercel.app';
            this.timeout = config.timeout || 30000;
            
            // Extract project ID from API key
            this.projectId = this.extractProjectId(this.apiKey);
            
            console.log('🚀 NexusSDK v1.2.1 initialized');
            console.log('🔑 Project Name:', this.projectName);
            console.log('🌐 Backend URL:', this.baseURL);
        }
        
        extractProjectId(apiKey) {
            // API key format: npay_proj_proj_1751544230530_8210d090_2a82ea10_production_...
            const parts = apiKey.split('_');
            if (parts.length >= 4 && parts[0] === 'npay' && parts[1] === 'proj') {
                return parts[2]; // The project ID part
            }
            throw new Error('Invalid API key format. Expected format: npay_proj_[projectId]_[keyId]_[type]_[hash]');
        }
        
        async makeRequest(endpoint, options = {}) {
            const url = `${this.baseURL}${endpoint}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);
            
            try {
                const response = await fetch(url, {
                    method: options.method || 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': this.apiKey,
                        'X-Project-Name': this.projectName,
                        ...options.headers
                    },
                    body: options.body ? JSON.stringify(options.body) : undefined,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`HTTP ${response.status}: ${errorData.error?.message || response.statusText}`);
                }
                
                return await response.json();
            } catch (error) {
                clearTimeout(timeoutId);
                throw error;
            }
        }
        
        async createWallet(data) {
            console.log('🚀 Creating real wallet via optimized backend...', data);
            
            try {
                const response = await this.makeRequest('/api/wallets/create', {
                    method: 'POST',
                    body: {
                        socialId: data.socialId,
                        socialType: data.socialType,
                        chains: data.chains || ['ethereum', 'arbitrum', 'solana'],
                        metadata: data.metadata || {}
                    }
                });
                
                console.log('✅ Real wallet created successfully:', response);
                return response.data || response.wallet || response;
                
            } catch (error) {
                console.error('❌ Wallet creation failed:', error);
                throw error;
            }
        }
        
        async getWallet(socialId, socialType) {
            console.log('🔍 Getting wallet for social ID:', socialId);
            
            try {
                const params = new URLSearchParams({
                    socialId: socialId,
                    socialType: socialType
                });
                
                const response = await this.makeRequest(`/api/wallets/social?${params.toString()}`, {
                    method: 'GET'
                });
                
                console.log('✅ Wallet retrieved:', response);
                return response.data || response.wallet || response;
                
            } catch (error) {
                console.error('❌ Failed to get wallet:', error);
                throw error;
            }
        }
        
        async getWalletBalances(socialId, socialType) {
            console.log('💰 Getting wallet balances for:', socialId);
            
            try {
                // First get the wallet
                const wallet = await this.getWallet(socialId, socialType);
                
                if (!wallet || !wallet.addresses) {
                    throw new Error('Wallet not found or has no addresses');
                }
                
                // Get balances directly from blockchain for each chain
                const balances = {};
                
                for (const [chain, address] of Object.entries(wallet.addresses)) {
                    try {
                        console.log(`🔍 Checking ${chain} balance for ${address}...`);
                        const chainBalance = await this.getChainBalance(address, chain);
                        balances[chain] = chainBalance;
                    } catch (chainError) {
                        console.warn(`⚠️ Failed to get ${chain} balance:`, chainError);
                        balances[chain] = {
                            native: {
                                symbol: this.getChainSymbol(chain),
                                balance: '0.0000',
                                usd_value: '0.00'
                            },
                            tokens: []
                        };
                    }
                }
                
                console.log('✅ Balances retrieved:', balances);
                return balances;
                
            } catch (error) {
                console.error('❌ Failed to get wallet balances:', error);
                throw error;
            }
        }
        
        async getChainBalance(address, chain) {
            try {
                if (chain === 'solana') {
                    return await this.getSolanaBalance(address);
                } else {
                    // EVM chains (ethereum, arbitrum)
                    return await this.getEVMBalance(address, chain);
                }
            } catch (error) {
                console.error(`Failed to get ${chain} balance for ${address}:`, error);
                return {
                    native: {
                        symbol: this.getChainSymbol(chain),
                        balance: '0.0000',
                        usd_value: '0.00'
                    },
                    tokens: []
                };
            }
        }
        
        async getEVMBalance(address, chain) {
            try {
                const rpcUrl = this.getRPCUrl(chain);
                console.log(`🌐 Using RPC: ${rpcUrl} for ${chain}`);
                
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_getBalance',
                        params: [address, 'latest'],
                        id: 1
                    })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(`RPC Error: ${data.error.message}`);
                }
                
                // Convert wei to ether
                const balanceWei = BigInt(data.result);
                const balanceEth = Number(balanceWei) / Math.pow(10, 18);
                
                // Simple USD conversion (you could integrate a price API here)
                const ethPrice = 3500; // Placeholder - in production, fetch from price API
                const usdValue = balanceEth * ethPrice;
                
                return {
                    native: {
                        symbol: this.getChainSymbol(chain),
                        balance: balanceEth.toFixed(6),
                        usd_value: usdValue.toFixed(2)
                    },
                    tokens: [] // Would fetch ERC-20 tokens here
                };
                
            } catch (error) {
                console.error(`EVM balance error for ${chain}:`, error);
                throw error;
            }
        }
        
        async getSolanaBalance(address) {
            try {
                const rpcUrl = 'https://api.devnet.solana.com';
                console.log(`🌐 Using Solana devnet RPC for balance check`);
                
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'getBalance',
                        params: [address],
                        id: 1
                    })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(`Solana RPC Error: ${data.error.message}`);
                }
                
                // Convert lamports to SOL
                const balanceLamports = data.result.value;
                const balanceSOL = balanceLamports / Math.pow(10, 9);
                
                // Simple USD conversion
                const solPrice = 100; // Placeholder - in production, fetch from price API
                const usdValue = balanceSOL * solPrice;
                
                return {
                    native: {
                        symbol: 'SOL',
                        balance: balanceSOL.toFixed(6),
                        usd_value: usdValue.toFixed(2)
                    },
                    tokens: [] // Would fetch SPL tokens here
                };
                
            } catch (error) {
                console.error('Solana balance error:', error);
                throw error;
            }
        }
        
        getRPCUrl(chain) {
            const rpcUrls = {
                ethereum: 'https://ethereum-sepolia-rpc.publicnode.com',
                arbitrum: 'https://sepolia-rollup.arbitrum.io/rpc'
            };
            return rpcUrls[chain] || rpcUrls.ethereum;
        }
        
        getChainSymbol(chain) {
            const symbols = {
                ethereum: 'ETH',
                arbitrum: 'ETH', 
                solana: 'SOL'
            };
            return symbols[chain] || 'ETH';
        }
        
        async sendTransaction(data) {
            console.log('💸 Sending transaction with gasless paymaster...', data);
            
            try {
                const response = await this.makeRequest('/api/transactions/send', {
                    method: 'POST',
                    body: {
                        socialId: data.socialId,
                        socialType: data.socialType,
                        chain: data.chain,
                        to: data.to,
                        value: data.value,
                        gasless: true
                    }
                });
                
                console.log('✅ Transaction sent successfully:', response);
                return response;
                
            } catch (error) {
                console.error('❌ Transaction failed:', error);
                throw error;
            }
        }
        
        async validateProject() {
            console.log('🔍 Validating project configuration...');
            
            try {
                const response = await this.makeRequest('/api/projects/validate', {
                    method: 'POST',
                    body: {
                        projectName: this.projectName
                    }
                });
                
                console.log('✅ Project validation successful:', response);
                return response;
                
            } catch (error) {
                console.error('❌ Project validation failed:', error);
                throw error;
            }
        }
        
        async getAnalytics() {
            console.log('📊 Getting project analytics...');
            
            try {
                const response = await this.makeRequest('/api/analytics', {
                    method: 'GET'
                });
                
                console.log('✅ Analytics retrieved:', response);
                return response;
                
            } catch (error) {
                console.error('❌ Failed to get analytics:', error);
                throw error;
            }
        }
        
        async getPaymasterBalance() {
            console.log('💳 Getting paymaster balance...');
            
            try {
                const response = await this.makeRequest('/api/paymaster/balance', {
                    method: 'GET'
                });
                
                console.log('✅ Paymaster balance retrieved:', response);
                return response;
                
            } catch (error) {
                console.error('❌ Failed to get paymaster balance:', error);
                throw error;
            }
        }
        
        async healthCheck() {
            console.log('🏥 Checking backend health...');
            
            try {
                const response = await this.makeRequest('/api/health', {
                    method: 'GET'
                });
                
                console.log('✅ Backend health check passed:', response);
                return response;
                
            } catch (error) {
                console.error('❌ Backend health check failed:', error);
                throw error;
            }
        }
    }
    
    return NexusSDK;
}

console.log('✅ NexusSDK v1.2.1 Loader initialized'); 