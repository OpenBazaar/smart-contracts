var OBToken = artifacts.require("OBToken");
var PowerUps = artifacts.require("PowerUps");


module.exports = function(deployer) {
  deployer.deploy(PowerUps, OBToken.address);
};