var OBRewards = artifacts.require("OBRewards");
var Escrow = artifacts.require("Escrow");
var OBToken = artifacts.require("OBToken");

module.exports = function(deployer) {
  //This is dummy data
  deployer.deploy(
    OBRewards,
    "50000000000000000000",
    432000,
    Escrow.address,
    OBToken.address
  );
};
