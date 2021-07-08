# Escrow Contracts

Migrating to hardhat, so remove previous readme, which was mostly just a few yarn statements.

Focus attention on 2 contracts
1. `contracts/0.7.x/MultipleArbitrableTokenTransactionWithAppeals.sol`
    * This will serve as the **main escrow**
    * this uses the core `@kleros/ERC-792` interfaces: 
        * 2 direct and one indirect: `IAbitrable` (and therefore, `IArbitrator` ) and `IEvidence`
    * but other than that, there is no dependence on other repos or contracts
    * the other contract (without tokens) does not use ERC20. So, focus on this one, at least initially.
2. `contracts/0.4.x/TestArbitrator.sol`
    * this is to **test the escrow**
    * this has a **chain of dependence** on old Solidity 4 contracts at  `@kleros/kleros-interaction/contracts/standard/arbitration/EnhancedAppealableArbitrator.sol` (which have been copied into the same directory)
    
     
    ```
                                                             <- Arbitrable <-IArbitrable0.4 
    EnhancedAppealableArbitrator <- AppealableArbitrator <-|
                                                             <- CentralizedArbitrator <- Arbitrator <- Arbitrable <-IArbitrable0.4                 
    ```
    * So this uses only 1 (old version4) `Arbitrable` interface, instead of the more recent set of 3 ERC-792 ones used for the escrow.
    * so this should be updated to the same pattern of 3 (or perhaps 2: `IArbitrator` and `IEvidence`), **not** `Arbitrable0.4`.

## Initial testing
Move old tests (buidler) to a new directory. And gradually bring them in pars using the Hardhat pattern.

Some changes are needed for the tests. Not logical ones of course. Thus far, the main changes are with respect to **time**, as in **block timestamps**.

Some tests rely on using `latest` helper for latest block timestamp. These fail when workign with the `hre`. This can be fixed by just using the current timestamp `Date.now()`. Or use hardhat's RPC

Some tests rely on `increaseTime()` helper to advance the next block's time stamp. Replace these with the following to advance next block's timestamp (e.g. by 100 seconds)

```
await hre.network.provider.send("evm_increaseTime", [100]);

```
as in *ganache*, this is approximate. Hardhat has a method for exact time stamp, called `evm_setNextBlockTimestamp`. 