var OBRewards = artifacts.require("OBRewards");
var Escrow_v1_0 = artifacts.require("Escrow_v1_0");
var OBToken = artifacts.require("OBToken");

module.exports = function(deployer) {
  //This is dummy data
  deployer.deploy(OBRewards, "50000000000000000000", 432000, Escrow_v1_0.address, OBToken.address);
};