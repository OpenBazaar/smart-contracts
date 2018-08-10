var Escrow_v1_0 = artifacts.require("Escrow_v1_0");

module.exports = async(deployer) =>{
  await deployer.deploy(Escrow_v1_0);
  
};