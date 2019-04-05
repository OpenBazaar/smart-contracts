module.exports = {
    norpc: true,
    copyPackages:["openzeppelin-solidity"],
    port: 8555,
    testCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle test --network coverage',
    compileCommand: 'node --max-old-space-size=4096 ../node_modules/.bin/truffle compile --network coverage',
    skipFiles : ["escrow/EscrowProxy.sol", "test/TestToken.sol", "token/ITokenContract.sol"]
};