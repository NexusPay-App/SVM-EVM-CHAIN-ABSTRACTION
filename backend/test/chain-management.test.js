const request = require('supertest');
const app = require('../server');

describe('Chain Management System - TICKET-006 Completion Tests', () => {
    let authToken;
    let testProjectId;
    
    beforeAll(async () => {
        // This would normally require actual authentication
        // For now, we'll mock the token
        authToken = 'mock-auth-token';
    });

    describe('1. Chain Configuration API', () => {
        it('should load supported chains from centralized config', async () => {
            const res = await request(app)
                .get('/api/chains')
                .expect(200);
            
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data.chains)).toBe(true);
            expect(res.body.data.chains.length).toBeGreaterThanOrEqual(3);
            
            // Verify the 3 core chains exist
            const chainIds = res.body.data.chains.map(c => c.id);
            expect(chainIds).toContain('ethereum');
            expect(chainIds).toContain('arbitrum');
            expect(chainIds).toContain('solana');
        });

        it('should return proper chain structure with all required fields', async () => {
            const res = await request(app)
                .get('/api/chains')
                .expect(200);
            
            const chain = res.body.data.chains[0];
            expect(chain).toHaveProperty('id');
            expect(chain).toHaveProperty('name');
            expect(chain).toHaveProperty('type');
            expect(chain).toHaveProperty('rpcUrl');
            expect(chain).toHaveProperty('chainId');
            expect(chain).toHaveProperty('currency');
            expect(chain).toHaveProperty('isTestnet');
            expect(chain).toHaveProperty('contracts');
        });

        it('should validate EVM vs SVM chain types', async () => {
            const res = await request(app)
                .get('/api/chains')
                .expect(200);
            
            const evmChains = res.body.data.chains.filter(c => c.type === 'EVM');
            const svmChains = res.body.data.chains.filter(c => c.type === 'SVM');
            
            expect(evmChains.length).toBeGreaterThanOrEqual(2); // ethereum, arbitrum
            expect(svmChains.length).toBeGreaterThanOrEqual(1); // solana
            
            // EVM chains should have EntryPoint and factory addresses
            evmChains.forEach(chain => {
                expect(chain.contracts).toHaveProperty('entryPoint');
                expect(chain.contracts).toHaveProperty('walletFactory');
            });
        });
    });

    describe('2. Dynamic Chain Addition API', () => {
        const testChain = {
            chainId: 'polygon_mumbai',
            name: 'Polygon Mumbai',
            type: 'EVM',
            rpcUrl: 'https://rpc-mumbai.maticvigil.com',
            chainIdNumber: 80001,
            currency: 'MATIC',
            explorerUrl: 'https://mumbai.polygonscan.com'
        };

        it('should add new chain via API', async () => {
            const res = await request(app)
                .post('/api/chains')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testChain)
                .expect(201);
            
            expect(res.body.success).toBe(true);
            expect(res.body.data.chain.chainId).toBe('polygon_mumbai');
        });

        it('should validate required fields when adding chain', async () => {
            const invalidChain = { name: 'Incomplete Chain' };
            
            await request(app)
                .post('/api/chains')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidChain)
                .expect(400);
        });

        it('should prevent duplicate chain IDs', async () => {
            // Try to add the same chain again
            await request(app)
                .post('/api/chains')
                .set('Authorization', `Bearer ${authToken}`)
                .send(testChain)
                .expect(409);
        });

        it('should retrieve newly added chain in chains list', async () => {
            const res = await request(app)
                .get('/api/chains')
                .expect(200);
            
            const chainIds = res.body.data.chains.map(c => c.id);
            expect(chainIds).toContain('polygon_mumbai');
        });
    });

    describe('3. Project Creation with Dynamic Chains', () => {
        it('should create project with ethereum, arbitrum, and solana', async () => {
            const projectData = {
                name: 'Test Multi-Chain Project',
                description: 'Testing the completed chain system',
                chains: ['ethereum', 'arbitrum', 'solana']
            };

            const res = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send(projectData)
                .expect(201);
            
            expect(res.body.success).toBe(true);
            testProjectId = res.body.data.project.id;
            
            // Should create paymasters for all 3 chains
            expect(res.body.data.paymasters_created).toHaveLength(3);
        });

        it('should reject project with unsupported chain', async () => {
            const projectData = {
                name: 'Invalid Project',
                chains: ['nonexistent_chain']
            };

            await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send(projectData)
                .expect(400);
        });
    });

    describe('4. Unified Address Generation', () => {
        it('should generate same EVM address for ethereum and arbitrum', async () => {
            const res = await request(app)
                .get(`/api/projects/${testProjectId}/paymaster/addresses`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            const addresses = res.body.data.addresses;
            expect(addresses.ethereum).toBe(addresses.arbitrum);
            expect(addresses.solana).not.toBe(addresses.ethereum);
        });

        it('should maintain consistent addresses across deployments', async () => {
            // Get addresses multiple times
            const res1 = await request(app)
                .get(`/api/projects/${testProjectId}/paymaster/addresses`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
                
            const res2 = await request(app)
                .get(`/api/projects/${testProjectId}/paymaster/addresses`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            expect(res1.body.data.addresses).toEqual(res2.body.data.addresses);
        });
    });

    describe('5. Chain-Specific Project IDs', () => {
        it('should use chain-specific project IDs for factory deployments', async () => {
            // This test would verify that paymasters are deployed with
            // proj_123_ethereum vs proj_123_arbitrum format
            
            const res = await request(app)
                .get(`/api/projects/${testProjectId}/paymaster/deployment-details`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            const details = res.body.data;
            expect(details.ethereum.deployment_project_id).toContain('_ethereum');
            expect(details.arbitrum.deployment_project_id).toContain('_arbitrum');
            expect(details.solana.deployment_project_id).toContain('_solana');
        });
    });

    describe('6. Business Model - Developer Funding', () => {
        it('should not automatically fund paymaster wallets', async () => {
            const res = await request(app)
                .get(`/api/projects/${testProjectId}/paymaster/balance`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            const balance = res.body.data.balances.ethereum;
            expect(balance.balance).toBe('0');
        });

        it('should provide funding instructions to developers', async () => {
            const res = await request(app)
                .get(`/api/projects/${testProjectId}/paymaster/funding-instructions`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            const instructions = res.body.data.instructions;
            expect(instructions).toHaveProperty('ethereum');
            expect(instructions).toHaveProperty('arbitrum');
            expect(instructions).toHaveProperty('solana');
            
            expect(typeof instructions.ethereum.funding_address).toBe('string');
            expect(typeof instructions.ethereum.minimum_amount).toBe('number');
            expect(typeof instructions.ethereum.faucet_url).toBe('string');
        });
    });

    describe('7. Gas Optimization Configuration', () => {
        it('should configure different gas settings per chain type', async () => {
            const res = await request(app)
                .get('/api/chains/gas-config')
                .expect(200);
            
            const gasConfig = res.body.data;
            const ethereum = gasConfig.ethereum;
            const arbitrum = gasConfig.arbitrum;
            
            expect(arbitrum.gasPrice).toBeLessThan(ethereum.gasPrice);
            expect(arbitrum.gasLimit).toBe(100000); // L2 optimization
            expect(ethereum.gasLimit).toBe(21000); // L1 standard
        });
    });

    describe('8. Chain Management UI Integration', () => {
        it('should serve chain management dashboard', async () => {
            const res = await request(app)
                .get('/dashboard/chains')
                .expect(200);
            
            expect(res.text).toContain('⛓️ Chain Management');
            expect(res.text).toContain('showAddChainModal');
            expect(res.text).toContain('loadSupportedChains');
        });

        it('should include JavaScript for dynamic chain addition', async () => {
            const res = await request(app)
                .get('/dashboard/chains')
                .expect(200);
            
            expect(res.text).toContain('addChainModal');
            expect(res.text).toContain('Add New Chain');
            expect(res.text).toContain('Chain Type');
        });
    });

    describe('9. End-to-End Workflow Validation', () => {
        it('should complete full chain addition and project creation workflow', async () => {
            // Add a new chain
            const newChain = {
                chainId: 'optimism_goerli',
                name: 'Optimism Goerli',
                type: 'EVM',
                rpcUrl: 'https://goerli.optimism.io',
                chainIdNumber: 420,
                currency: 'ETH'
            };

            await request(app)
                .post('/api/chains')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newChain)
                .expect(201);

            // Verify it appears in chains list
            const chainsRes = await request(app)
                .get('/api/chains')
                .expect(200);
            
            const chainIds = chainsRes.body.data.chains.map(c => c.id);
            expect(chainIds).toContain('optimism_goerli');

            // Create project with the new chain
            const projectRes = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Optimism Test Project',
                    chains: ['optimism_goerli']
                })
                .expect(201);

            expect(projectRes.body.data.paymasters_created).toHaveLength(1);
        });

        it('should handle chain configuration errors gracefully', async () => {
            const invalidChain = {
                chainId: 'invalid_chain',
                rpcUrl: 'not-a-valid-url'
            };

            const res = await request(app)
                .post('/api/chains')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidChain)
                .expect(400);

            expect(res.body.error).toBeDefined();
        });
    });

    describe('10. Cross-Chain Address Consistency', () => {
        it('should maintain EVM address consistency across all EVM chains', async () => {
            const res = await request(app)
                .get(`/api/projects/${testProjectId}/paymaster/addresses`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            const addresses = res.body.data.addresses;
            
            // All EVM chains should have the same address
            expect(addresses.ethereum).toBe(addresses.arbitrum);
            
            // But SVM should be different
            expect(addresses.solana).not.toBe(addresses.ethereum);
            
            // Verify address formats
            expect(addresses.ethereum).toMatch(/^0x[a-fA-F0-9]{40}$/);
            expect(addresses.solana).toMatch(/^[A-Za-z0-9]{40,50}$/);
        });

        it('should validate complete system integration', async () => {
            const res = await request(app)
                .get('/api/chains')
                .expect(200);
            
            const chains = res.body.data.chains;
            expect(Array.isArray(chains)).toBe(true);
            expect(chains.length).toBeGreaterThanOrEqual(3);
            
            const chainIds = chains.map(c => c.id);
            expect(chainIds).toEqual(expect.arrayContaining(['ethereum', 'arbitrum', 'solana']));
            
            // Verify EntryPoint standardization across EVM chains
            const evmChains = chains.filter(c => c.type === 'EVM');
            const entryPoints = evmChains.map(c => c.contracts.entryPoint);
            const uniqueEntryPoints = [...new Set(entryPoints)];
            
            expect(uniqueEntryPoints).toHaveLength(1);
            expect(uniqueEntryPoints[0]).toBe('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789');
        });
    });
});

/**
 * Integration tests for specific business logic
 */
describe('TICKET-006 Business Logic Tests', () => {
    describe('Address Unification', () => {
        it('should generate unified addresses correctly', () => {
            const chainConfig = require('../config/chains');
            
            const addresses = chainConfig.generateCrossChainAddresses('test-project-123');
            
            // EVM chains should share addresses
            expect(addresses.ethereum).toBe(addresses.arbitrum);
            
            // SVM should be different
            expect(addresses.solana).not.toBe(addresses.ethereum);
            
            // All addresses should be valid
            expect(addresses.ethereum).toMatch(/^0x[a-fA-F0-9]{40}$/);
            expect(addresses.solana).toMatch(/^[A-Za-z0-9]{40,50}$/);
        });
    });

    describe('Chain Configuration Loading', () => {
        it('should load all chains from centralized config', () => {
            const chainConfig = require('../config/chains');
            const chains = chainConfig.getAllChains();
            
            expect(chains).toBeInstanceOf(Array);
            expect(chains.length).toBeGreaterThanOrEqual(3);
            
            const chainIds = chains.map(c => c.id);
            expect(chainIds).toEqual(expect.arrayContaining(['ethereum', 'arbitrum', 'solana']));
        });
    });

    describe('Factory Contract Compatibility', () => {
        it('should use consistent EntryPoint addresses', () => {
            const chainConfig = require('../config/chains');
            const evmChains = chainConfig.getChainsByType('EVM');
            
            const entryPoints = evmChains.map(c => c.contracts.entryPoint);
            const uniqueEntryPoints = [...new Set(entryPoints)];
            
            // All EVM chains should use the same EntryPoint
            expect(uniqueEntryPoints).toHaveLength(1);
            expect(uniqueEntryPoints[0]).toBe('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789');
        });
    });
}); 