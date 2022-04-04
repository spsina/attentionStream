import { BigNumber } from "ethers";
import helpers from "../scripts/helpers";
import { addChoice, addTopic, deployArena, vote } from "../scripts/deploy";
import { Arena, ERC20 } from "../typechain";
import {
  getValidArenaParams,
  getValidChoiceBParams,
  getValidChoiceParams,
  getValidTopicParams,
} from "./test.creations.data";
import { ethers, network } from "hardhat";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Test Voting mechanism", async () => {
  let arena: Arena;
  let token: ERC20;
  let arenaFunds: SignerWithAddress;
  let topicFunds: SignerWithAddress;
  let choiceAFunds: SignerWithAddress;
  let choiceBFunds: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;
  const topic: BigNumber = BigNumber.from(1);
  const choiceA: BigNumber = BigNumber.from(1);
  const choiceB: BigNumber = BigNumber.from(2);

  async function _deployArena() {
    const arenaParams = getValidArenaParams();
    arenaParams.token = token.address;
    arenaParams.funds = arenaFunds.address;
    arena = await deployArena(arenaParams);
    await arena.deployed();
  }

  async function _deployTopic() {
    const topicParams = getValidTopicParams();
    topicParams.funds = topicFunds.address;
    const _topicTx = await addTopic(arena, topicParams);
    await _topicTx.wait(1);
  }

  async function _deployTwoChoices() {
    const choiceAParams = getValidChoiceParams();
    choiceAParams.funds = choiceAFunds.address;

    const choiceBParams = getValidChoiceBParams();
    choiceBParams.funds = choiceBFunds.address;

    const _choiceATx = await addChoice(arena, topic, choiceAParams);
    const _choiceBTx = await addChoice(arena, topic, choiceBParams);

    await _choiceATx.wait(1);
    await _choiceBTx.wait(1);
  }

  async function _setupAttentionStreams() {
    token = await helpers.getTestVoteToken();
    await _deployArena();
    await _deployTopic();
    await _deployTwoChoices();
  }

  async function _fundVoters() {
    const _tx1 = await token.transfer(
      voter1.address,
      ethers.utils.parseEther("100")
    );
    await _tx1.wait(1);
    const _tx2 = await token.transfer(
      voter2.address,
      ethers.utils.parseEther("20")
    );
    await _tx2.wait(1);
  }

  before(async () => {
    [, arenaFunds, topicFunds, choiceAFunds, choiceBFunds, voter1, voter2] =
      await ethers.getSigners();
    await _setupAttentionStreams();
    await _fundVoters();
  });
  describe("Core voting mechanism", async () => {
    it("should fail to vote with less than min contribution amount", async () => {
      const tx = vote(arena, topic, choiceA, BigNumber.from(5), voter1);
      await expect(tx).to.be.revertedWith("contribution amount too low");
    });
    it("voter one puts 11 tokens on choice A", async () => {
      const tx = await vote(arena, topic, choiceA, BigNumber.from(11), voter1);
      await tx.wait(1);
      const positionInfo = await arena.choicePositionSummery(topic, choiceA);
      expect(positionInfo.tokens).to.equal(BigNumber.from(11));
    });
    it("should correctly retrieve voter 1 position info on choice A before the new cycle", async () => {
      const info = await arena.getVoterPositionOnChoice(
        topic,
        choiceA,
        voter1.address
      );

      expect(info.shares).to.equal(BigNumber.from(0));
      expect(info.tokens).to.equal(BigNumber.from(11));
    });
    it("should retrieve correct shares info of voter 1 on choice A after one cycle", async () => {
      // current topic defines a cycle duration of 100 block
      // mine 100 blocks
      for (let i = 0; i < 100; i++) {
        await network.provider.send("evm_mine");
      }

      const info = await arena.getVoterPositionOnChoice(
        topic,
        choiceA,
        voter1.address
      );

      expect(info.shares).to.equal(BigNumber.from(11));
      expect(info.tokens).to.equal(BigNumber.from(11));
    });
    it("voter 1 puts another 20 votes on choice A", async () => {
      const tx = await vote(arena, topic, choiceA, BigNumber.from(20), voter1);
      await tx.wait(1);
      const info = await arena.getVoterPositionOnChoice(
        topic,
        choiceA,
        voter1.address
      );
      expect(info.tokens).to.equal(31);
    });
    it("voter two puts 10 tokens on choice A overall there have to be 41 votes on choice a", async () => {
      const tx = await vote(arena, topic, choiceA, BigNumber.from(10), voter2);
      await tx.wait(1);
      const positionInfo = await arena.choicePositionSummery(topic, choiceA);
      expect(positionInfo.tokens).to.equal(BigNumber.from(41));
    });
    it("should correctly retrieve voter 1 and 2 info on choice a after 2 more cycles", async () => {
      for (let i = 0; i < 200; i++) {
        await network.provider.send("evm_mine");
      }
      const position1 = await arena.getVoterPositionOnChoice(
        topic,
        choiceA,
        voter1.address
      );
      const position2 = await arena.getVoterPositionOnChoice(
        topic,
        choiceA,
        voter2.address
      );

      const positionInfo = await arena.choicePositionSummery(topic, choiceA);

      expect(positionInfo.tokens).to.equal(41);
      expect(positionInfo.shares).to.equal(93);

      expect(position1.tokens).to.equal(31);
      expect(position1.shares).to.equal(73);

      expect(position2.tokens).to.equal(10);
      expect(position2.shares).to.equal(20);
    });
    it("voter 2 puts another 20 tokens on choice A", async () => {
      const tx = await vote(arena, topic, choiceA, BigNumber.from(20), voter2);
      await tx.wait(1);
      const position2 = await arena.getVoterPositionOnChoice(
        topic,
        choiceA,
        voter2.address
      );
      expect(position2.tokens).to.equal(30);
      expect(position2.shares).to.equal(20);
    });
    it("should retrieve correct position info after one more cycle", async () => {
      for (let i = 0; i < 100; i++) {
        await network.provider.send("evm_mine");
      }

      const positionInfo = await arena.choicePositionSummery(topic, choiceA);
      const position2 = await arena.getVoterPositionOnChoice(
        topic,
        choiceA,
        voter2.address
      );

      expect(position2.tokens).to.equal(30);
      expect(position2.shares).to.equal(50);

      expect(positionInfo.tokens).to.equal(61);
      expect(positionInfo.shares).to.equal(154);
    });
    it("should retrieve correct choice position info for choice B", async () => {
      const positionInfo = await arena.choicePositionSummery(topic, choiceB);
      expect(positionInfo.tokens).to.equal(0);
      expect(positionInfo.shares).to.equal(0);
    });
    it("should allow voter one to vote 12 tokens on choice B", async () => {
      const tx = await vote(arena, topic, choiceB, BigNumber.from(20), voter1);
      tx.wait();
      const position1OnB = await arena.getVoterPositionOnChoice(
        topic,
        choiceB,
        voter1.address
      );
      expect(position1OnB.tokens).to.equal(20);
    });
    it("should retrieve correct choice A and B info after one more cycle", async () => {
      for (let i = 0; i < 100; i++) {
        await network.provider.send("evm_mine");
      }

      const positionAInfo = await arena.choicePositionSummery(topic, choiceA);
      const positionBInfo = await arena.choicePositionSummery(topic, choiceB);

      expect(positionAInfo.tokens).to.equal(61);
      expect(positionAInfo.shares).to.equal(215);

      expect(positionBInfo.tokens).to.equal(20);
      expect(positionBInfo.shares).to.equal(20);
    });
  });
});