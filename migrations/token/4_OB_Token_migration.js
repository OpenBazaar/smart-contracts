var OBToken = artifacts.require("OBToken");

module.exports = function(deployer) {
  deployer.deploy(OBToken, "Open Bazaar", "OBT", 18, 1000000000);
};