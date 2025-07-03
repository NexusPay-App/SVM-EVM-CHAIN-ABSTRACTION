const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Current deployer:", deployer.address);
  
  const factoryAddress = "0xcd2f959936eB7c61376487eEc4BEbC44f1f95554";
  const newOwner = "0xCb3BB2F0899Bc9D5338be3bCC640f6dbeA3F691C";
  
  const factory = await ethers.getContractAt("PaymasterFactory", factoryAddress);
  
  console.log("📋 Transferring ownership...");
  const tx = await factory.transferOwnership(newOwner);
  await tx.wait();
  
  console.log("✅ Ownership transferred to:", newOwner);
  
  const currentOwner = await factory.owner();
  console.log("🔍 New owner:", currentOwner);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 