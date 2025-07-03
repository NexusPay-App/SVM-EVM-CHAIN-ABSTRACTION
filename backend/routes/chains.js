const express = require('express');
const { 
  getAllChains, 
  getChainConfig, 
  getPublicChainInfo,
  getSupportedChainIds,
  isChainSupported,
  addChain 
} = require('../config/chains');
const AuthMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * @route GET /chains
 * @desc Get all supported chains (public endpoint)
 * @access Public
 */
router.get('/', (req, res) => {
  try {
    const chainIds = getSupportedChainIds();
    const chains = chainIds.map(chainId => getPublicChainInfo(chainId));

    res.json({
      success: true,
      data: {
        chains,
        total: chains.length,
        supportedChainIds: chainIds
      }
    });

  } catch (error) {
    console.error('Chains fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHAINS_FETCH_FAILED',
        message: 'Failed to fetch supported chains'
      }
    });
  }
});

/**
 * @route GET /chains/:chainId
 * @desc Get specific chain information
 * @access Public
 */
router.get('/:chainId', (req, res) => {
  try {
    const { chainId } = req.params;
    
    if (!isChainSupported(chainId)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAIN_NOT_SUPPORTED',
          message: `Chain '${chainId}' is not supported`,
          supportedChains: getSupportedChainIds()
        }
      });
    }

    const chainInfo = getPublicChainInfo(chainId);

    res.json({
      success: true,
      data: {
        chain: chainInfo
      }
    });

  } catch (error) {
    console.error('Chain fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHAIN_FETCH_FAILED',
        message: 'Failed to fetch chain information'
      }
    });
  }
});

/**
 * @route POST /chains (Future extensibility endpoint)
 * @desc Add a new chain configuration
 * @access Private (Admin only)
 * @note This endpoint allows easy addition of new chains without code changes
 */
router.post('/', AuthMiddleware.authenticateToken, async (req, res) => {
  try {
    // TODO: Add admin role check here
    // if (req.user.role !== 'admin') {
    //   return res.status(403).json({
    //     success: false,
    //     error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
    //   });
    // }

    const { chainId, name, type, rpcUrl, explorerUrl, chainIdNumber, currency, contracts } = req.body;

    // Validation
    if (!chainId || !name || !type || !rpcUrl || !chainIdNumber || !currency) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: chainId, name, type, rpcUrl, chainIdNumber, currency'
        }
      });
    }

    if (isChainSupported(chainId)) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'CHAIN_ALREADY_EXISTS',
          message: `Chain '${chainId}' is already supported`
        }
      });
    }

    // Create chain configuration
    const chainConfig = {
      name,
      displayName: name,
      type: type.toUpperCase(), // EVM or SVM
      chainId: chainIdNumber,
      currency: currency.toUpperCase(),
      decimals: 18, // Default for most chains
      isTestnet: true, // Default to testnet for safety
      rpcUrl,
      explorerUrl,
      explorerApiUrl: explorerUrl ? `${explorerUrl}/api` : null,
      contracts: contracts || {
        entryPoint: null,
        walletFactory: null,
        paymaster: null
      },
      gasConfiguration: type.toUpperCase() === 'EVM' ? {
        gasPrice: '20000000000', // 20 gwei default
        gasLimit: '500000',
        priorityFee: '2000000000' // 2 gwei
      } : {
        computeUnitPrice: '1000',
        computeUnitLimit: '200000'
      },
      features: {
        accountAbstraction: true,
        paymasterSupport: true,
        crossChainBridge: false, // Default to false for new chains
        nativeTokens: true
      }
    };

    // Add the chain
    addChain(chainId, chainConfig);

    res.status(201).json({
      success: true,
      message: `Chain '${chainId}' added successfully`,
      data: {
        chain: getPublicChainInfo(chainId),
        instructions: {
          nextSteps: [
            'Deploy EntryPoint, WalletFactory, and Paymaster contracts',
            'Update the contracts field with deployed addresses',
            'Test wallet creation and deployment',
            'Update project models to include the new chain'
          ]
        }
      }
    });

  } catch (error) {
    console.error('Chain addition error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHAIN_ADDITION_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * @route GET /chains/:chainId/contracts
 * @desc Get contract addresses for a specific chain
 * @access Public
 */
router.get('/:chainId/contracts', (req, res) => {
  try {
    const { chainId } = req.params;
    
    if (!isChainSupported(chainId)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CHAIN_NOT_SUPPORTED',
          message: `Chain '${chainId}' is not supported`
        }
      });
    }

    const chainConfig = getChainConfig(chainId);
    const contracts = chainConfig.contracts;

    // Check if contracts are deployed
    const isFullyDeployed = contracts.entryPoint && contracts.walletFactory && contracts.paymaster;

    res.json({
      success: true,
      data: {
        chainId,
        chainName: chainConfig.displayName,
        contracts,
        deployment_status: isFullyDeployed ? 'deployed' : 'incomplete',
        explorer_links: {
          entryPoint: contracts.entryPoint ? `${chainConfig.explorerUrl}/address/${contracts.entryPoint}` : null,
          walletFactory: contracts.walletFactory ? `${chainConfig.explorerUrl}/address/${contracts.walletFactory}` : null,
          paymaster: contracts.paymaster ? `${chainConfig.explorerUrl}/address/${contracts.paymaster}` : null
        }
      }
    });

  } catch (error) {
    console.error('Chain contracts fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONTRACTS_FETCH_FAILED',
        message: 'Failed to fetch chain contracts'
      }
    });
  }
});

module.exports = router; 