
async function main() {
    // this follows the same pattern (and parameters) used in `tokenTest.js`
    /** deploy the arbitrator first, followed by the token, then use those to deploy the main escrow contract*/
    
    // params
    const arbitrationFee = 20
    const arbitratorExtraData = '0x85'
    const appealTimeout = 100
    const feeTimeout = 100
    //const timeoutPayment = 100
    const amount = 1000
    const sharedMultiplier = 5000
    const winnerMultiplier = 2000
    const loserMultiplier = 8000
    //const metaEvidenceUri = 'https://kleros.io'
  
    let arbitrator
    let _governor
    let sender
    let receiver
    let other
    //let crowdfunder1
    //let crowdfunder2
  
    let senderAddress
    let receiverAddress
  
    let contract
    //let MULTIPLIER_DIVISOR
    //let currentTime
    let token
  

    [   _governor, // will deploy the contracts
        sender,
        receiver,
        other,
        //crowdfunder1,
        //crowdfunder2,
    ] = await ethers.getSigners()
    senderAddress = await sender.getAddress()
    receiverAddress = await receiver.getAddress()

    const arbitratorArtifact = await hre.artifacts.readArtifact(
    './contracts/0.4.x/EnhancedAppealableArbitrator.sol:EnhancedAppealableArbitrator'
    )
    const Arbitrator = await ethers.getContractFactory(
    arbitratorArtifact.abi,
    arbitratorArtifact.bytecode,
    _governor //signer
    )

    console.log(
        "\nDeploying Arbitrator contract with the account:",
        await _governor.getAddress()
      );
      
      console.log("Governing account balance:", (await _governor.getBalance()).toString());
  

    arbitrator = await Arbitrator.deploy(
    String(arbitrationFee),
    ethers.constants.AddressZero,
    arbitratorExtraData,
    appealTimeout
    )
    await arbitrator.deployed()
    console.log("Arbitrator contract deployed at ", arbitrator.address);
    // Make appeals go to the same arbitrator
    await arbitrator.changeArbitrator(arbitrator.address)

    const tokenArtifact = await hre.artifacts.readArtifact('./contracts/0.4.x/ERC20Mock.sol:ERC20Mock')
    const ERC20Token = await ethers.getContractFactory(
    tokenArtifact.abi,
    tokenArtifact.bytecode
    )
    
    console.log(
        "\nDeploying ERC20 token contract with the account:",
        await _governor.getAddress()
      );
      
    console.log("Governing account balance:", (await _governor.getBalance()).toString());  
    
    token = await ERC20Token.deploy(senderAddress, amount * 10) // (initial account, initial balance)
    await token.deployed();
    console.log("ERC20 token contract deployed at ", token.address);

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

    console.log(
      "\nDeploying escrow contract with the account:",
      await _governor.getAddress()
    );
    
    console.log("Governing account final balance:", (await _governor.getBalance()).toString());
  
    await contract.deployed()
    console.log("Contract address:", contract.address);
}  
    
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });