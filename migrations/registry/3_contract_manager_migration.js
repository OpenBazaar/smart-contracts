var ContractManager = artifacts.require("ContractManager");

module.exports = function(deployer) {
  deployer.deploy(ContractManager);
};