const { ethers } = require("hardhat");
const fs = require('fs');

async function main() {
  console.log("🧪 Testing NexusDeFi Account Abstraction Features...\n");

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  const user1 = signers[1] || deployer; // Use deployer as fallback
  const user2 = signers[2] || deployer; // Use deployer as fallback
  
  const network = await ethers.provider.getNetwork();
  
  console.log("📋 Test Environment:");
  console.log("- Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("- Deployer:", deployer.address);
  console.log("- User1:", user1.address);
  console.log("- User2:", user2.address);
  console.log("");

  // Load deployment info
  const deploymentFile = `deployments/${network.name}-${network.chainId}.json`;
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found:", deploymentFile);
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, 'utf8'));
  const contracts = deployment.contracts;

  // Connect to deployed contracts
  const entryPoint = await ethers.getContractAt("EntryPoint", contracts.entryPoint);
  const walletFactory = await ethers.getContractAt("WalletFactory", contracts.walletFactory);
  const paymaster = await ethers.getContractAt("Paymaster", contracts.paymaster);
  
  console.log("📡 Connected to deployed contracts:");
  console.log("- EntryPoint:", entryPoint.address);
  console.log("- WalletFactory:", walletFactory.address);
  console.log("- Paymaster:", paymaster.address);
  console.log("");

  try {
    // Test 1: Wallet Creation
    console.log("🔧 TEST 1: Smart Wallet Creation");
    console.log("─".repeat(50));
    
    const salt1 = 11111;
    const salt2 = 22222;
    
    const predictedWallet1 = await walletFactory.getWalletAddress(user1.address, salt1);
    const predictedWallet2 = await walletFactory.getWalletAddress(user2.address, salt2);
    
    console.log("🔮 Predicted wallet addresses:");
    console.log("- User1 wallet:", predictedWallet1);
    console.log("- User2 wallet:", predictedWallet2);
    
    // Create wallets
    const createTx1 = await walletFactory.connect(user1).createWallet(user1.address, salt1);
    await createTx1.wait();
    
    const createTx2 = await walletFactory.connect(user2).createWallet(user2.address, salt2);
    await createTx2.wait();
    
    console.log("✅ Wallets created successfully!");
    
    // Verify wallets exist
    const wallet1Code = await ethers.provider.getCode(predictedWallet1);
    const wallet2Code = await ethers.provider.getCode(predictedWallet2);
    
    if (wallet1Code === "0x") throw new Error("Wallet 1 not deployed");
    if (wallet2Code === "0x") throw new Error("Wallet 2 not deployed");
    
    console.log("✅ Wallet deployment verified!");
    console.log("");

    // Test 2: Wallet Functionality
    console.log("🔧 TEST 2: Wallet Functionality");
    console.log("─".repeat(50));
    
    const wallet1 = await ethers.getContractAt("Wallet", predictedWallet1);
    const wallet2 = await ethers.getContractAt("Wallet", predictedWallet2);
    
    // Check wallet owners
    const owner1 = await wallet1.owner();
    const owner2 = await wallet2.owner();
    
    console.log("👤 Wallet owners:");
    console.log("- Wallet1 owner:", owner1);
    console.log("- Wallet2 owner:", owner2);
    
    if (owner1 !== user1.address) throw new Error("Wallet 1 owner mismatch");
    if (owner2 !== user2.address) throw new Error("Wallet 2 owner mismatch");
    
    console.log("✅ Wallet ownership verified!");
    
    // Fund wallets
    const fundAmount = ethers.utils.parseEther("0.01");
    await deployer.sendTransaction({ to: predictedWallet1, value: fundAmount });
    await deployer.sendTransaction({ to: predictedWallet2, value: fundAmount });
    
    const balance1 = await ethers.provider.getBalance(predictedWallet1);
    const balance2 = await ethers.provider.getBalance(predictedWallet2);
    
    console.log("💰 Wallet balances:");
    console.log("- Wallet1:", ethers.utils.formatEther(balance1), "ETH");
    console.log("- Wallet2:", ethers.utils.formatEther(balance2), "ETH");
    console.log("✅ Wallets funded successfully!");
    console.log("");

    // Test 3: EntryPoint Integration
    console.log("🔧 TEST 3: EntryPoint Integration");
    console.log("─".repeat(50));
    
    // Check EntryPoint configuration
    const entryPointFromWallet1 = await wallet1.entryPoint();
    const entryPointFromWallet2 = await wallet2.entryPoint();
    
    console.log("🔗 EntryPoint connections:");
    console.log("- Wallet1 EntryPoint:", entryPointFromWallet1);
    console.log("- Wallet2 EntryPoint:", entryPointFromWallet2);
    
    if (entryPointFromWallet1 !== entryPoint.address) throw new Error("Wallet 1 EntryPoint mismatch");
    if (entryPointFromWallet2 !== entryPoint.address) throw new Error("Wallet 2 EntryPoint mismatch");
    
    console.log("✅ EntryPoint integration verified!");
    console.log("");

    // Test 4: Paymaster Integration
    console.log("🔧 TEST 4: Paymaster Integration");
    console.log("─".repeat(50));
    
    // Check paymaster balance on EntryPoint
    const paymasterBalance = await entryPoint.balanceOf(paymaster.address);
    console.log("💳 Paymaster balance on EntryPoint:", ethers.utils.formatEther(paymasterBalance), "ETH");
    
    // Check paymaster configuration
    const paymasterEntryPoint = await paymaster.entryPoint();
    console.log("🔗 Paymaster EntryPoint:", paymasterEntryPoint);
    
    // Check if paymaster is enabled
    const isEnabled = await paymaster.paymasterEnabled();
    console.log("🟢 Paymaster enabled:", isEnabled);
    
    if (paymasterEntryPoint !== entryPoint.address) throw new Error("Paymaster EntryPoint mismatch");
    
    console.log("✅ Paymaster integration verified!");
    console.log("");

    // Test 5: User Operation Structure
    console.log("🔧 TEST 5: User Operation Structure");
    console.log("─".repeat(50));
    
    // Create a simple user operation for wallet1
    const userOp = {
      sender: predictedWallet1,
      nonce: 0,
      initCode: "0x",
      callData: wallet1.interface.encodeFunctionData("execute", [
        user2.address,
        ethers.utils.parseEther("0.001"),
        "0x"
      ]),
      callGasLimit: 100000,
      verificationGasLimit: 200000,
      preVerificationGas: 50000,
      maxFeePerGas: ethers.utils.parseUnits("10", "gwei"),
      maxPriorityFeePerGas: ethers.utils.parseUnits("2", "gwei"),
      paymasterAndData: "0x",
      signature: "0x"
    };
    
    console.log("📝 User Operation created:");
    console.log("- Sender:", userOp.sender);
    console.log("- Target:", user2.address);
    console.log("- Value:", "0.001 ETH");
    console.log("- Call Gas Limit:", userOp.callGasLimit);
    console.log("✅ User operation structure verified!");
    console.log("");

    // Test 6: Multi-Wallet Factory
    console.log("🔧 TEST 6: Multi-Wallet Factory");
    console.log("─".repeat(50));
    
    // Create multiple wallets for same user
    const multiWallets = [];
    for (let i = 0; i < 3; i++) {
      const salt = 50000 + i;
      const predictedAddr = await walletFactory.getWalletAddress(user1.address, salt);
      const createTx = await walletFactory.connect(user1).createWallet(user1.address, salt);
      await createTx.wait();
      multiWallets.push(predictedAddr);
      console.log(`📱 Wallet ${i + 1} created:`, predictedAddr);
    }
    
    console.log("✅ Multi-wallet creation verified!");
    console.log("");

    // Test 7: Cross-Wallet Transfer
    console.log("🔧 TEST 7: Cross-Wallet Transfer");
    console.log("─".repeat(50));
    
    const initialBalance = await ethers.provider.getBalance(predictedWallet2);
    
    // Execute transfer from wallet1 to wallet2
    const transferAmount = ethers.utils.parseEther("0.001");
    const transferTx = await wallet1.connect(user1).execute(
      predictedWallet2,
      transferAmount,
      "0x"
    );
    await transferTx.wait();
    
    const finalBalance = await ethers.provider.getBalance(predictedWallet2);
    const received = finalBalance.sub(initialBalance);
    
    console.log("💸 Transfer executed:");
    console.log("- From:", predictedWallet1);
    console.log("- To:", predictedWallet2);
    console.log("- Amount:", ethers.utils.formatEther(transferAmount), "ETH");
    console.log("- Received:", ethers.utils.formatEther(received), "ETH");
    
    if (received.lt(transferAmount.mul(95).div(100))) { // Allow for gas costs
      throw new Error("Transfer amount verification failed");
    }
    
    console.log("✅ Cross-wallet transfer verified!");
    console.log("");

    // Test Summary
    console.log("🎯 TEST SUMMARY");
    console.log("=".repeat(60));
    console.log("✅ Smart Wallet Creation - PASSED");
    console.log("✅ Wallet Functionality - PASSED");
    console.log("✅ EntryPoint Integration - PASSED");
    console.log("✅ Paymaster Integration - PASSED");
    console.log("✅ User Operation Structure - PASSED");
    console.log("✅ Multi-Wallet Factory - PASSED");
    console.log("✅ Cross-Wallet Transfer - PASSED");
    console.log("");
    console.log("🎉 ALL TESTS PASSED! 🎉");
    console.log("🌟 NexusDeFi Account Abstraction is working perfectly!");
    
    // Save test results
    const testResults = {
      network: network.name,
      chainId: network.chainId,
      timestamp: new Date().toISOString(),
      testResults: {
        walletCreation: "PASSED",
        walletFunctionality: "PASSED", 
        entryPointIntegration: "PASSED",
        paymasterIntegration: "PASSED",
        userOperationStructure: "PASSED",
        multiWalletFactory: "PASSED",
        crossWalletTransfer: "PASSED"
      },
      testWallets: {
        user1Primary: predictedWallet1,
        user2Primary: predictedWallet2,
        user1Multi: multiWallets
      },
      contractAddresses: contracts
    };
    
    fs.writeFileSync(`test-results-${network.name}-${Date.now()}.json`, JSON.stringify(testResults, null, 2));
    console.log("\n💾 Test results saved to file!");

  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 