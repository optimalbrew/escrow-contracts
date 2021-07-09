# Escrow Contracts

**Note:** this is not the `master` branch (which is unchanged from the forked repo). This branch, `hhmig`, is a simple migration of the dev and test setup from buidler to hardhat.

## Architecture

Focus attention on 2 contracts
1. `contracts/0.7.x/MultipleArbitrableTokenTransactionWithAppeals.sol`
    * This will serve as the **main escrow**
    * this uses the core `@kleros/ERC-792` interfaces: 
        * 2 direct and one indirect: `IAbitrable` (and therefore, `IArbitrator` ) and `IEvidence`
    * but other than that, there is no dependence on other repos or contracts
    * the other contract (without tokens) does not use ERC20. So, focus on this one, at least initially.
2. `contracts/0.4.x/TestArbitrator.sol`
    * this is to **test the escrow**
    * this has a **chain of dependence** on old Solidity 4 contracts at  `@kleros/kleros-interaction/contracts/standard/arbitration/EnhancedAppealableArbitrator.sol` (which have *all been copied* into the same directory)
    
     
    ```
                                                             <- Arbitrable <-IArbitrable0.4 
    EnhancedAppealableArbitrator <- AppealableArbitrator <-|
                                                             <- CentralizedArbitrator <- Arbitrator <- Arbitrable <-IArbitrable0.4                 
    ```
    * So this uses only 1 (old version4) `Arbitrable` interface, instead of the more recent set of 3 ERC-792 ones used for the escrow.
    * so this should be updated to the same pattern of 3 (or perhaps 2: `IArbitrator` and `IEvidence`), **not** `Arbitrable0.4`.

## Usage

Install node (14+). Then npm install and 


There is no front end code. The tests are reasonably well documented, so contract interactions are simple to follow. Only the tests relevant for the token transactions are migrated.

run

```
npx hardhat test //all tests

```
or

```
npx hardhat test test/tokenTest.js // main interactions
npx hardhat test test/tokenGasCostTest.js // for gas cost related tests
```

or deploy to local hardhat network which is not as useful as the tests (without a UI for interaction)

```
npx hardhat run scripts/deployAll.js
```

### Note on mods to old tests

Move old tests (buidler) to a new directory (`oldtest`). Then modify the two tests relevant for token transactions to work with Hardhat. These are in the usual `test` directory.

The main changes are with respect to **reading artifacts** and **block timestamps**. Both can be fixed by using hardhat runtime environment i.e. `hre` methods.

Some tests rely on `increaseTime()` helper to advance the next block's time stamp. Replace these with the following to advance next block's timestamp

```
await hre.network.provider.send("evm_increaseTime", [100]); //to inc timestamp by 100 sec
```
as in *ganache*, this is approximate. Hardhat has a method for exact time stamp, called `evm_setNextBlockTimestamp`. 

Increasing the blocktime in multiple tests widens the gap between system time (current time).

The old tests rely on OpenZep time helper for current block timestamps. A new helper was added directly to the tests using `hre.ethers.provider` methods instead.