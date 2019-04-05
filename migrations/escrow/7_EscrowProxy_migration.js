var Escrow = artifacts.require("Escrow");
var EscrowProxy = artifacts.require("EscrowProxy");

module.exports = async(deployer) =>{
  await deployer.deploy(EscrowProxy, Escrow.address);
  
};