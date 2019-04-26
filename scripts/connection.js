const Web3 = require('web3');

var establishReadConn = () => {

    const web3 = new Web3("https://mainnet.infura.io/v3/6876b81fdbb44d06bd5cccdc1bc1a44d");
    return web3; 
}


var establishWriteConn = () => {
    const web3 = new Web3("http://localhost:8545");
    return web3;
}

var establishInfuraRinkebyConn = () => {
    const web3 = new Web3("https://rinkeby.infura.io/v3/bffcf5b90eb341dfbf9b547c5b528ead");
    return web3;
}

module.exports = {
    establishReadConn,
    establishWriteConn,
    establishInfuraRinkebyConn
};
