const { ethers, network } = require("hardhat");

async function mockKeepers() {
  const raffle = await ethers.getContractAt(
    "Raffle",
    (await deployments.get("Raffle")).address
  );
  const checkData = ethers.keccak256(ethers.toUtf8Bytes(""));
  const upkeepNeeded = await raffle.checkUpkeep.staticCall(checkData);
  const isOpen = await raffle.getIsOpen();
  const timePassed = await raffle.getTimePassed();
  const hasPlayers = await raffle.getHasPlayers();
  const hasBalance = await raffle.getHasBalance();
  const recentWinner = await raffle.getRecentWinner();
  const numberOfPlayers = await raffle.getNumberOfPlayers();

  if (upkeepNeeded) {
    const tx = await raffle.performUpkeep(checkData);
    const txReceipt = await tx.wait(1);
    const requestId = txReceipt.logs[1].args.requestId;
    console.log(`Performed upkeep with RequestId: ${requestId}`);
    if (network.config.chainId == 31337) {
      await mockVrf(requestId, raffle);
    }
  } else {
    console.log("No upkeep needed!");
  }
}

async function mockVrf(requestId, raffle) {
  console.log("We on a local network? Ok let's pretend...");
  const vrfCoordinatorV2Mock = await ethers.getContractAt(
    "VRFCoordinatorV2Mock",
    (await deployments.get("VRFCoordinatorV2Mock")).address
  );
  await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.target);
  console.log("Responded!");
  const recentWinner = await raffle.getRecentWinner();
  console.log(`The winner is: ${recentWinner}`);
}

mockKeepers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
