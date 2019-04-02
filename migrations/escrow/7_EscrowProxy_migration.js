var Escrow_v1_0 = artifacts.require("Escrow_v1_0");
var EscrowProxy = artifacts.require("EscrowProxy");

module.exports = async(deployer) =>{
  await deployer.deploy(EscrowProxy, Escrow_v1_0.address);
  
};