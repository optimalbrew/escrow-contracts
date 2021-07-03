// pcar. following not needed with hardhat config
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

//describe0
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
      crowdfunder2,
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
    currentTime = await latestTime;
    //console.log('*****************');
    //console.log('Escrow contract deployed at ' + contract.address);
    //console.log('with centralized arbitrator ' + arbitrator.address);
    //console.log('and token address ' + token.address);
    //console.log('*****************');        
    }); //beforeEach

  describe('Initialization', () => {
    it('Verify values in escrow constructor', async () => {
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
        });
    }); //end desc init

  describe('Create new transaction', () => {
    it('Should create a transaction when parameters are valid', async () => {
      const metaEvidence = metaEvidenceUri
      const tokensBefore = await getTokenBalances()

      const txPromise = await contract
        .connect(sender)
        .createTransaction( // #pcar this is from the escrow
          amount,
          token.address, //pcar contract <=> address
          timeoutPayment,
          receiverAddress,
          metaEvidence
        )
      const transactionCount = await contract
        .connect(receiver)
        .getCountTransactions()
      const expectedTransactionID = 1
      const contractBalance = await ethers.provider.getBalance(contract.address)

      const tokensAfter = await getTokenBalances()

      expect(transactionCount).to.equal(
        BigNumber.from(expectedTransactionID),
        'Invalid transactionCount'
      )
      await expect(txPromise)
        .to.emit(contract, 'TransactionCreated')
        .withArgs(
          expectedTransactionID,
          senderAddress,
          receiverAddress,
          token.address,
          amount
        )
      await expect(txPromise)
        .to.emit(contract, 'MetaEvidence')
        .withArgs(expectedTransactionID, metaEvidence)
      expect(contractBalance).to.equal(
        BigNumber.from(0),
        'Contract balance should be 0'
      )
      expect(tokensBefore.receiver).to.equal(
        tokensAfter.receiver,
        `"Receiver balance shouldn't change"`
      )
      expect(tokensBefore.sender - amount).to.equal(
        tokensAfter.sender,
        'Wrong sender balance'
      )
      expect(tokensBefore.contract + amount).to.equal(
        tokensAfter.contract,
        'Wrong contract balance'
      )
      })
    
      it('Should emit a correct TransactionStateUpdated event for the newly created transaction', async () => {
        currentTime =  Date.now(); //latestTime();
        const [
          _receipt,
          transactionId,
          transaction
        ] = await createTransactionHelper(amount)
  
        expect(transactionId).to.equal(1, 'Invalid transaction ID')
        expect(transaction.status).to.equal(
          TransactionStatus.NoDispute,
          'Invalid status'
        )
        expect(transaction.sender).to.equal(
          senderAddress,
          'Invalid sender address'
        )
        expect(transaction.receiver).to.equal(
          receiverAddress,
          'Invalid receiver address'
        )
        expect(Number(transaction.lastInteraction)).to.be.closeTo(
          currentTime/1000,
          50, //pcar within 50 seconds changed from 10, which does not always work. Random mining timestamps?
          'Invalid last interaction'
        )
        expect(transaction.amount).to.equal(amount, 'Invalid transaction amount')
        expect(transaction.token).to.equal(token.address, 'Invalid token address')
        expect(transaction.deadline).to.equal(
          BigNumber.from(timeoutPayment).add(transaction.lastInteraction),
          'Wrong deadline'
        )
        expect(transaction.disputeID).to.equal(0, 'Invalid dispute ID')
        expect(transaction.senderFee).to.equal(0, 'Invalid senderFee')
        expect(transaction.receiverFee).to.equal(0, 'Invalid receieverFee')
      })
  
      it('Should store the proper hashed transaction state of the newly created transaction', async () => {
        const [
          _receipt,
          transactionId,
          transaction
        ] = await createTransactionHelper(amount)
  
        // transactions IDs start at 1, so index in transactionHashes will be transactionId - 1.
        const actualHash = await contract.transactionHashes(transactionId - 1)
        const expectedHash = await contract.hashTransactionState(transaction)
        const expectedHashCD = await contract.hashTransactionStateCD(transaction)
  
        expect(actualHash).to.equal(
          expectedHash,
          'Invalid transaction state hash'
        )
        expect(actualHash).to.equal(
          expectedHashCD,
          'Invalid transaction state hash when using calldata argument'
        )
        })
      }) //end desc create new tx
      
  describe('Reimburse sender', () => {
    it('Should reimburse the sender and update the hash correctly', async () => {
      const [
        _receipt,
        transactionId,
        transaction
      ] = await createTransactionHelper(amount)
      const reimburseAmount = amount

      const tokensBefore = await getTokenBalances()
      const reimburseTx = await contract
        .connect(receiver)
        .reimburse(transactionId, transaction, reimburseAmount)
      const reimburseReceipt = await reimburseTx.wait()
      const [_rTransactionId, rTransaction] = getEmittedEvent(
        'TransactionStateUpdated',
        reimburseReceipt
      ).args
      const tokensAfter = await getTokenBalances()

      expect(tokensBefore.receiver).to.equal(
        tokensAfter.receiver,
        `"Receiver balance shouldn't change"`
      )
      expect(tokensBefore.sender + reimburseAmount).to.equal(
        tokensAfter.sender,
        'Sender was not reimbursed correctly'
      )
      expect(tokensBefore.contract - reimburseAmount).to.equal(
        tokensAfter.contract,
        'Wrong contract balance'
      )

      const updatedHash = await contract.transactionHashes(transactionId - 1)
      const expectedHash = await contract.hashTransactionState(rTransaction)
      expect(updatedHash).to.equal(
        expectedHash,
        'Hash was not updated correctly'
      )
    })

    it('Should emit correct TransactionStateUpdated and Payment events', async () => {
      const [
        _receipt,
        transactionId,
        transaction
      ] = await createTransactionHelper(amount)

      currentTime = Date.now();// await latestTime()
      const reimburseTx = await contract
        .connect(receiver)
        .reimburse(transactionId, transaction, amount)
      const reimburseReceipt = await reimburseTx.wait()
      const [rTransactionId, rTransaction] = getEmittedEvent(
        'TransactionStateUpdated',
        reimburseReceipt
      ).args
      const [
        pTransactionId,
        amountReimbursed,
        reimburseCaller
      ] = getEmittedEvent('Payment', reimburseReceipt).args

      expect(rTransactionId).to.equal(transactionId, 'Invalid transaction ID')
      expect(rTransaction.status).to.equal(transaction.status, 'Invalid status')
      expect(rTransaction.sender).to.equal(
        senderAddress,
        'Invalid sender address'
      )
      expect(rTransaction.receiver).to.equal(
        receiverAddress,
        'Invalid receiver address'
      )
      expect(Number(rTransaction.lastInteraction)).to.be.closeTo(
        currentTime/1000,
        50,
        'Invalid last interaction'
      )
      expect(rTransaction.amount).to.equal(0, 'Invalid transaction amount')
      expect(rTransaction.token).to.equal(
        token.address,
        'Invalid token address'
      )
      expect(rTransaction.deadline).to.equal(
        transaction.deadline,
        'Wrong deadline'
      )
      expect(rTransaction.disputeID).to.equal(0, 'Invalid dispute ID')
      expect(rTransaction.senderFee).to.equal(0, 'Invalid senderFee')
      expect(rTransaction.receiverFee).to.equal(0, 'Invalid receieverFee')

      expect(pTransactionId).to.equal(
        transactionId,
        'Invalid transaction ID on Payment event'
      )
      expect(amountReimbursed).to.equal(
        amount,
        'Invalid amount reimbursed on Payment event'
      )
      expect(reimburseCaller).to.equal(
        receiverAddress,
        'Invalid caller address on Payment event'
      )
    })

    it('Should revert on bad inputs', async () => {
      const [
        _receipt,
        transactionId,
        transaction
      ] = await createTransactionHelper(amount)

      await expect(
        contract.connect(sender).reimburse(transactionId, transaction, amount)
      ).to.be.revertedWith('The caller must be the receiver.')
      await expect(
        contract
          .connect(receiver)
          .reimburse(transactionId, transaction, amount * 2)
      ).to.be.revertedWith('Maximum reimbursement available exceeded.')

      // Reimburse half of the total amount
      currentTime = Date.now(); // await latestTime()
      const reimburseTx = await contract
        .connect(receiver)
        .reimburse(transactionId, transaction, 500)
      const reimburseReceipt = await reimburseTx.wait()
      const [rTransactionId, rTransaction] = getEmittedEvent(
        'TransactionStateUpdated',
        reimburseReceipt
      ).args

      await expect(
        contract.connect(receiver).reimburse(transactionId, transaction, amount)
      ).to.be.revertedWith("Transaction doesn't match stored hash.")
      await expect(
        contract
          .connect(receiver)
          .reimburse(rTransactionId, rTransaction, amount)
      ).to.be.revertedWith('Maximum reimbursement available exceeded.')
    })
  })// end desc reimburse sender

  describe('Pay receiver', () => {
    it('Should pay the receiver and update the hash correctly', async () => {
      const [
        _receipt,
        transactionId,
        transaction
      ] = await createTransactionHelper(amount)
      const payAmount = amount

      const tokensBefore = await getTokenBalances()
      const payTx = await contract
        .connect(sender)
        .pay(transactionId, transaction, payAmount)
      const payReceipt = await payTx.wait()
      const [_payTransactionId, payTransaction] = getEmittedEvent(
        'TransactionStateUpdated',
        payReceipt
      ).args
      const tokensAfter = await getTokenBalances()

      expect(tokensBefore.receiver + payAmount).to.equal(
        tokensAfter.receiver,
        'Receiver was not paid correctly'
      )
      expect(tokensBefore.sender).to.equal(
        tokensAfter.sender,
        `"Sender balance shouldn't change"`
      )
      expect(tokensBefore.contract - payAmount).to.equal(
        tokensAfter.contract,
        'Wrong contract balance'
      )

      const updatedHash = await contract.transactionHashes(transactionId - 1)
      const expectedHash = await contract.hashTransactionState(payTransaction)
      expect(updatedHash).to.equal(
        expectedHash,
        'Hash was not updated correctly'
      )
    })

    it('Should emit correct TransactionStateUpdated and Payment events', async () => {
      const [
        _receipt,
        transactionId,
        transaction
      ] = await createTransactionHelper(amount)

      currentTime = Date.now(); //await latestTime()
      const payTx = await contract
        .connect(sender)
        .pay(transactionId, transaction, amount)
      const payReceipt = await payTx.wait()
      const [payTransactionId, payTransaction] = getEmittedEvent(
        'TransactionStateUpdated',
        payReceipt
      ).args
      const [pTransactionId, amountPaid, payCaller] = getEmittedEvent(
        'Payment',
        payReceipt
      ).args

      expect(payTransactionId).to.equal(transactionId, 'Invalid transaction ID')
      expect(payTransaction.status).to.equal(
        transaction.status,
        'Invalid status'
      )
      expect(payTransaction.sender).to.equal(
        senderAddress,
        'Invalid sender address'
      )
      expect(payTransaction.receiver).to.equal(
        receiverAddress,
        'Invalid receiver address'
      )
      expect(Number(payTransaction.lastInteraction)).to.be.closeTo(
        currentTime/1000,
        70,
        'Invalid last interaction'
      )
      expect(payTransaction.amount).to.equal(0, 'Invalid transaction amount')
      expect(payTransaction.token).to.equal(
        token.address,
        'Invalid token address'
      )
      expect(payTransaction.deadline).to.equal(
        transaction.deadline,
        'Wrong deadline'
      )
      expect(payTransaction.disputeID).to.equal(0, 'Invalid dispute ID')
      expect(payTransaction.senderFee).to.equal(0, 'Invalid senderFee')
      expect(payTransaction.receiverFee).to.equal(0, 'Invalid receieverFee')

      expect(pTransactionId).to.equal(
        transactionId,
        'Invalid transaction ID on Payment event'
      )
      expect(amountPaid).to.equal(
        amount,
        'Invalid amount reimbursed on Payment event'
      )
      expect(payCaller).to.equal(
        senderAddress,
        'Invalid caller address on Payment event'
      )
    })

    it('Should revert on bad inputs', async () => {
      const [
        _receipt,
        transactionId,
        transaction
      ] = await createTransactionHelper(amount)

      await expect(
        contract.connect(receiver).pay(transactionId, transaction, amount)
      ).to.be.revertedWith('The caller must be the sender.')
      await expect(
        contract.connect(sender).pay(transactionId, transaction, amount * 2)
      ).to.be.revertedWith('Maximum amount available for payment exceeded.')

      // Reimburse half of the total amount
      //currentTime = Date.now(); //await latestTime()
      const payTx = await contract
        .connect(sender)
        .pay(transactionId, transaction, 500)
      const payReceipt = await payTx.wait()
      const [payTransactionId, payTransaction] = getEmittedEvent(
        'TransactionStateUpdated',
        payReceipt
      ).args

      await expect(
        contract.connect(sender).pay(transactionId, transaction, amount)
      ).to.be.revertedWith("Transaction doesn't match stored hash.")
      await expect(
        contract.connect(sender).pay(payTransactionId, payTransaction, amount)
      ).to.be.revertedWith('Maximum amount available for payment exceeded.')
    })
  })   // end describe pay receiver 


    
    /**********************
    * Helpers
    ********************
    */ 
  /**
   * Creates a transaction by sender to receiver.
   * @param {number} _amount Amount in wei.
   * @returns {Array} Tx data.
   */
   async function createTransactionHelper(_amount) {
    const metaEvidence = metaEvidenceUri

    const tx = await contract
      .connect(sender)
      .createTransaction(
        _amount,
        token.address,
        timeoutPayment,
        receiverAddress,
        metaEvidence
      )
    const receipt = await tx.wait()
    const [transactionId, transaction] = getEmittedEvent(
      'TransactionStateUpdated',
      receipt
    ).args

    return [receipt, transactionId, transaction]
  }

  /**
   * Make both sides pay arbitration fees. The transaction should have been previosuly created.
   * @param {number} _transactionId Id of the transaction.
   * @param {object} _transaction Current transaction object.
   * @param {number} fee Appeal round from which to withdraw the rewards.
   * @returns {Array} Tx data.
   */
  async function createDisputeHelper(
    _transactionId,
    _transaction,
    fee = arbitrationFee
  ) {
    // Pay fees, create dispute and validate events.
    const receiverTxPromise = contract
      .connect(receiver)
      .payArbitrationFeeByReceiver(_transactionId, _transaction, {
        value: fee
      })
    const receiverFeeTx = await receiverTxPromise
    const receiverFeeReceipt = await receiverFeeTx.wait()
    expect(receiverTxPromise)
      .to.emit(contract, 'HasToPayFee')
      .withArgs(_transactionId, TransactionParty.Sender)
    const [receiverFeeTransactionId, receiverFeeTransaction] = getEmittedEvent(
      'TransactionStateUpdated',
      receiverFeeReceipt
    ).args
    const txPromise = contract
      .connect(sender)
      .payArbitrationFeeBySender(
        receiverFeeTransactionId,
        receiverFeeTransaction,
        {
          value: fee
        }
      )
    const senderFeeTx = await txPromise
    const senderFeeReceipt = await senderFeeTx.wait()
    const [senderFeeTransactionId, senderFeeTransaction] = getEmittedEvent(
      'TransactionStateUpdated',
      senderFeeReceipt
    ).args
    expect(txPromise)
      .to.emit(contract, 'Dispute')
      .withArgs(
        arbitrator.address,
        senderFeeTransaction.disputeID,
        senderFeeTransactionId,
        senderFeeTransactionId
      )
    expect(senderFeeTransaction.status).to.equal(
      TransactionStatus.DisputeCreated,
      'Invalid transaction status'
    )
    return [
      senderFeeTransaction.disputeID,
      senderFeeTransactionId,
      senderFeeTransaction
    ]
  }

  /**
   * Submit evidence related to a given transaction.
   * @param {number} transactionId Id of the transaction.
   * @param {object} transaction Current transaction object.
   * @param {string} evidence Link to evidence.
   * @param {address} caller Can only be called by the sender or the receiver.
   */
  async function submitEvidenceHelper(
    transactionId,
    transaction,
    evidence,
    caller
  ) {
    const callerAddress = await caller.getAddress()
    if (
      callerAddress === transaction.sender ||
      callerAddress === transaction.receiver
    )
      if (transaction.status !== TransactionStatus.Resolved) {
        const txPromise = contract
          .connect(caller)
          .submitEvidence(transactionId, transaction, evidence)
        const tx = await txPromise
        await tx.wait()
        expect(txPromise)
          .to.emit(contract, 'Evidence')
          .withArgs(arbitrator.address, transactionId, callerAddress, evidence)
      } else {
        await expect(
          contract
            .connect(caller)
            .submitEvidence(transactionId, transaction, evidence)
        ).to.be.revertedWith(
          'Must not send evidence if the dispute is resolved.'
        )
      }
    else
      await expect(
        contract
          .connect(caller)
          .submitEvidence(transactionId, transaction, evidence)
      ).to.be.revertedWith('The caller must be the sender or the receiver.')
  }

  /**
   * Give ruling (not final).
   * @param {number} disputeID dispute ID.
   * @param {number} ruling Ruling: None, Sender or Receiver.
   * @returns {Array} Tx data.
   */
  async function giveRulingHelper(disputeID, ruling) {
    // Notice that rule() function is not called by the arbitrator, because the dispute is appealable.
    const txPromise = arbitrator.giveRuling(disputeID, ruling)
    const tx = await txPromise
    const receipt = await tx.wait()

    return [txPromise, tx, receipt]
  }

  /**
   * Give final ruling and enforce it.
   * @param {number} disputeID dispute ID.
   * @param {number} ruling Ruling: None, Sender or Receiver.
   * @param {number} transactionDisputeId Initial dispute ID.
   * @returns {Array} Random integer in the range (0, max].
   */
  async function giveFinalRulingHelper(
    disputeID,
    ruling,
    transactionDisputeId = disputeID
  ) {
    const firstTx = await arbitrator.giveRuling(disputeID, ruling)
    await firstTx.wait()

    await increaseTime(appealTimeout + 1)

    const txPromise = arbitrator.giveRuling(disputeID, ruling)
    const tx = await txPromise
    const receipt = await tx.wait()

    expect(txPromise)
      .to.emit(contract, 'Ruling')
      .withArgs(arbitrator.address, transactionDisputeId, ruling)

    return [txPromise, tx, receipt]
  }

  /**
   * Execute the final ruling.
   * @param {number} transactionId Id of the transaction.
   * @param {object} transaction Current transaction object.
   * @param {address} caller Can be anyone.
   * @returns {Array} Transaction ID and the updated object.
   */
  async function executeRulingHelper(transactionId, transaction, caller) {
    const tx = await contract
      .connect(caller)
      .executeRuling(transactionId, transaction)
    const receipt = await tx.wait()
    const [newTransactionId, newTransaction] = getEmittedEvent(
      'TransactionStateUpdated',
      receipt
    ).args

    return [newTransactionId, newTransaction]
  }

  /**
   * Fund new appeal round.
   * @param {number} transactionId Id of the transaction.
   * @param {object} transaction Current transaction object.
   * @param {address} caller Can be anyone.
   * @param {number} contribution Contribution amount in wei.
   * @param {number} side Side to contribute to: Sender or Receiver.
   * @returns {Array} Tx data.
   */
  async function fundAppealHelper(
    transactionId,
    transaction,
    caller,
    contribution,
    side
  ) {
    const txPromise = contract
      .connect(caller)
      .fundAppeal(transactionId, transaction, side, { value: contribution })
    const tx = await txPromise
    const receipt = await tx.wait()

    return [txPromise, tx, receipt]
  }

  /**
   * Withdraw rewards to beneficiary.
   * @param {address} beneficiary Address of the round contributor.
   * @param {number} transactionId Id of the transaction.
   * @param {object} transaction Current transaction object.
   * @param {number} round Appeal round from which to withdraw the rewards.
   * @param {address} caller Can be anyone.
   * @returns {Array} Tx data.
   */
  async function withdrawHelper(
    beneficiary,
    transactionId,
    transaction,
    round,
    caller
  ) {
    const txPromise = contract
      .connect(caller)
      .withdrawFeesAndRewards(beneficiary, transactionId, transaction, round)
    const tx = await txPromise
    const receipt = await tx.wait()

    return [txPromise, tx, receipt]
  }

  /**
   * Get token balances of accounts and contract.
   * @returns {object} Balances.
   */
  async function getTokenBalances() {
    const tokenBalances = {
      sender: (await token.balanceOf(senderAddress)).toNumber(),
      receiver: (await token.balanceOf(receiverAddress)).toNumber(),
      contract: (await token.balanceOf(contract.address)).toNumber()
    }
    return tokenBalances
  }

  /**
   * Get wei balances of accounts and contract.
   * @returns {object} Balances.
   */
  async function getBalances() {
    const balances = {
      sender: await sender.getBalance(),
      receiver: await receiver.getBalance(),
      contract: await ethers.provider.getBalance(contract.address),
      crowdfunder1: await crowdfunder1.getBalance(),
      crowdfunder2: await crowdfunder2.getBalance()
    }
    return balances
  }



}); //describe0
