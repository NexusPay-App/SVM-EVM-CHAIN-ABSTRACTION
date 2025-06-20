const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  
  console.log("Network:", network.name, "(Chain ID:", network.chainId + ")");
  console.log("Deployer address:", deployer.address);
  console.log("Balance:", ethers.utils.formatEther(await deployer.getBalance()), "ETH");
}

main().catch(console.error);
