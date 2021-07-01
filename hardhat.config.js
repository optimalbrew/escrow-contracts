
require("@nomiclabs/hardhat-waffle")

module.exports = {
  // This is a sample solc configuration that specifies which version of solc to use
  solidity: {
    compilers:[
      {
        version: '0.4.24',
        settings:{
          optimizer: {
          enabled: true,
          runs: 200
          }
        }
      },
      {
        version: '0.7.6',
        settings:{
          optimizer: {
          enabled: true,
          runs: 200
          }
        }
      }
    ]
    },
    networks: {
      hardhat: {
        blockGasLimit: 12000000
      }
    }

};
