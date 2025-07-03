const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting NexusDeFi Contract Deployment...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("📋 Deployment Details:");
  console.log("- Deployer address:", deployer.address);
  console.log("- Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  console.log("- Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("");

  try {
    // 1. Deploy EntryPoint
    console.log("1️⃣ Deploying EntryPoint...");
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();
    await entryPoint.deployed();
    console.log("✅ EntryPoint deployed to:", entryPoint.address);

    // 2. Deploy WalletFactory
    console.log("2️⃣ Deploying WalletFactory...");
    const WalletFactory = await ethers.getContractFactory("WalletFactory");
    const walletFactory = await WalletFactory.deploy(entryPoint.address);
    await walletFactory.deployed();
    console.log("✅ WalletFactory deployed to:", walletFactory.address);

    // 3. Deploy Paymaster (skip initialization for proxy pattern)
    console.log("3️⃣ Deploying Paymaster...");
    const Paymaster = await ethers.getContractFactory("Paymaster");
    const paymaster = await Paymaster.deploy();
    await paymaster.deployed();
    console.log("✅ Paymaster deployed to:", paymaster.address);
    console.log("ℹ️  Note: Paymaster uses proxy pattern - initialization handled separately");

    // 4. Create test wallet
    console.log("4️⃣ Creating test wallet...");
    const salt = 12345;
    const predictedAddress = await walletFactory.getWalletAddress(deployer.address, salt);
    const createTx = await walletFactory.createWallet(deployer.address, salt);
    await createTx.wait();
    console.log("✅ Test wallet created at:", predictedAddress);

    // 5. Fund paymaster
    console.log("5️⃣ Funding Paymaster...");
    const fundAmount = ethers.utils.parseEther("0.1");
    const fundTx = await paymaster.deposit({ value: fundAmount });
    await fundTx.wait();
    console.log("✅ Paymaster funded with 0.1 ETH");

    console.log("\n🎉 DEPLOYMENT COMPLETED! 🎉");
    console.log("📋 Contract Addresses:");
    console.log("- EntryPoint:", entryPoint.address);
    console.log("- WalletFactory:", walletFactory.address);
    console.log("- Paymaster:", paymaster.address);
    console.log("- Test Wallet:", predictedAddress);

    // Save deployment info
    const fs = require('fs');
    const deploymentInfo = {
      network: network.name,
      chainId: network.chainId,
      contracts: {
        entryPoint: entryPoint.address,
        walletFactory: walletFactory.address,
        paymaster: paymaster.address,
        testWallet: predictedAddress
      }
    };

    if (!fs.existsSync('deployments')) {
      fs.mkdirSync('deployments');
    }
    fs.writeFileSync(`deployments/${network.name}-${network.chainId}.json`, JSON.stringify(deploymentInfo, null, 2));

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
