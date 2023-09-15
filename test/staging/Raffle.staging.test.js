const { ethers, network } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", function () {
      let raffle, raffleEntranceFee, deployer;

      beforeEach(async function () {
        deployer = (await ethers.getSigners())[0];
        // const deployedContracts = await deployments.fixture(["all"]);
        // raffle = await ethers.getContract("Raffle", deployer);

        raffle = await ethers.getContractAt(
          "Raffle",
          "0x5130598bdD2DBB722c3fc3826533F2C2E84fD2e4"
        );
        raffleEntranceFee = await raffle.getEntranceFee();
        // interval = await raffle.getInterval();
      });
      describe("Works with live Chainlink Keepers and Chainlink VRF, we get a random winner", function () {
        it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
          const startingTimeStamp = await raffle.getLatestTimeStamp();
          const accounts = await ethers.getSigners();
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("WinnerPicked event fired!");

              try {
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                // const winnerEndingBalance = await accounts[0].getBalance();
                const endingTimeStamp = await raffle.getLatestTimeStamp();

                await expect(raffle.getPlayer(0)).to.be.reverted;
                // assert.equal(String(recentWinner), accounts[0].address);
                assert.equal(raffleState, 0);
                // assert.equal(
                //   String(winnerEndingBalance),
                //   winnerStartingBalance.add(String(raffleEntranceFee))
                // );
                assert(endingTimeStamp > startingTimeStamp);
                resolve();
              } catch (error) {
                console.log(error);
                reject(e);
              }
            });
            console.log("Entering Raffle...");
            const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
            await tx.wait(1);
            console.log("Ok, time to wait...");
            // const winnerStartingBalance = await accounts[0].getBalance();
          });
        });
      });
    });
