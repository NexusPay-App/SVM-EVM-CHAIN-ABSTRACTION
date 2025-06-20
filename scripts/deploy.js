const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Starting NexusDeFi Contract Deployment...\n");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("📋 Deployment Details:");
  console.log("- Deployer address:", deployer.address);
  console.log("- Account balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
  console.log("- Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("- Gas price:", ethers.utils.formatUnits(await ethers.provider.getGasPrice(), "gwei"), "gwei");
  console.log("");

  try {
    // 1. Deploy EntryPoint
    console.log("1️⃣ Deploying EntryPoint...");
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();
    await entryPoint.deployed();
    console.log("✅ EntryPoint deployed to:", entryPoint.address);
    console.log("   - Transaction hash:", entryPoint.deployTransaction.hash);
    console.log("   - Gas used:", (await entryPoint.deployTransaction.wait()).gasUsed.toString());
    console.log("");

    // 2. Deploy WalletFactory
    console.log("2️⃣ Deploying WalletFactory...");
    const WalletFactory = await ethers.getContractFactory("WalletFactory");
    const walletFactory = await WalletFactory.deploy(entryPoint.address);
    await walletFactory.deployed();
    console.log("✅ WalletFactory deployed to:", walletFactory.address);
    console.log("   - Transaction hash:", walletFactory.deployTransaction.hash);
    console.log("   - Gas used:", (await walletFactory.deployTransaction.wait()).gasUsed.toString());
    console.log("");

    // 3. Deploy Paymaster
    console.log("3️⃣ Deploying Paymaster...");
    const Paymaster = await ethers.getContractFactory("Paymaster");
    const paymaster = await Paymaster.deploy(entryPoint.address);
    await paymaster.deployed();
    console.log("✅ Paymaster deployed to:", paymaster.address);
    console.log("   - Transaction hash:", paymaster.deployTransaction.hash);
    console.log("   - Gas used:", (await paymaster.deployTransaction.wait()).gasUsed.toString());
    console.log("");

    // 4. Verify EntryPoint configuration
    console.log("4️⃣ Verifying EntryPoint configuration...");
    const chainId = await entryPoint.chainId();
    const stakeMinimum = await entryPoint.STAKE_MINIMUM();
    const unstakeDelay = await entryPoint.UNSTAKE_DELAY_SEC();
    console.log("✅ EntryPoint configuration verified:");
    console.log("   - Chain ID:", chainId.toString());
    console.log("   - Stake minimum:", ethers.utils.formatEther(stakeMinimum), "ETH");
    console.log("   - Unstake delay:", unstakeDelay.toString(), "seconds");
    console.log("");

    // 5. Verify WalletFactory configuration
    console.log("5️⃣ Verifying WalletFactory configuration...");
    const factoryEntryPoint = await walletFactory.entryPoint();
    console.log("✅ WalletFactory configuration verified:");
    console.log("   - EntryPoint address:", factoryEntryPoint);
    console.log("   - Matches deployed EntryPoint:", factoryEntryPoint === entryPoint.address ? "✅" : "❌");
    console.log("");

    // 6. Verify Paymaster configuration
    console.log("6️⃣ Verifying Paymaster configuration...");
    const paymasterEntryPoint = await paymaster.entryPoint();
    const paymasterOwner = await paymaster.owner();
    console.log("✅ Paymaster configuration verified:");
    console.log("   - EntryPoint address:", paymasterEntryPoint);
    console.log("   - Matches deployed EntryPoint:", paymasterEntryPoint === entryPoint.address ? "✅" : "❌");
    console.log("   - Owner:", paymasterOwner);
    console.log("   - Owner is deployer:", paymasterOwner === deployer.address ? "✅" : "❌");
    console.log("");

    // 7. Create a test wallet
    console.log("7️⃣ Creating test wallet...");
    const salt = 12345;
    const predictedAddress = await walletFactory.getWalletAddress(deployer.address, salt);
    console.log("   - Predicted wallet address:", predictedAddress);
    
    const createTx = await walletFactory.createWallet(deployer.address, salt);
    await createTx.wait();
    console.log("✅ Test wallet created successfully");
    console.log("   - Transaction hash:", createTx.hash);
    
    // Verify wallet deployment
    const isDeployed = await walletFactory.isWalletDeployed(deployer.address, salt);
    console.log("   - Wallet deployed:", isDeployed ? "✅" : "❌");
    
    // Get wallet contract instance
    const testWallet = await ethers.getContractAt("Wallet", predictedAddress);
    const walletOwner = await testWallet.owner();
    const walletEntryPoint = await testWallet.entryPoint();
    console.log("   - Wallet owner:", walletOwner);
    console.log("   - Wallet EntryPoint:", walletEntryPoint);
    console.log("");

    // 8. Fund paymaster for testing
    console.log("8️⃣ Funding Paymaster for testing...");
    const fundAmount = ethers.utils.parseEther("0.1");
    const fundTx = await paymaster.deposit({ value: fundAmount });
    await fundTx.wait();
    console.log("✅ Paymaster funded with", ethers.utils.formatEther(fundAmount), "ETH");
    console.log("   - Transaction hash:", fundTx.hash);
    
    const paymasterBalance = await ethers.provider.getBalance(paymaster.address);
    console.log("   - Paymaster balance:", ethers.utils.formatEther(paymasterBalance), "ETH");
    console.log("");

    // 9. Summary
    console.log("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY! 🎉\n");
    
    console.log("📋 Contract Addresses:");
    console.log("┌─────────────────┬──────────────────────────────────────────────┐");
    console.log("│ Contract        │ Address                                      │");
    console.log("├─────────────────┼──────────────────────────────────────────────┤");
    console.log(`│ EntryPoint      │ ${entryPoint.address}                 │`);
    console.log(`│ WalletFactory   │ ${walletFactory.address}                 │`);
    console.log(`│ Paymaster      │ ${paymaster.address}                 │`);
    console.log(`│ Test Wallet    │ ${predictedAddress}                 │`);
    console.log("└─────────────────┴──────────────────────────────────────────────┘");
    console.log("");

    console.log("🔗 Network Information:");
    console.log(`- Network: ${network.name} (Chain ID: ${network.chainId})`);
    console.log(`- Deployer: ${deployer.address}`);
    console.log(`- Final balance: ${ethers.utils.formatEther(await deployer.getBalance())} ETH`);
    console.log("");

    console.log("📝 Next Steps:");
    console.log("1. Add contract addresses to your frontend/SDK configuration");
    console.log("2. Verify contracts on block explorer (if on public testnet)");
    console.log("3. Test user operations end-to-end");
    console.log("4. Configure paymaster policies as needed");
    console.log("");

    // Save deployment info to file
    const deploymentInfo = {
      network: network.name,
      chainId: network.chainId,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      contracts: {
        entryPoint: entryPoint.address,
        walletFactory: walletFactory.address,
        paymaster: paymaster.address,
        testWallet: predictedAddress
      },
      transactionHashes: {
        entryPoint: entryPoint.deployTransaction.hash,
        walletFactory: walletFactory.deployTransaction.hash,
        paymaster: paymaster.deployTransaction.hash,
        testWallet: createTx.hash,
        paymasterFunding: fundTx.hash
      }
    };

    // Write to file
    const fs = require('fs');
    const deploymentFile = `deployments/${network.name}-${network.chainId}.json`;
    if (!fs.existsSync('deployments')) {
      fs.mkdirSync('deployments');
    }
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`💾 Deployment info saved to: ${deploymentFile}`);

  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
}

// Handle deployment
main()
  .then(() => {
    console.log("\n🎯 Deployment script completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Deployment script failed:", error);
    process.exit(1);
  }); 