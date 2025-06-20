const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NexusDeFi EVM Contracts", function () {
  let entryPoint;
  let walletFactory;
  let paymaster;
  let owner;
  let user;
  let beneficiary;
  let target;

  beforeEach(async function () {
    [owner, user, beneficiary, target] = await ethers.getSigners();

    // Deploy EntryPoint
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    entryPoint = await EntryPoint.deploy();
    await entryPoint.deployed();

    // Deploy WalletFactory
    const WalletFactory = await ethers.getContractFactory("WalletFactory");
    walletFactory = await WalletFactory.deploy(entryPoint.address);
    await walletFactory.deployed();

    // Deploy Paymaster
    const Paymaster = await ethers.getContractFactory("Paymaster");
    paymaster = await Paymaster.deploy(entryPoint.address);
    await paymaster.deployed();
  });

  describe("EntryPoint Deployment", function () {
    it("Should deploy EntryPoint successfully", async function () {
      expect(entryPoint.address).to.not.equal(ethers.constants.AddressZero);
      expect(await entryPoint.chainId()).to.equal(31337);
    });

    it("Should set correct constants", async function () {
      const stakeMinimum = await entryPoint.STAKE_MINIMUM();
      const unstakeDelay = await entryPoint.UNSTAKE_DELAY_SEC();
      
      expect(stakeMinimum.toString()).to.equal(ethers.utils.parseEther("1").toString());
      expect(unstakeDelay.toString()).to.equal("86400");
    });
  });

  describe("Deposit Management", function () {
    it("Should accept ETH deposits via depositTo", async function () {
      const depositAmount = ethers.utils.parseEther("1");
      
      await entryPoint.depositTo(user.address, { value: depositAmount });
      
      const balance = await entryPoint.balanceOf(user.address);
      expect(balance.toString()).to.equal(depositAmount.toString());
    });

    it("Should accept ETH deposits via receive function", async function () {
      const depositAmount = ethers.utils.parseEther("0.5");
      
      await owner.sendTransaction({
        to: entryPoint.address,
        value: depositAmount
      });
      
      const balance = await entryPoint.balanceOf(owner.address);
      expect(balance.toString()).to.equal(depositAmount.toString());
    });

    it("Should allow withdrawals", async function () {
      const depositAmount = ethers.utils.parseEther("1");
      const withdrawAmount = ethers.utils.parseEther("0.3");
      
      await entryPoint.depositTo(owner.address, { value: depositAmount });
      
      const initialBalance = await ethers.provider.getBalance(beneficiary.address);
      await entryPoint.withdrawTo(beneficiary.address, withdrawAmount);
      const finalBalance = await ethers.provider.getBalance(beneficiary.address);
      
      expect(finalBalance.sub(initialBalance).toString()).to.equal(withdrawAmount.toString());
      
      const remainingBalance = await entryPoint.balanceOf(owner.address);
      expect(remainingBalance.toString()).to.equal(depositAmount.sub(withdrawAmount).toString());
    });
  });

  describe("Stake Management", function () {
    it("Should allow adding stake", async function () {
      const stakeAmount = ethers.utils.parseEther("2");
      const unstakeDelay = 86400;
      
      await entryPoint.addStake(unstakeDelay, { value: stakeAmount });
      
      const stakeInfo = await entryPoint.stakes(owner.address);
      expect(stakeInfo.stake.toString()).to.equal(stakeAmount.toString());
      expect(stakeInfo.unstakeDelaySec.toString()).to.equal(unstakeDelay.toString());
    });

    it("Should allow unlocking stake", async function () {
      const stakeAmount = ethers.utils.parseEther("1");
      const unstakeDelay = 86400;
      
      await entryPoint.addStake(unstakeDelay, { value: stakeAmount });
      await entryPoint.unlockStake();
      
      const stakeInfo = await entryPoint.stakes(owner.address);
      expect(stakeInfo.withdrawTime.toNumber()).to.be.greaterThan(0);
    });
  });

  describe("WalletFactory", function () {
    it("Should deploy WalletFactory successfully", async function () {
      expect(walletFactory.address).to.not.equal(ethers.constants.AddressZero);
      expect(await walletFactory.entryPoint()).to.equal(entryPoint.address);
    });

    it("Should create wallet successfully", async function () {
      const salt = 123;
      
      const tx = await walletFactory.createWallet(user.address, salt);
      await tx.wait();
      
      const walletAddress = await walletFactory.getWalletAddress(user.address, salt);
      expect(walletAddress).to.not.equal(ethers.constants.AddressZero);
      
      // Check that a contract exists at the address
      const code = await ethers.provider.getCode(walletAddress);
      expect(code).to.not.equal("0x");
    });

    it("Should predict wallet address correctly", async function () {
      const salt = 456;
      
      const predictedAddress = await walletFactory.getWalletAddress(user.address, salt);
      expect(predictedAddress).to.not.equal(ethers.constants.AddressZero);
      
      await walletFactory.createWallet(user.address, salt);
      
      const code = await ethers.provider.getCode(predictedAddress);
      expect(code).to.not.equal("0x");
    });

    it("Should check wallet deployment status", async function () {
      const salt = 999;
      
      expect(await walletFactory.isWalletDeployed(user.address, salt)).to.be.false;
      
      await walletFactory.createWallet(user.address, salt);
      
      expect(await walletFactory.isWalletDeployed(user.address, salt)).to.be.true;
    });
  });

  describe("BaseWallet & Wallet", function () {
    let testWallet;

    beforeEach(async function () {
      // Create a wallet for testing
      await walletFactory.createWallet(owner.address, 0);
      const walletAddress = await walletFactory.getWalletAddress(owner.address, 0);
      testWallet = await ethers.getContractAt("Wallet", walletAddress);
    });

    it("Should have correct owner and entryPoint", async function () {
      expect(await testWallet.owner()).to.equal(owner.address);
      expect(await testWallet.entryPoint()).to.equal(entryPoint.address);
    });

    it("Should start with nonce 0", async function () {
      const nonce = await testWallet.getNonce();
      expect(nonce.toString()).to.equal("0");
    });

    it("Should accept ETH deposits", async function () {
      const depositAmount = ethers.utils.parseEther("1");
      
      await testWallet.deposit({ value: depositAmount });
      
      const balance = await testWallet.getBalance();
      expect(balance.toString()).to.equal(depositAmount.toString());
    });

    it("Should allow owner to execute transactions", async function () {
      const amount = ethers.utils.parseEther("0.5");
      
      // Fund the wallet
      await owner.sendTransaction({
        to: testWallet.address,
        value: amount
      });
      
      const initialBalance = await ethers.provider.getBalance(target.address);
      
      // Execute transaction
      await testWallet.connect(owner).execute(target.address, amount, "0x");
      
      const finalBalance = await ethers.provider.getBalance(target.address);
      expect(finalBalance.sub(initialBalance).toString()).to.equal(amount.toString());
    });

    it("Should allow owner to execute batch transactions", async function () {
      const amount = ethers.utils.parseEther("1");
      
      // Fund the wallet
      await owner.sendTransaction({
        to: testWallet.address,
        value: amount
      });
      
      const targets = [target.address, user.address];
      const values = [ethers.utils.parseEther("0.3"), ethers.utils.parseEther("0.2")];
      const data = ["0x", "0x"];
      
      const tx = await testWallet.connect(owner).executeBatch(targets, values, data);
      const receipt = await tx.wait();
      
      expect(receipt.status).to.equal(1); // Transaction successful
    });

    it("Should allow owner to withdraw funds", async function () {
      const amount = ethers.utils.parseEther("1");
      
      // Fund the wallet
      await owner.sendTransaction({
        to: testWallet.address,
        value: amount
      });
      
      const initialBalance = await ethers.provider.getBalance(beneficiary.address);
      
      await testWallet.connect(owner).withdraw(beneficiary.address, amount);
      
      const finalBalance = await ethers.provider.getBalance(beneficiary.address);
      expect(finalBalance.sub(initialBalance).toString()).to.equal(amount.toString());
    });
  });

  describe("Paymaster", function () {
    beforeEach(async function () {
      // Fund paymaster for operations
      await paymaster.deposit({ value: ethers.utils.parseEther("10") });
      
      // Add stake for paymaster operations
      await entryPoint.connect(owner).addStake(86400, { value: ethers.utils.parseEther("2") });
    });

    it("Should deploy Paymaster successfully", async function () {
      expect(paymaster.address).to.not.equal(ethers.constants.AddressZero);
      expect(await paymaster.entryPoint()).to.equal(entryPoint.address);
    });

    it("Should allow owner to set whitelist", async function () {
      await paymaster.setWhitelist(user.address, true);
      
      const userInfo = await paymaster.getUserInfo(user.address);
      expect(userInfo.isWhitelisted).to.be.true;
    });

    it("Should allow owner to set user spend limits", async function () {
      const limit = ethers.utils.parseEther("5");
      
      await paymaster.setUserSpendLimit(user.address, limit);
      
      const userInfo = await paymaster.getUserInfo(user.address);
      expect(userInfo.limit.toString()).to.equal(limit.toString());
    });

    it("Should allow owner to update config", async function () {
      const newGlobalLimit = ethers.utils.parseEther("20");
      
      await paymaster.updateConfig(newGlobalLimit, false);
      
      const stats = await paymaster.getPaymasterStats();
      expect(stats.totalLimit.toString()).to.equal(newGlobalLimit.toString());
      expect(stats.enabled).to.be.false;
    });

    it("Should accept ETH deposits", async function () {
      const depositAmount = ethers.utils.parseEther("2");
      const initialBalance = await ethers.provider.getBalance(paymaster.address);
      
      await paymaster.deposit({ value: depositAmount });
      
      const finalBalance = await ethers.provider.getBalance(paymaster.address);
      expect(finalBalance.sub(initialBalance).toString()).to.equal(depositAmount.toString());
    });

    it("Should reset spending amounts", async function () {
      await paymaster.resetSpending();
      
      const stats = await paymaster.getPaymasterStats();
      expect(stats.totalSpentAmount.toString()).to.equal("0");
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete wallet creation and funding flow", async function () {
      // Create new wallet
      const salt = 12345;
      await walletFactory.createWallet(user.address, salt);
      const walletAddress = await walletFactory.getWalletAddress(user.address, salt);
      const userWallet = await ethers.getContractAt("Wallet", walletAddress);
      
      // Fund the wallet
      const fundAmount = ethers.utils.parseEther("2");
      await user.sendTransaction({
        to: walletAddress,
        value: fundAmount
      });
      
      // Execute transaction from wallet
      const transferAmount = ethers.utils.parseEther("0.5");
      const initialTargetBalance = await ethers.provider.getBalance(target.address);
      
      await userWallet.connect(user).execute(target.address, transferAmount, "0x");
      
      const finalTargetBalance = await ethers.provider.getBalance(target.address);
      expect(finalTargetBalance.sub(initialTargetBalance).toString()).to.equal(transferAmount.toString());
    });

    it("Should handle paymaster configuration flow", async function () {
      // Setup paymaster
      await paymaster.setWhitelist(user.address, true);
      await paymaster.setUserSpendLimit(user.address, ethers.utils.parseEther("1"));
      
      // Verify configuration
      const userInfo = await paymaster.getUserInfo(user.address);
      expect(userInfo.isWhitelisted).to.be.true;
      expect(userInfo.limit.toString()).to.equal(ethers.utils.parseEther("1").toString());
      expect(userInfo.spent.toString()).to.equal("0");
    });

    it("Should handle EntryPoint deposit and withdrawal flow", async function () {
      const depositAmount = ethers.utils.parseEther("3");
      const withdrawAmount = ethers.utils.parseEther("1");
      
      // Deposit
      await entryPoint.depositTo(user.address, { value: depositAmount });
      const balance = await entryPoint.balanceOf(user.address);
      expect(balance.toString()).to.equal(depositAmount.toString());
      
      // Withdraw
      const initialBalance = await ethers.provider.getBalance(beneficiary.address);
      await entryPoint.connect(user).withdrawTo(beneficiary.address, withdrawAmount);
      const finalBalance = await ethers.provider.getBalance(beneficiary.address);
      
      expect(finalBalance.sub(initialBalance).toString()).to.equal(withdrawAmount.toString());
      
      const remainingBalance = await entryPoint.balanceOf(user.address);
      expect(remainingBalance.toString()).to.equal(depositAmount.sub(withdrawAmount).toString());
    });
  });

  describe("Error Handling", function () {
    it("Should handle invalid addresses in constructors", async function () {
      const WalletFactory = await ethers.getContractFactory("WalletFactory");
      
      try {
        await WalletFactory.deploy(ethers.constants.AddressZero);
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("WalletFactory: EntryPoint cannot be zero address");
      }
    });

    it("Should handle insufficient balances gracefully", async function () {
      try {
        await entryPoint.withdrawTo(beneficiary.address, ethers.utils.parseEther("1"));
        expect.fail("Should have reverted");
      } catch (error) {
        expect(error.message).to.include("EntryPoint: insufficient balance");
      }
    });
  });
}); 