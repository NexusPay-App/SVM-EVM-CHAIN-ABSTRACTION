require("@nomiclabs/hardhat-ethers");
require("@nomiclabs/hardhat-waffle");

// Load environment variables
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      timeout: 1800000
    },
    // Ethereum Sepolia Testnet
    sepolia: {
      url: "https://eth-sepolia.g.alchemy.com/v2/demo",
      accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 11155111,
      gas: 6000000,
      gasPrice: 20000000000, // 20 gwei
      timeout: 60000
    },
    // Arbitrum Sepolia Testnet
    arbitrumSepolia: {
      url: "https://sepolia-rollup.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 421614,
      gas: 6000000,
      gasPrice: 100000000, // 0.1 gwei
      timeout: 60000
    },
    // Base Sepolia Testnet
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 84532,
      gas: 6000000,
      gasPrice: 1000000000, // 1 gwei
      timeout: 60000
    },
    // Polygon Mumbai Testnet
    polygonMumbai: {
      url: "https://rpc.ankr.com/polygon_mumbai",
      accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY}`] : [],
      chainId: 80001,
      gas: 6000000,
      gasPrice: 20000000000, // 20 gwei
      timeout: 60000
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD"
  },
  etherscan: {
    apiKey: {
      sepolia: process.env.ETHERSCAN_API_KEY,
      arbitrumSepolia: process.env.ARBISCAN_API_KEY,
      baseSepolia: process.env.BASESCAN_API_KEY,
      polygonMumbai: process.env.POLYGONSCAN_API_KEY
    },
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io"
        }
      },
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://api-sepolia.basescan.org/api",
          browserURL: "https://sepolia.basescan.org"
        }
      }
    ]
  },
  mocha: {
    timeout: 100000
  }
}; 