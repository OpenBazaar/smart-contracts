var RIPEMD160 = require('ripemd160');
var leftPad = require('left-pad');
var util = require("ethereumjs-util");
var lightwallet = require('eth-lightwallet')

let keyFromPw
let acct
let lw

const getUniqueId = () => {
    var ripemd160stream = new RIPEMD160();
    var randomString = Math.floor((Math.random() * 100) + 1) + "" + Date.now();
    ripemd160stream.end(randomString);
    var id = ripemd160stream.read().toString('hex');
    return "0x" + id;
}

const generateRedeemScript = (uniqueId, threshold, timeoutHours, buyer, seller, moderator,multisigAddr, tokenAddress)=>{
    let redeemScript = uniqueId + leftPad(threshold.toString(16), '2', '0') + leftPad(timeoutHours.toString(16), '8', '0') + buyer.slice(2) + seller.slice(2) + moderator.slice(2) + multisigAddr.slice(2) ;
   
    if(tokenAddress!=undefined){
        redeemScript = redeemScript + tokenAddress.slice(2);
    }

    return redeemScript.toString('hex');
}

const getScriptHash = (redeemScript) => {
    let hash = util.keccak256(redeemScript);
    return "0x" + hash.toString('hex');
}


const createSigs = (signers, multisigAddr, destinationAddr, value, scriptHash) =>{

    var dest= ""; 
    var vals="" ;
    for(var i = 0;i<destinationAddr.length;i++){
        dest += leftPad(destinationAddr[i].slice(2),'64', '0');
        vals += leftPad(Number(value[i]).toString('16'), '64', '0');
    }
    
    let input = '0x19' + '00' + multisigAddr.slice(2) + dest + vals + scriptHash.slice(2);

    let hash1 = util.keccak256(input);
    let hash = util.hashPersonalMessage(util.toBuffer("0x" + hash1.toString("hex")));
    let sigV = []
    let sigR = []
    let sigS = []

    for (var i=0; i<signers.length; i++) {
      let sig = lightwallet.signing.signMsgHash(lw, keyFromPw, hash, signers[i])
    
      sigV.push(sig.v)
      sigR.push('0x' + sig.r.toString('hex'))
      sigS.push('0x' + sig.s.toString('hex'))
    }
    return {sigV: sigV, sigR: sigR, sigS: sigS}

}

const signMessageHash = (hash, signers) => {
  let sigV = []
  let sigR = []
  let sigS = []

  for (var i=0; i<signers.length; i++) {
    let sig = lightwallet.signing.signMsgHash(lw, keyFromPw, hash, signers[i])
  
    sigV.push(sig.v)
    sigR.push('0x' + sig.r.toString('hex'))
    sigS.push('0x' + sig.s.toString('hex'))
  }
  return {sigV: sigV, sigR: sigR, sigS: sigS}
}

const resetTime = async()=>{
    await web3.currentProvider.send({
        jsonrpc: '2.0', 
        method: 'evm_mine', 
        params: [Math.floor(new Date().getTime()/1000)], 
        id: new Date().getTime()
      }, function(err, result){
    });
}
  const increaseTime = async (seconds) => {
    
    await web3.currentProvider.send({
        jsonrpc: '2.0', 
        method: 'evm_increaseTime', 
        params: [seconds], 
        id: new Date().getTime()
      }, (err, resp) => {
          
      });
      
      await web3.currentProvider.send({
        jsonrpc: '2.0', 
        method: 'evm_mine', 
        params: [], 
        id: new Date().getTime()
      }, function(err, result){
    });
  }

  const setupWallet = ()=>{
    
    let seed = "dog permit example repeat gloom defy teach pumpkin library remain scorpion skull";
    return new Promise((resolve, reject)=>{
    lightwallet.keystore.createVault(
        {
            hdPathString: "m/44'/60'/0'/0",
            seedPhrase: seed,
            password: "test",
            salt: "testsalt"
        },
        function (err, keystore) {
            if(err){
                reject(err);
            }
            lw = keystore;
            lw.keyFromPassword("test", async(e,k)=> {
                keyFromPw = k

                lw.generateNewAddress(keyFromPw, 100)
                let acctWithout0x = lw.getAddresses()
                acct = acctWithout0x.map((a) => {return a})
                acct.sort();
                resolve(acct);              
                
            })
        });
    });

  };

  const keccak256 = (data)=>{
        let hash =  util.keccak256(data);
        return "0x" + hash.toString('hex');
  };


module.exports = {
    getUniqueId,
    generateRedeemScript,
    getScriptHash,
    createSigs,
    increaseTime,
    setupWallet,
    keccak256,
    signMessageHash
};