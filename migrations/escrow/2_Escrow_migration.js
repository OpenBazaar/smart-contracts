var Escrow = artifacts.require("Escrow");

module.exports = async(deployer) =>{
  await deployer.deploy(Escrow);
  
};