const { ethers, network, deployments } = require("hardhat");
const fs = require("fs");
const { FormatTypes } = require("@ethersproject/abi");

const FRONT_END_ADDRESSES_FILE =
  "../nextjs-smartcontract-lottery-fcc/constants/contractAdresses.json";
const FRONT_END_ABI_FILE =
  "../nextjs-smartcontract-lottery-fcc/constants/abi.json";

module.exports = async function () {
  if (process.env.UPDATE_FRONT_END) {
    console.log("Updating front end...");
    const raffle = await ethers.getContractAt(
      "Raffle",
      (await deployments.get("Raffle")).address
    );
    const chainId = network.config.chainId.toString();
    updateContractAddresses(raffle, chainId);
    updateAbi(raffle);
  }
};

async function updateAbi(raffle) {
  console.log("Nestoooo: ", raffle.interface.format(FormatTypes.json));
  fs.writeFileSync(
    FRONT_END_ABI_FILE,
    JSON.stringify(raffle.interface.fragments)
  );
}

async function updateContractAddresses(raffle, chainId) {
  const currentAddresses = JSON.parse(
    fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8")
  );
  if (chainId in currentAddresses) {
    if (!currentAddresses[chainId].includes(raffle.address)) {
      currentAddresses[chainId].push(raffle.address);
    }
  }
  {
    currentAddresses[chainId] = [raffle.target];
  }
  fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses));
}

module.exports.tags = ["all", "frontend"];
