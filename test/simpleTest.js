// not needed with hardhat config
//const { ethers } = require('@nomiclabs/buidler')
//const { readArtifact } = require('@nomiclabs/buidler/plugins')
//const { solidity } = require('ethereum-waffle')

const { expect } = require('chai')

const {
  getEmittedEvent,
  latestTime,
  increaseTime
} = require('../src/test-helpers')
const TransactionStatus = require('../src/entities/transaction-status')
const TransactionParty = require('../src/entities/transaction-party')
const DisputeRuling = require('../src/entities/dispute-ruling')
const { inTransaction } = require('@openzeppelin/test-helpers/src/expectEvent')

//use(solidity)

const { BigNumber } = ethers

describe('MultipleArbitrableTokenTransactionWithAppeals contract', async () => {
  const arbitrationFee = 20
  const arbitratorExtraData = '0x85'
  const appealTimeout = 100
  const feeTimeout = 100
  const timeoutPayment = 100
  const amount = 1000
  const sharedMultiplier = 5000
  const winnerMultiplier = 2000
  const loserMultiplier = 8000
  const metaEvidenceUri = 'https://kleros.io'

  let arbitrator
  let _governor
  let sender
  let receiver
  let other
  let crowdfunder1
  let crowdfunder2

  let senderAddress
  let receiverAddress

  let contract
  let MULTIPLIER_DIVISOR
  let currentTime
  let token

  beforeEach('Setup contracts', async () => {
    ;[
      _governor,
      sender,
      receiver,
      other,
      crowdfunder1,
      crowdfunder2
    ] = await ethers.getSigners()
    senderAddress = await sender.getAddress()
    receiverAddress = await receiver.getAddress()

    const arbitratorArtifact = await hre.artifacts.readArtifact(
      './contracts/0.4.x/EnhancedAppealableArbitrator.sol:EnhancedAppealableArbitrator'
    )
    const Arbitrator = await ethers.getContractFactory(
      arbitratorArtifact.abi,
      arbitratorArtifact.bytecode
    )
    arbitrator = await Arbitrator.deploy(
      String(arbitrationFee),
      ethers.constants.AddressZero,
      arbitratorExtraData,
      appealTimeout
    )
    await arbitrator.deployed()
    // Make appeals go to the same arbitrator
    await arbitrator.changeArbitrator(arbitrator.address)

    const tokenArtifact = await hre.artifacts.readArtifact('./contracts/0.4.x/ERC20Mock.sol:ERC20Mock')
    const ERC20Token = await ethers.getContractFactory(
      tokenArtifact.abi,
      tokenArtifact.bytecode
    )
    token = await ERC20Token.deploy(senderAddress, amount * 10) // (initial account, initial balance)
    await token.deployed();

    const contractArtifact = await hre.artifacts.readArtifact(
      './contracts/0.7.x/MultipleArbitrableTokenTransactionWithAppeals.sol:MultipleArbitrableTokenTransactionWithAppeals'
    )
    const MultipleArbitrableTransaction = await ethers.getContractFactory(
      contractArtifact.abi,
      contractArtifact.bytecode
    )
    contract = await MultipleArbitrableTransaction.deploy(
      arbitrator.address,
      arbitratorExtraData,
      feeTimeout,
      sharedMultiplier,
      winnerMultiplier,
      loserMultiplier
    )
    await contract.deployed()

    const approveTx = await token
      .connect(sender)
      .approve(contract.address, amount * 10)
    await approveTx.wait()

    MULTIPLIER_DIVISOR = await contract.MULTIPLIER_DIVISOR()
    currentTime = latestTime;
    console.log('*****************');
    console.log('Escrow contract deployed at ' + contract.address);
    console.log('with centralized arbitrator ' + arbitrator.address);
    console.log('and token address ' + token.address);
    console.log('*****************');        
    })

  describe('Initialization', () => {
    it('Should set the correct values in constructor', async () => {
      expect(await contract.arbitrator()).to.equal(
        arbitrator.address,
        'Arbitrator address not properly set'
      )
      expect(await contract.arbitratorExtraData()).to.equal(
        arbitratorExtraData,
        'Arbitrator extra data not properly set'
      )
      expect(await contract.feeTimeout()).to.equal(
        feeTimeout,
        'Fee timeout not properly set'
      )
      expect(await contract.sharedStakeMultiplier()).to.equal(
        sharedMultiplier,
        'Shared multiplier not properly set'
      )
      expect(await contract.winnerStakeMultiplier()).to.equal(
        winnerMultiplier,
        'Winner multiplier not properly set'
      )
      expect(await contract.loserStakeMultiplier()).to.equal(
        loserMultiplier,
        'Loser multiplier not properly set'
      )
        })
    });
});