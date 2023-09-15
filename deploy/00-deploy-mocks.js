const { developmentChains } = require("../helper-hardhat-config");
const { ethers, network } = require("hardhat");

const BASE_FEE = ethers.parseEther("0.25");
const GASE_PRICE_LINK = 1e9; // calculated value based on the gas price of the chain

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  const args = [BASE_FEE, GASE_PRICE_LINK];

  if (developmentChains.includes(network.name)) {
    log("Local netork detected! Deploying mocks...");
    // deploy a mock vrfcoordinator...
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    });
    log("Mocks deployed!");
  }
};
module.exports.tags = ["all", "mocks"];
