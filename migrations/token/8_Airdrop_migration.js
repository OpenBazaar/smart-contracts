var Airdrop = artifacts.require("Airdrop");
var OBToken = artifacts.require("OBToken");

module.exports = function(deployer) {
  deployer.deploy(Airdrop, OBToken.address);
};