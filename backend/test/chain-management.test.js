const request = require('supertest');
const app = require('../server');
const { expect } = require('chai');

describe('Chain Management System - TICKET-006 Completion Tests', () => {
    let authToken;
    let testProjectId;
    
    before(async () => {
        // This would normally require actual authentication
        // For now, we'll mock the token
        authToken = 'mock-auth-token';
    });

    describe('1. Chain Configuration API', () => {
        it('should load supported chains from centralized config', async () => {
            const res = await request(app)
                .get('/api/chains')
                .expect(200);
            
            expect(res.body.success).to.be.true;
            expect(res.body.data.chains).to.be.an('array');
            expect(res.body.data.chains).to.have.length.at.least(3);
            
            // Verify the 3 core chains exist
            const chainIds = res.body.data.chains.map(c => c.id);
            expect(chainIds).to.include('ethereum');
            expect(chainIds).to.include('arbitrum');
            expect(chainIds).to.include('solana');
        });

        it('should return proper chain structure with all required fields', async () => {
            const res = await request(app)
                .get('/api/chains')
                .expect(200);
            
            const chain = res.body.data.chains[0];
            expect(chain).to.have.property('id');
            expect(chain).to.have.property('name');
            expect(chain).to.have.property('type');
            expect(chain).to.have.property('rpcUrl');
            expect(chain).to.have.property('chainId');
            expect(chain).to.have.property('currency');
            expect(chain).to.have.property('isTestnet');
            expect(chain).to.have.property('contracts');
        });

        it('should validate EVM vs SVM chain types', async () => {
            const res = await request(app)
                .get('/api/chains')
                .expect(200);
            
            const evmChains = res.body.data.chains.filter(c => c.type === 'EVM');
            const svmChains = res.body.data.chains.filter(c => c.type === 'SVM');
            
            expect(evmChains).to.have.length.at.least(2); // ethereum, arbitrum
            expect(svmChains).to.have.length.at.least(1); // solana
            
            // EVM chains should have EntryPoint and factory addresses
            evmChains.forEach(chain => {
                expect(chain.contracts).to.have.property('entryPoint');
                expect(chain.contracts).to.have.property('walletFactory');
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
            
            expect(res.body.success).to.be.true;
            expect(res.body.data.chain.chainId).to.equal('polygon_mumbai');
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
            expect(chainIds).to.include('polygon_mumbai');
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
            
            expect(res.body.success).to.be.true;
            testProjectId = res.body.data.project.id;
            
            // Should create paymasters for all 3 chains
            expect(res.body.data.paymasters_created).to.have.length(3);
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
            expect(addresses.ethereum).to.equal(addresses.arbitrum);
            expect(addresses.solana).to.not.equal(addresses.ethereum);
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
            
            expect(res1.body.data.addresses).to.deep.equal(res2.body.data.addresses);
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
            expect(details.ethereum.deployment_project_id).to.include('_ethereum');
            expect(details.arbitrum.deployment_project_id).to.include('_arbitrum');
            expect(details.solana.deployment_project_id).to.include('_solana');
        });
    });

    describe('6. Business Model - Developer Funding', () => {
        it('should not automatically fund paymaster wallets', async () => {
            const res = await request(app)
                .get(`/api/projects/${testProjectId}/paymaster/balance`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            const balances = res.body.data;
            // All balances should be 0 initially (no auto-funding)
            Object.values(balances).forEach(balance => {
                expect(balance.balance).to.equal('0');
            });
        });

        it('should provide funding instructions', async () => {
            const res = await request(app)
                .get(`/api/projects/${testProjectId}/paymaster/funding-instructions`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
            
            const instructions = res.body.data;
            expect(instructions).to.have.property('ethereum');
            expect(instructions).to.have.property('arbitrum');
            expect(instructions).to.have.property('solana');
            
            expect(instructions.ethereum.funding_address).to.be.a('string');
            expect(instructions.ethereum.minimum_amount).to.be.a('number');
            expect(instructions.ethereum.faucet_url).to.be.a('string');
        });

        it('should support retry deployment after funding', async () => {
            await request(app)
                .post(`/api/projects/${testProjectId}/paymaster/retry-deployment`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ chains: ['ethereum'] })
                .expect(200);
        });
    });

    describe('7. Gas Optimization', () => {
        it('should show lower gas costs for arbitrum vs ethereum', async () => {
            const res = await request(app)
                .get('/api/chains')
                .expect(200);
            
            const ethereum = res.body.data.chains.find(c => c.id === 'ethereum');
            const arbitrum = res.body.data.chains.find(c => c.id === 'arbitrum');
            
            expect(arbitrum.gasPrice).to.be.below(ethereum.gasPrice);
            expect(arbitrum.gasLimit).to.equal(100000); // L2 optimization
            expect(ethereum.gasLimit).to.equal(21000); // L1 standard
        });
    });

    describe('8. Dashboard Integration', () => {
        it('should serve dashboard with chain management tab', async () => {
            const res = await request(app)
                .get('/dashboard.html')
                .expect(200);
            
            expect(res.text).to.include('⛓️ Chain Management');
            expect(res.text).to.include('showAddChainModal');
            expect(res.text).to.include('loadSupportedChains');
        });

        it('should serve chain management modal', async () => {
            const res = await request(app)
                .get('/dashboard.html')
                .expect(200);
            
            expect(res.text).to.include('addChainModal');
            expect(res.text).to.include('Add New Chain');
            expect(res.text).to.include('Chain Type');
        });
    });

    describe('9. End-to-End Flow Verification', () => {
        it('should complete full chain addition workflow', async () => {
            const newChain = {
                chainId: 'optimism_goerli',
                name: 'Optimism Goerli',
                type: 'EVM',
                rpcUrl: 'https://goerli.optimism.io',
                chainIdNumber: 420,
                currency: 'ETH'
            };

            // 1. Add new chain
            await request(app)
                .post('/api/chains')
                .set('Authorization', `Bearer ${authToken}`)
                .send(newChain)
                .expect(201);

            // 2. Verify chain appears in supported chains
            const chainsRes = await request(app)
                .get('/api/chains')
                .expect(200);
            
            const chainIds = chainsRes.body.data.chains.map(c => c.id);
            expect(chainIds).to.include('optimism_goerli');

            // 3. Create project with new chain
            const projectRes = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Optimism Test Project',
                    chains: ['optimism_goerli']
                })
                .expect(201);

            expect(projectRes.body.data.paymasters_created).to.have.length(1);
        });

        it('should handle errors gracefully', async () => {
            // Test invalid RPC URL
            const invalidChain = {
                chainId: 'broken_chain',
                name: 'Broken Chain',
                type: 'EVM',
                rpcUrl: 'invalid-url',
                chainIdNumber: 'not-a-number',
                currency: 'FAKE'
            };

            const res = await request(app)
                .post('/api/chains')
                .set('Authorization', `Bearer ${authToken}`)
                .send(invalidChain)
                .expect(400);
            
            expect(res.body.error).to.exist;
        });
    });

    after(async () => {
        // Cleanup test data
        if (testProjectId) {
            await request(app)
                .delete(`/api/projects/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`);
        }
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
            expect(addresses.ethereum).to.equal(addresses.arbitrum);
            
            // SVM should be different
            expect(addresses.solana).to.not.equal(addresses.ethereum);
            
            // All addresses should be valid
            expect(addresses.ethereum).to.match(/^0x[a-fA-F0-9]{40}$/);
            expect(addresses.solana).to.match(/^[A-Za-z0-9]{40,50}$/);
        });
    });

    describe('Chain Configuration Loading', () => {
        it('should load all chains from centralized config', () => {
            const chainConfig = require('../config/chains');
            const chains = chainConfig.getAllChains();
            
            expect(chains).to.be.an('array');
            expect(chains.length).to.be.at.least(3);
            
            const chainIds = chains.map(c => c.id);
            expect(chainIds).to.include.members(['ethereum', 'arbitrum', 'solana']);
        });
    });

    describe('Factory Contract Compatibility', () => {
        it('should use consistent EntryPoint addresses', () => {
            const chainConfig = require('../config/chains');
            const evmChains = chainConfig.getChainsByType('EVM');
            
            const entryPoints = evmChains.map(c => c.contracts.entryPoint);
            const uniqueEntryPoints = [...new Set(entryPoints)];
            
            // All EVM chains should use the same EntryPoint
            expect(uniqueEntryPoints).to.have.length(1);
            expect(uniqueEntryPoints[0]).to.equal('0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789');
        });
    });
}); 