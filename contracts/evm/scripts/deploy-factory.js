const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
    console.log("🏭 Deploying Ultra-Low-Cost Paymaster Factory...");
    
    const [deployer] = await ethers.getSigners();
    console.log("Deploying with account:", deployer.address);
    
    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.utils.formatEther(balance), "ETH");

    // Deploy master Paymaster implementation
    console.log("\n📋 Deploying Master Paymaster Implementation...");
    const Paymaster = await ethers.getContractFactory("Paymaster");
    const masterPaymaster = await Paymaster.deploy();
    await masterPaymaster.deployed();
    
    const masterAddress = masterPaymaster.address;
    console.log("✅ Master Paymaster deployed to:", masterAddress);

    // Deploy PaymasterFactory
    console.log("\n🏭 Deploying Paymaster Factory...");
    const PaymasterFactory = await ethers.getContractFactory("PaymasterFactory");
    const factory = await PaymasterFactory.deploy(masterAddress);
    await factory.deployed();
    
    const factoryAddress = factory.address;
    console.log("✅ Paymaster Factory deployed to:", factoryAddress);

    // Get deployment costs
    const deploymentReceipt = await factory.deployTransaction.wait();
    const gasUsed = deploymentReceipt.gasUsed;
    const gasPrice = deploymentReceipt.gasPrice || deploymentReceipt.effectiveGasPrice || ethers.BigNumber.from('20000000000'); // 20 gwei fallback
    const deploymentCost = gasUsed.mul(gasPrice);
    
    console.log("\n💰 Deployment Costs:");
    console.log("Gas used:", gasUsed.toString());
    console.log("Gas price:", ethers.utils.formatUnits(gasPrice, "gwei"), "gwei");
    console.log("Total cost:", ethers.utils.formatEther(deploymentCost), "ETH");

    // Estimate minimal proxy creation cost (theoretical)
    console.log("\n🧪 Proxy Cost Estimation...");
    const estimatedProxyGas = ethers.BigNumber.from('30000'); // Typical minimal proxy cost
    const proxyCost = estimatedProxyGas.mul(gasPrice);
    console.log("Estimated gas for proxy creation:", estimatedProxyGas.toString());
    console.log("Estimated proxy cost:", ethers.utils.formatEther(proxyCost), "ETH");
    
    // Calculate USD cost (assuming ETH price)
    const ethPriceUSD = 2500; // Update this with current ETH price
    const proxyCostUSD = parseFloat(ethers.utils.formatEther(proxyCost)) * ethPriceUSD;
    console.log("Estimated proxy cost: $", proxyCostUSD.toFixed(2));

    // Save deployment info
    const chainId = await ethers.provider.getNetwork().then(n => n.chainId);
    const deploymentInfo = {
        chainId: chainId.toString(),
        network: await ethers.provider.getNetwork().then(n => n.name),
        masterPaymaster: masterAddress,
        factory: factoryAddress,
        deployer: deployer.address,
        deploymentBlock: await ethers.provider.getBlockNumber(),
        deploymentCost: ethers.utils.formatEther(deploymentCost),
        estimatedProxyGas: estimatedProxyGas.toString(),
        estimatedProxyCostETH: ethers.utils.formatEther(proxyCost),
        estimatedProxyCostUSD: proxyCostUSD.toFixed(2),
        timestamp: new Date().toISOString()
    };

    // Save to deployments directory
    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    const deploymentFile = path.join(deploymentsDir, `factory-${chainId}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    console.log("\n📁 Deployment info saved to:", deploymentFile);
    console.log("\n🎉 Factory deployment complete!");
    console.log("🚀 Ready for ultra-low-cost paymaster creation!");
    
    return {
        masterPaymaster: masterAddress,
        factory: factoryAddress,
        deploymentInfo
    };
}

// Run deployment
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("❌ Deployment failed:", error);
            process.exit(1);
        });
}

module.exports = main; 