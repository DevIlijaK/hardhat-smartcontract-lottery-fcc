const { ethers, network, deployments } = require("hardhat");
const {
  developmentChains,
  networkConfig,
} = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", function () {
      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval;
      const chainId = network.config.chainId;

      beforeEach(async function () {
        deployer = (await ethers.getSigners())[0];
        const deployedContracts = await deployments.fixture(["all"]);
        // raffle = await ethers.getContract("Raffle", deployer);

        vrfCoordinatorV2Mock = await ethers.getContractAt(
          "VRFCoordinatorV2Mock",
          deployedContracts.VRFCoordinatorV2Mock.address
        );
        raffle = await ethers.getContractAt(
          "Raffle",
          deployedContracts.Raffle.address
        );
        raffleEntranceFee = await raffle.getEntranceFee();
        interval = await raffle.getInterval();
      });
      describe("constructor", function () {
        it("Initializes the raffle correctly", async function () {
          const raffleState = await raffle.getRaffleState();
          assert.equal(raffleState.toString(), "0");
          assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
        });
      });
      describe("enterRaffle", function () {
        it("Reverts when you don't pay enough", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
            raffle,
            "Raffle_NotEnoughEthEntered"
          );
        });
        it("Records players when they enter", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          const playerFromContract = await raffle.getPlayer(0);
          assert.equal(playerFromContract, deployer.address);
        });
        it("Emits event on enter", async function () {
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.emit(raffle, "RaffleEnter");
        });
        it("Doesnt allow entrance when raffle is calculating", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);

          await raffle.performUpkeep("0x");
          await expect(
            raffle.enterRaffle({ value: raffleEntranceFee })
          ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen");
        });
      });
      describe("checkUpkeep", function () {
        it("Returns false if people haven't sent any ETH", async function () {
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.checkUpkeep("0x");
          assert(!upkeepNeeded);
        });
        it("Returns false if raffle isn't open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          await raffle.performUpkeep("0x");
          const raffleState = await raffle.getRaffleState();
          const { upkeepNeeded } = await raffle.checkUpkeep("0x");
          assert(String(raffleState), "1");
          assert(!upkeepNeeded);
        });
        it("Returns true if enough time has passed, has players, eth, and is open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const { upkeepNeeded } = await raffle.checkUpkeep("0x");
          assert(upkeepNeeded);
        });
      });
      describe("performUpkeep", function () {
        it("it can only run if checkupkeep is true", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const tx = await raffle.performUpkeep("0x");
          assert(tx);
        });
        it("Reverts when checkupkeep is false", async function () {
          await expect(
            raffle.performUpkeep("0x")
          ).to.be.revertedWithCustomError(raffle, "Raffle__UpkkepNotNeeded");
        });
        it("updates the raffle state, emits an event, and calls the vrf coordinator", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
          const txResponse = await raffle.performUpkeep("0x");
          const txReceipt = await txResponse.wait(1);
          const requestId = txReceipt.logs[1].args.requestId;
          const raffleState = await raffle.getRaffleState();
          assert(Number(requestId) > 0);
          assert(Number(raffleState) == 1);
        });
      });
      describe("fulfillRandomWords", function () {
        this.beforeEach(async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee });
          await network.provider.send("evm_increaseTime", [
            Number(interval) + 1,
          ]);
          await network.provider.send("evm_mine", []);
        });
        it("can only be called after performUpkeep", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target)
          ).to.be.revertedWith("nonexistent request");
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target)
          ).to.be.revertedWith("nonexistent request");
        });
        it("picks a winner, resets the lottery, and sends money", async function () {
          const additionalEntrants = 3;
          const startingAccountIndex = 1; // deployer = 0
          const accounts = await ethers.getSigners();
          for (
            let i = startingAccountIndex;
            i < startingAccountIndex + additionalEntrants;
            i++
          ) {
            const accountConnectedRaffle = raffle.connect(accounts[i]);
            await accountConnectedRaffle.enterRaffle({
              value: raffleEntranceFee,
            });
          }
          const startingTimeStamp = await raffle.getLatestTimeStamp();
          // performUpkeep (mock being Chainlink Keepers)
          // fulfillRandomWords (mock being the Chainlink VRF)
          // We will have to wait for the fulfillRandomWords to be called
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              try {
                const recentWinner = await raffle.getRecentWinner();
                const raffleState = await raffle.getRaffleState();
                const endingTimeStamp = await raffle.getLatestTimeStamp();
                const numPlayers = await raffle.getNumberOfPlayers();
                const winnerEndingBalance = await raffle.provider.getBalance(
                  accounts[1].address
                );
                assert.equal(Number(numPlayers), 0);
                assert.equal(String(raffleState), "0");
                assert(endingTimeStamp > startingTimeStamp);

                assert.equal(
                  String(winnerEndingBalance),
                  String(
                    winnerStartingBalance.add(
                      raffle.mul(additionalEntrants).add(raffleEntranceFee)
                    )
                  )
                );
              } catch (e) {
                reject(e);
              }
            });
            resolve();
          });
          try {
            const tx = await raffle.performUpkeep("0x");
            const txReceipt = await tx.wait(1);
            const winnerStartingBalance = await raffle.provider.getBalance(
              accounts[1].address
            );

            const nesto = await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReceipt.logs[1].args.requestId,
              raffle.target
            );
            const nesto2 = await nesto.wait(1);
          } catch (e) {
            console.log(e);
          }
        });
      });
    });
