const secp256k1 = require('secp256k1');
const util = require("ethereumjs-util");
const Web3 = require('web3');
var leftPad = require('left-pad');
const yargs = require("yargs");
var lightwallet = require('eth-lightwallet')
var RIPEMD160 = require('ripemd160');

var argv = yargs.usage('Usage: $0 <command> [options]')
.command('generateHash', 'Generates hash for the data')
.command('generatePersonalMessageHash','Generates Ethereum personal hash out of message hash')
.command("signMessageUsingPrivateKey", "Signs using using private key provided")
.command("signMessageUsingLocalWeb3", "Signs Message using local web3")
.command("preimageHash", "Generate hash for preimage")
.command("splitPayments", "Get data for splitpayments")
.command("generateMUltiHash", "Generates multi hash for the data")
.command("generateRedeemScript", "Generates redeem script")
.command("getScriptHash", "Generates redeem script hash")
.command("getUniqueId", "Generates unique Id")
.command("getScriptHashFromData", "Generates Script Hash from Data")
.example('$0 generateHash -t 24 -m 0x546ba5c6abc490e66cb25a081868822c1ceb3abd -da 0x61adaf40a389761bacf76dfccf682e9200989894 -d 0x -v 10000000000', 'Generate hash for the data')
.alias('m', 'multisig')
.alias('t', "txId")
.alias('r', 'destination')
.alias('d', 'data')
.alias('v', 'value')
.alias('p', 'privateKey')
.alias('H', 'msgHash')
.alias('e','personalHash')
.alias('s','signer')
.alias('i', 'preimage')
.alias("b", "buyer")
.alias("S","seller")
.alias("p", "buyerPercentage")
.alias("P","sellerPercentage")
.alias("u", "uniqueId")
.alias("T", "threshold")
.alias("l", "timeoutHours")
.alias("M","moderator")
.alias("R", "redeemScript")
.alias("k", "scriptHash")
.option('destination', {
    type: 'array',
    desc: 'destination address'
  })
.option('value', {
    type: 'array',
    desc: 'Value to be sent to addresses'
  })
.number('t')
.describe('m', 'Address of multisig wallet')
.describe('t', "Transaction Id")
.describe('r', "Destination Address")
.describe('d','meta data')
.describe('v', 'Value of transaction in wei')
.describe('H',"Message Hash")
.describe("p", "Private Key to sign transaction")
.describe("e", "Personal Hash")
.describe('s','Address(moderator) used to sign transaction in case of web3')
.describe('i', 'Preimage whose keccak256 hash has to be calculated')
.describe("b","Buyer in the transaction")
.describe("S", "seller in the transaction")
.describe("p","Percentage of transaction value assigned to buyer in split payments")
.describe("u","Unique Id")
.describe("T", "Threshold")
.describe("l","Timeout hours")
.describe("M","Address of the moderator")
.describe("R", "Redeem Script")
.describe("k", "Script hash")
.help('h')
.alias('h', 'help')
.argv;

var command = argv._[0];

const generatePreimageHash = (preimage)=>{
    return "0x" + util.keccak256(preimage).toString("hex");
}

const createMsgHash = (multisigAddr, transactionId, destinationAddr, value, data)=>{
    let input = '0x19' + '00' + multisigAddr.slice(2) + destinationAddr[0].slice(2) + leftPad(Number(value[0]).toString('16'), '64', '0') + data.slice(2) + leftPad(transactionId.toString('16'), '64', '0')
    let hash = util.keccak256(input);
    return "0x" + hash.toString("hex");
}
const generateRedeemScript = (uniqueId, threshold, timeoutHours, buyer, seller, moderator)=>{
    let redeemScript = uniqueId + leftPad(threshold.toString(16), '2', '0') + leftPad(timeoutHours.toString(16), '8', '0') + buyer.slice(2) + seller.slice(2) + moderator.slice(2);
    return redeemScript.toString('hex');
}

const getScriptHashFromData = (uniqueId, threshold, timeoutHours, buyer, seller, moderator) => {
    var redeeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator);
    let hash = getScriptHashFromData(redeeemScript);
    
    return hash;
}

const getScriptHash = (redeemScript) => {
    let hash = util.keccak256(redeemScript);
    return "0x" + hash.toString('hex');
}

const createMultiMsgHash = (multisigAddr, scriptHash, destinationAddrs, values)=>{
    //console.log(destinationAddrs, values)
    var dest= ""; 
    var vals="" ;
    for(var i = 0;i<destinationAddrs.length;i++){
        dest += leftPad(destinationAddrs[i].slice(2),'64', '0');
        vals += leftPad(Number(values[i]).toString('16'), '64', '0');
    }
    console.log(destinationAddrs)
    let input = '0x19' + '00' + multisigAddr.slice(2) + dest + vals + scriptHash.slice(2);
    //console.log(input)
    let hash = util.keccak256(input);
    
    return "0x" + hash.toString("hex");
}

const createPersonalMessageHash = (msgHash) =>{
    let hash = util.hashPersonalMessage(util.toBuffer(msgHash));

    return hash.toString("hex");
}

const createPersonalMessageHashFromData = (multisigAddr, transactionId, destinationAddr, value, data)=>{
    return createPersonalMessageHash(createMsgHash(multisigAddr, transactionId, destinationAddr, value, data));
}
/**
 * ECDSA sign
 * @param  msgHash
 * @param  privateKey
 * @return {Object}
 */
 const signMessageHashUsingPrivateKey = (msgHash, privateKey)=>{
    let sig =  util.ecsign(new Buffer(util.stripHexPrefix(msgHash), 'hex'), new Buffer(privateKey, 'hex'));

      const sigV = sig.v;
      const sigR = '0x' + sig.r.toString('hex');
      const sigS = '0x' + sig.s.toString('hex');
      return {sigV: sigV, sigR: sigR, sigS: sigS}

}

const signMessageHashUsingPrivateKeyAndData = (multisigAddr, transactionId, destinationAddr, value, data, privateKey)=>{
    return signMessageHashUsingPrivateKey(createPersonalMessageHashFromData(multisigAddr, transactionId, destinationAddr, value, data), privateKey);
}

const signMessageHashUsingWeb3Provider = async (address, msgHash, web3providerString="http://localhost:8545")=>{
    const provider = new Web3.providers.HttpProvider(web3providerString);
    const web3 = new Web3(provider);
    let signature = await web3.eth.sign(msgHash.toString("hex"), address);
    
    var sig = util.fromRpcSig(signature.toString("hex"));
    const sigV = sig.v;
    const sigR = '0x' + sig.r.toString('hex');
    const sigS = '0x' + sig.s.toString('hex');
    console.log({sigV, sigR, sigS});
}

const signMessageHashUsingWeb3ProviderAndData = (multisigAddr, transactionId, destinationAddr, value, data, address, web3providerString="http://localhost:8545")=>{
   signMessageHashUsingWeb3Provider(address,createMsgHash(multisigAddr, transactionId, destinationAddr, value, data) , web3providerString);
}

const getSignHash = (msgHash, privateKey)=>{

    var msg = Buffer.from(msgHash.replace('0x',''), 'hex');
    //var msgHash = util.hashPersonalMessage(msg);
    var sgn = util.ecsign(msg, new Buffer(privateKey, "hex"));
    return util.toRpcSig(sgn.v, sgn.r, sgn.s);
}

const getUniqueId = () => {
    var ripemd160stream = new RIPEMD160();
    ripemd160stream.end(Math.floor((Math.random() * 100) + 1)+"");
    var id = "0x" + ripemd160stream.read().toString('hex');
    console.log(id);
    return id;
  }

const getSplitPaymentHexData = (party1Address, party2Address, party1Percentage, party2Percentage, _transactionId)=>{

    let data = lightwallet.txutils._encodeFunctionTxData('splitPayment', ['address[]', 'uint256[]', 'uint256'], [[party1Address, party2Address], [party1Percentage, party2Percentage], _transactionId]);
    return data;

  }

if(command === "generateHash"){
    if(argv.m === undefined || argv.t === undefined || argv.r === undefined || argv.v === undefined || argv.d === undefined){
        console.log("Parameter Missing");
        return;
    }
    else{
        var hash = createMsgHash(argv.m, argv.t, argv.r, argv.v, argv.data);
        console.log(hash);
    }
}else if(command === "generatePersonalMessageHash"){
    if(argv.H === undefined && (argv.m === undefined || argv.t === undefined || argv.r === undefined || argv.v === undefined || argv.d === undefined)){
        console.log("Parameter(s) Missing");
        return;
    }
    else if(argv.H) {
        var hash = createPersonalMessageHash(argv.H);
        console.log(hash);
    }
    else{
      var hash = createPersonalMessageHashFromData(argv.m, argv.t, argv.r, argv.v, argv.data);
      console.log(hash);
    }
}else if(command === "signMessageUsingPrivateKey"){
    if(argv.p === undefined || ((argv.e === undefined) && (argv.m === undefined || argv.t === undefined || argv.r === undefined || argv.v === undefined || argv.d === undefined))){
        console.log("Parameter(s) Missing");
        return;
    }else if(argv.e){
        console.log(signMessageHashUsingPrivateKey(argv.e, argv.p))
    }else{
        console.log(signMessageHashUsingPrivateKeyAndData(argv.m, argv.t, argv.r, argv.v, argv.data, argv.p));
    }
}else if(command === "signMessageUsingLocalWeb3"){
    if(argv.s === undefined || (argv.H === undefined && (argv.m === undefined || argv.t === undefined || argv.r === undefined || argv.v === undefined || argv.d === undefined))){
        console.log("Parameter(s) Missing");
        return;
    }else if(argv.H === undefined){
        signMessageHashUsingWeb3ProviderAndData(argv.m, argv.t, argv.r, argv.v, argv.data, argv.s);
    }
    else{
        signMessageHashUsingWeb3Provider(argv.s, argv.H);
    }
}else if(command === "preimageHash"){
    if(argv.i === undefined){
        console.log("Parameter(s) Missing");
        return;
    }
    else{
        console.log(generatePreimageHash(argv.i));
    }
}else if(command === "splitPayments"){
    if(argv.b === undefined || argv.S === undefined || argv.p === undefined || argv.P === undefined || argv.t === undefined){
        console.log("Parameter(s) Missing");
    }
    else{
        console.log(getSplitPaymentHexData(argv.b, argv.S, argv.p, argv.P, argv.t));
    }
}else if(command === "generateMultiHash"){
    if(argv.m === undefined || argv.r === undefined || argv.v === undefined || argv.k === undefined){
        console.log("Parameter Missing");
        return;
    }
    
    else{
        var hash = createMultiMsgHash(argv.m, argv.k, argv.r, argv.v);
        console.log(hash);
    }
}else if(command === "generateRedeemScript"){
    if(argv.u === undefined || argv.T === undefined || argv.l === undefined || argv.b === undefined || argv.S === undefined || argv.M === undefined){
        console.log("Parammeter(s) Missing");
    }
    else{
        console.log(generateRedeemScript(argv.u, argv.T, argv.l, argv.b, argv.S, argv.M));    
    }        
}
else if(command === "getScriptHashFromData"){
    if(argv.u === undefined || argv.T === undefined || argv.l === undefined || argv.b === undefined || argv.S === undefined || argv.M === undefined){
        console.log("Parammeter(s) Missing");
    }
    else{
        console.log(getScriptHashFromData(argv.u, argv.T, argv.l, argv.b, argv.S, argv.M));    
    }
}
else if(command === "getScriptHash"){
    if(argv.R === undefined){
        console.log("Parameter(s) Missing");
    }else{
    console.log(getScriptHash(argv.R));
    }
}

else if(command === "getUniqueId"){
    var uniqueId = getUniqueId();
    console.log(uniqueId);
}

else{
    console.log('Command not recognized');
}




//var msgHash = createMsgHash("0x546ba5c6abc490e66cb25a081868822c1ceb3abd", 24, "0x61adaf40a389761bacf76dfccf682e9200989894", 1000000000000000000, "0x");
//console.log(msgHash);

//var personalMsgHash = createPersonalMessageHash(msgHash);
//console.log(personalMsgHash);

//var signs = signMessageHashUsingPrivateKey(personalMsgHash, "8954f0143159b26885799d99fe462498536f22ecd967aba64b677497bcd8eccb");

//console.log(signs);

//signs = signMessageHashUsingWeb3Provider("0x4cb8543eaa17f648b79509e6c95caee0cee1cc49", msgHash, "http://localhost:8545" );
