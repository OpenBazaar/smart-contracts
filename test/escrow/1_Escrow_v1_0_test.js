var Escrow_v1_0 = artifacts.require("Escrow_v1_0");
var TestToken = artifacts.require("TestToken");

var Web3 = require("web3");
var lightwallet = require('eth-lightwallet')
var leftPad = require('left-pad');
var util = require("ethereumjs-util");
var web3 = new Web3("http://localhost:8555");
var RIPEMD160 = require('ripemd160');
var BigNumber = require('bignumber.js');

contract("Escrow Contract Version 1- Supports Token transfer", function() {

  let keyFromPw
  let acct
  let lw
  var repeatedScriptHash;

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
  
  before((done) => {
    
    let seed = "dog permit example repeat gloom defy teach pumpkin library remain scorpion skull"

    lightwallet.keystore.createVault(
        {
            hdPathString: "m/44'/60'/0'/0",
            seedPhrase: seed,
            password: "test",
            salt: "testsalt"
        },
        function (err, keystore) {

            lw = keystore
            lw.keyFromPassword("test", async(e,k)=> {
                keyFromPw = k

                lw.generateNewAddress(keyFromPw, 10)
                let acctWithout0x = lw.getAddresses()
                acct = acctWithout0x.map((a) => {return a})
                acct.sort()
                
                this.escrow = await Escrow_v1_0.new({from:acct[0]});
                this.token = await TestToken.new(1000000000000000, "Open Bazaar", "OB", {from:acct[0]});
            

                done();
            })
        })
    
    });
    it("Add new transaction", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");

        repeatedScriptHash = scriptHash;

        var buyerBalanceBefore = await web3.eth.getBalance(buyer);
        var escrowContractBalanceBefore = await web3.eth.getBalance(this.escrow.address);

        buyerBalanceBefore = new BigNumber(buyerBalanceBefore);
        escrowContractBalanceBefore = new  BigNumber(escrowContractBalanceBefore);

        var txResult = await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});

        var buyerBalanceAfter = await web3.eth.getBalance(buyer);
        var escrowContractBalanceAfter = await web3.eth.getBalance(this.escrow.address);

        escrowContractBalanceAfter = new BigNumber(escrowContractBalanceAfter);
        buyerBalanceAfter = new BigNumber(buyerBalanceAfter);
        
        var eventName = txResult.logs[0].event;
        var from = txResult.logs[0].args.from;
        var receivedScriptHash = txResult.logs[0].args.scriptHash;
        var amountEscrowed = txResult.logs[0].args.value;

        assert.equal(eventName, "Funded", "Funded event should be fired");
        assert.equal(from, buyer, "Transaction was sent from buyer's address: "+ buyer);
        assert.equal(receivedScriptHash, scriptHash, "Received script hash does not matches the script hash sent");
        assert.equal(amountEscrowed.toNumber(), Number(amount), "Escrowed amount does not matches with the actual amount sent");

        assert.isAtLeast(buyerBalanceBefore.minus(Number(amount)).toNumber(), buyerBalanceAfter.toNumber(), "Buyer's ether balance must reduce by escrowed amount: "+amount);
        assert.equal(escrowContractBalanceBefore.plus(Number(amount)).toNumber(), escrowContractBalanceAfter.toNumber(), "Escrow contract's ether balance must increase by escrowed amount: "+amount);

        //check whether the transaction stored in state is same as sent
        var transaction = await this.escrow.transactions(scriptHash);

        receivedScriptHash = transaction[0];
        var receivedBuyer = transaction[1];
        var receivedSeller = transaction[2];
        var receivedAmount = transaction[3];
        var receivedStatus = transaction[4];
        var receivedTimeoutHours = transaction[7];
        var receivedThreshold = transaction[8];
        var receivedTransactionType = transaction[9];

        assert.equal(receivedScriptHash, scriptHash, "Received script hash does not matches the script hash sent");
        assert.equal(receivedBuyer, buyer, "Received buyer hash does not matches the buyer sent");
        assert.equal(receivedSeller, seller, "Received seller hash does not matches the seller sent");
        assert.equal(receivedAmount.toNumber(), Number(amount), "Received amount does not matches the amount sent");
        assert.equal(receivedStatus, 0, "Received status is not FUNDED(0)");
        assert.equal(receivedTimeoutHours, timeoutHours, "Received timeout hours does not matches the timeout hours sent");
        assert.equal(receivedThreshold, threshold, "Received threshold does not matches the threshold sent");
        assert.equal(receivedTransactionType, 0, "Received transaction type is not ETHER(0)");
    });

    it("Add funds to ETHER transaction", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");

        var txResult = await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});
       
        var buyerBalanceBefore = await web3.eth.getBalance(buyer);
        var escrowContractBalanceBefore = await web3.eth.getBalance(this.escrow.address);

        buyerBalanceBefore = new BigNumber(buyerBalanceBefore);
        escrowContractBalanceBefore = new  BigNumber(escrowContractBalanceBefore);

        txResult = await this.escrow.addFundsToTransaction(scriptHash, {from:buyer, value:amount});

        var buyerBalanceAfter = await web3.eth.getBalance(buyer);
        var escrowContractBalanceAfter = await web3.eth.getBalance(this.escrow.address);

        escrowContractBalanceAfter = new BigNumber(escrowContractBalanceAfter);
        buyerBalanceAfter = new BigNumber(buyerBalanceAfter);
        
        var eventName = txResult.logs[0].event;
        var from = txResult.logs[0].args.from;
        var receivedScriptHash = txResult.logs[0].args.scriptHash;
        var amountEscrowed = txResult.logs[0].args.valueAdded;

        assert.equal(eventName, "FundAdded", "FundAdded event should be fired");
        assert.equal(from, buyer, "Transaction was sent from buyer's address: "+ buyer);
        assert.equal(receivedScriptHash, scriptHash, "Received script hash does not matches the script hash sent");
        assert.equal(amountEscrowed.toNumber(), Number(amount), "Escrowed amount does not matches with the actual amount sent");

        assert.isAtLeast(buyerBalanceBefore.minus(Number(amount)).toNumber(), buyerBalanceAfter.toNumber(), "Buyer's ether balance must reduce by escrowed amount: "+amount);
        assert.equal(escrowContractBalanceBefore.plus(Number(amount)).toNumber(), escrowContractBalanceAfter.toNumber(), "Escrow contract's ether balance must increase by escrowed amount: "+amount);

        //check whether the transaction stored in state is same as sent
        var transaction = await this.escrow.transactions(scriptHash);
       
        var receivedAmount = transaction[3];
       
        assert.equal(receivedAmount.toNumber(), Number(amount) +Number(amount), "Received amount does not matches the amount sent");
       
    });

    it("Add funds to ETHER transaction", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");        

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});
       
        try{
            await this.escrow.addFundsToTransaction(scriptHash, {from:acct[9], value:amount});
            assert.equal(true, false, "Should not be able to add funds to transaction from account other than buyer's");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }

        
       
    });

    it("Add new transaction with same buyer and seller", async()=>{
        var buyer = acct[0];
        var seller = acct[0];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");

       try{
            await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});
            assert.equal(true, false, "Should not be able to add transaction with same buyer and seller");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
       
    });

    it("Add new transaction with 0 value", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("0", "ether");

       try{
            await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});
            assert.equal(true, false, "Should not be able to add transaction with 0 value");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
       
    });

    it("Add new transaction with threshold greater number of parties involved", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 4;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");

       try{
            await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});
            assert.equal(true, false, "Should not be able to add transaction with threshold greater number of parties involved");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
       
    });

    it("Add new transaction with threshold 0", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 0;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");

       try{
            await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});
            assert.equal(true, false, "Should not be able to add transaction with threshold 0");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
       
    });

    it("Add new transaction with moderator being one of buyer or seller", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = buyer;
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");

       try{
            await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});
            assert.equal(true, false, "Should not be able to add transaction with moderator being one of buyer or seller");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
       
    });

    it("Add new transaction with buyer being zero address", async()=>{
        var buyer = "0x";
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");

       try{
            await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});
            assert.equal(true, false, "Should not be able to add transaction with buyer being zero address");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
       
    });

    it("Add new transaction with seller being zero address", async()=>{
        var buyer = acct[0];
        var seller = "0x";
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");

       try{
            await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});
            assert.equal(true, false, "Should not be able to add transaction with buyer being zero address");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
       
    });

    it("Add new transaction with moderator being zero address", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = "0x";
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");

       try{
            await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:amount});
            assert.equal(true, false, "Should not be able to add transaction with buyer being zero address");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
       
    });

    it("Add new transaction with previously added script hash", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;        
        var amount = web3.utils.toWei("1", "ether");        
        
        try{
            await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, repeatedScriptHash, {from:acct[0], value:amount});
            assert.equal(true, false, "Should not be able to add transaction with script hash which has previously been added");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
       
    });

    it("Execute Ether Transaction", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("0.9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sellerBalanceBefore = await web3.eth.getBalance(seller);
        var escrowContractBalanceBefore = await web3.eth.getBalance(this.escrow.address);
        var moderatorBalanceBefore = await web3.eth.getBalance(moderator);

        escrowContractBalanceBefore = new BigNumber(escrowContractBalanceBefore);
        sellerBalanceBefore = new BigNumber(sellerBalanceBefore);
        moderatorBalanceBefore = new BigNumber(moderatorBalanceBefore);

        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);

        var txResult = await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);

        var eventName = txResult.logs[0].event;
        var receivedScriptHash = txResult.logs[0].args.scriptHash;

        assert.equal(eventName, "Executed", "Executed event must be fired");
        assert.equal(receivedScriptHash, scriptHash, "Received script hash does not matches the script hash of the transaction executed");

        var sellerBalanceAfter = await web3.eth.getBalance(seller);
        var escrowContractBalanceAfter = await web3.eth.getBalance(this.escrow.address);
        var moderatorBalanceAfter = await web3.eth.getBalance(moderator);

        escrowContractBalanceAfter = new BigNumber(escrowContractBalanceAfter);
        sellerBalanceAfter = new BigNumber(sellerBalanceAfter);
        moderatorBalanceAfter = new BigNumber(moderatorBalanceAfter);

        assert.equal(sellerBalanceBefore.plus(Number(amountToBeGivenToSeller)).toNumber(), sellerBalanceAfter.toNumber(), "Seller's ether balance must increase by : "+amountToBeGivenToSeller);
        assert.equal(moderatorBalanceBefore.plus(Number(amountToBeGivenToModerator)).toNumber(), moderatorBalanceAfter.toNumber(), "Moderator's ether balance must increase by : "+amountToBeGivenToModerator);
        assert.equal(escrowContractBalanceBefore.minus(Number(amountToBeGivenToSeller) + Number(amountToBeGivenToModerator)).toNumber(), escrowContractBalanceAfter.toNumber(), "Escrow contract's ether balance must reduce by escrowed amount");

    });

    it("Execute Ether Transaction with scripthash that does not exists in the contract", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("0.9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");

        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);
        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute transaction with scripthash that does not exists in the contract");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    });

    it("Execute already executed Transaction", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("0.9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);

        await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
 
        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute already executed transaction");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    });

    it("Execute Transaction with wrong unique id", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("0.9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);
        uniqueId = getUniqueId();

        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute transaction with wrong unique id");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    });

    it("Execute Transaction with invalid signature", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("0.9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [seller, moderator], [web3.utils.toWei("0.8", "ether"), amountToBeGivenToModerator], scriptHash);
        uniqueId = getUniqueId();

        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute transaction with invalid signature");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    }); 

    it("Execute Transaction with less number of signatures than required", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("0.9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sig = createSigs([buyer, seller], this.escrow.address, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);

        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute transaction with less number of signatures than required");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    });

    it("Execute Transaction with one of the signature's being of non-owner", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("0.9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sig = createSigs([buyer, seller, acct[4]], this.escrow.address, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);

        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute transaction with less number of signatures than required");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    });

    it("Execute Transaction with one of the destination being non-owner address", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("0.9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [acct[4], moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);

        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute transaction with one of the destination being non-owner address");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    });

    it("Execute Transaction with total value being sent greater than overall transaction value", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);

        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute transaction with total value being sent greater than overall transaction value");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    });

    it("Execute Transaction with one of the sent amount being 0", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("1", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);

        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute transaction with one of the sent amount being 0");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    });

    it("Execute Transaction with no destination", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("1", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);

        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute transaction with no destination");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    });

    it("Execute Transaction with number of destinations and amount in mismatch", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("1", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0", "ether");

        await this.escrow.addTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, {from:acct[0], value:web3.utils.toWei("1", "ether")});

        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [seller], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);

        try{
            await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
            assert.equal(true, false, "Should not be able to execute transaction with no destination");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
    });

    it("Add new Token transaction", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var amount = web3.utils.toWei("100", "ether");
        var txResult = await this.token.approve(this.escrow.address, amount, {from:buyer});

        var buyerBalanceBefore = await this.token.balanceOf(buyer);
        var escrowContractBalanceBefore = await this.token.balanceOf(this.escrow.address);

        buyerBalanceBefore = new BigNumber(buyerBalanceBefore.toNumber());
        escrowContractBalanceBefore = new BigNumber(escrowContractBalanceBefore.toNumber());

        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address, this.token.address);
        var scriptHash = getScriptHash(redeemScript);
        
        txResult = await this.escrow.addTokenTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, amount, this.token.address, {from:acct[0]});

        var buyerBalanceAfter = await this.token.balanceOf(buyer);
        var escrowContractBalanceAfter = await this.token.balanceOf(this.escrow.address);

        escrowContractBalanceAfter = new BigNumber(escrowContractBalanceAfter.toNumber());
        buyerBalanceAfter = new BigNumber(buyerBalanceAfter.toNumber());
        
        var eventName = txResult.logs[0].event;
        var from = txResult.logs[0].args.from;
        var receivedScriptHash = txResult.logs[0].args.scriptHash;
        var amountEscrowed = txResult.logs[0].args.value;

        assert.equal(eventName, "Funded", "Funded event should be fired");
        assert.equal(from, buyer, "Transaction was sent from buyer's address: "+ buyer);
        assert.equal(receivedScriptHash, scriptHash, "Received script hash does not matches the script hash sent");
        assert.equal(amountEscrowed.toNumber(), Number(amount), "Escrowed amount does not matches with the actual amount sent");

        assert.equal(buyerBalanceBefore.minus(Number(amount)).toNumber(), buyerBalanceAfter.toNumber(), "Buyer's token balance must reduce by escrowed amount: "+amount);
        assert.equal(escrowContractBalanceBefore.plus(Number(amount)).toNumber(), escrowContractBalanceAfter.toNumber(), "Escrow contract's token balance must increase by escrowed amount: "+amount);

        //check whether the transaction stored in state is same as sent
        var transaction = await this.escrow.transactions(scriptHash);

        receivedScriptHash = transaction[0];
        var receivedBuyer = transaction[1];
        var receivedSeller = transaction[2];
        var receivedAmount = transaction[3];
        var receivedStatus = transaction[4];
        var receivedTimeoutHours = transaction[7];
        var receivedThreshold = transaction[8];
        var receivedTransactionType = transaction[9];
        var receivedTokenAddress = transaction[10];

        assert.equal(receivedScriptHash, scriptHash, "Received script hash does not matches the script hash sent");
        assert.equal(receivedBuyer, buyer, "Received buyer hash does not matches the buyer sent");
        assert.equal(receivedSeller, seller, "Received seller hash does not matches the seller sent");
        assert.equal(receivedAmount.toNumber(), Number(amount), "Received amount does not matches the amount sent");
        assert.equal(receivedStatus, 0, "Received status is not FUNDED(0)");
        assert.equal(receivedTimeoutHours, timeoutHours, "Received timeout hours does not matches the timeout hours sent");
        assert.equal(receivedThreshold, threshold, "Received threshold does not matches the threshold sent");
        assert.equal(receivedTransactionType, 1, "Received transaction type is not TOKEN(1)");
        assert.equal(receivedTokenAddress, this.token.address, "Received token address does not matches the token address sent");

        
    });

    it("Add funds to Token transaction", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var amount = web3.utils.toWei("100", "ether");
        var txResult = await this.token.approve(this.escrow.address, amount, {from:buyer});

       

        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address, this.token.address);
        var scriptHash = getScriptHash(redeemScript);
        
        txResult = await this.escrow.addTokenTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, amount, this.token.address, {from:acct[0]});

        var buyerBalanceBefore = await this.token.balanceOf(buyer);
        var escrowContractBalanceBefore = await this.token.balanceOf(this.escrow.address);

        buyerBalanceBefore = new BigNumber(buyerBalanceBefore.toNumber());
        escrowContractBalanceBefore = new BigNumber(escrowContractBalanceBefore.toNumber());

        var txResult = await this.token.approve(this.escrow.address, amount, {from:buyer});
        txResult = await this.escrow.addTokensToTransaction(scriptHash, amount,{from:buyer});

        var buyerBalanceAfter = await this.token.balanceOf(buyer);
        var escrowContractBalanceAfter = await this.token.balanceOf(this.escrow.address);

        escrowContractBalanceAfter = new BigNumber(escrowContractBalanceAfter.toNumber());
        buyerBalanceAfter = new BigNumber(buyerBalanceAfter.toNumber());
        
        var eventName = txResult.logs[0].event;
        var from = txResult.logs[0].args.from;
        var receivedScriptHash = txResult.logs[0].args.scriptHash;
        var amountEscrowed = txResult.logs[0].args.valueAdded;

        assert.equal(eventName, "FundAdded", "Funded event should be fired");
        assert.equal(from, buyer, "Transaction was sent from buyer's address: "+ buyer);
        assert.equal(receivedScriptHash, scriptHash, "Received script hash does not matches the script hash sent");
        assert.equal(amountEscrowed.toNumber(), Number(amount), "Escrowed amount does not matches with the actual amount sent");

        assert.equal(buyerBalanceBefore.minus(Number(amount)).toNumber(), buyerBalanceAfter.toNumber(), "Buyer's token balance must reduce by escrowed amount: "+amount);
        assert.equal(escrowContractBalanceBefore.plus(Number(amount)).toNumber(), escrowContractBalanceAfter.toNumber(), "Escrow contract's token balance must increase by escrowed amount: "+amount);

        //check whether the transaction stored in state is same as sent
        var transaction = await this.escrow.transactions(scriptHash);

        receivedScriptHash = transaction[0];
        var receivedBuyer = transaction[1];
        var receivedSeller = transaction[2];
        var receivedAmount = transaction[3];
        var receivedStatus = transaction[4];
        var receivedTimeoutHours = transaction[7];
        var receivedThreshold = transaction[8];
        var receivedTransactionType = transaction[9];
        var receivedTokenAddress = transaction[10];

        assert.equal(receivedScriptHash, scriptHash, "Received script hash does not matches the script hash sent");
        assert.equal(receivedBuyer, buyer, "Received buyer hash does not matches the buyer sent");
        assert.equal(receivedSeller, seller, "Received seller hash does not matches the seller sent");
        assert.equal(receivedAmount.toNumber(), Number(amount) + Number(amount), "Received amount does not matches the amount sent");
        assert.equal(receivedStatus, 0, "Received status is not FUNDED(0)");
        assert.equal(receivedTimeoutHours, timeoutHours, "Received timeout hours does not matches the timeout hours sent");
        assert.equal(receivedThreshold, threshold, "Received threshold does not matches the threshold sent");
        assert.equal(receivedTransactionType, 1, "Received transaction type is not TOKEN(1)");
        assert.equal(receivedTokenAddress, this.token.address, "Received token address does not matches the token address sent");

        
    });

    it("Add funds to Token transaction from non-buyer's account", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var amount = web3.utils.toWei("100", "ether");
        var txResult = await this.token.approve(this.escrow.address, amount, {from:buyer});

       

        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address, this.token.address);
        var scriptHash = getScriptHash(redeemScript);
        
        await this.escrow.addTokenTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, amount, this.token.address, {from:acct[0]});

        await this.token.approve(this.escrow.address, amount, {from:acct[9]});

        try{
            await this.escrow.addTokensToTransaction(scriptHash, amount,{from:acct[9]});
            assert.equal(true, false, "Should not be able to add funds to the transaction from non-buyer's account");

           }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

           }        
    });

    it("Add new Token transaction without apporving the escrow contract to transfer required amount of tokens on behalf of sender", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var amount = web3.utils.toWei("100", "ether");

        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address, this.token.address);
        var scriptHash = getScriptHash(redeemScript);
        
        try{
            await this.escrow.addTokenTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, amount, this.token.address, {from:acct[0]});
            assert.equal(true, false, "Should not be able to add transaction without apporving the escrow contract to transfer required amount of tokens on behalf of sender");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
        
        
    });

    it("Add new Token transaction by approving less amount of tokens then required", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var amount = web3.utils.toWei("100", "ether");

        await this.token.approve(this.escrow.address, web3.utils.toWei("10", "ether"), {from:buyer});

        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address, this.token.address);
        var scriptHash = getScriptHash(redeemScript);
        
        try{
            txResult = await this.escrow.addTokenTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash, amount, this.token.address, {from:acct[0]});
            assert.equal(true, false, "Should not be able to add transaction by approving less amount of tokens then required");

        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);

        }
        
        
    });

    it("Execute Token Transaction", async()=>{
        var buyer = acct[0];
        var seller = acct[1];
        var moderator = acct[2];
        var threshold = 3;
        var timeoutHours = 6;
        var uniqueId = getUniqueId();
        var redeemScript = generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator, this.escrow.address, this.token.address);
        var scriptHash = getScriptHash(redeemScript);
        var amountToBeGivenToSeller = web3.utils.toWei("90", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("10", "ether");

        var txResult = await this.token.approve(this.escrow.address, web3.utils.toWei("100", "ether"), {from:buyer});
        txResult = await this.escrow.addTokenTransaction(buyer, seller, [moderator], threshold, timeoutHours, scriptHash,web3.utils.toWei("100", "ether"), this.token.address, {from:acct[0]});
                
        var sig = createSigs([buyer, seller, moderator], this.escrow.address, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator], scriptHash);
        
        var sellerBalanceBefore = await this.token.balanceOf(seller);
        var escrowContractBalanceBefore = await this.token.balanceOf(this.escrow.address);
        var moderatorBalanceBefore = await this.token.balanceOf(moderator);

        escrowContractBalanceBefore = new BigNumber(escrowContractBalanceBefore.toNumber());
        sellerBalanceBefore = new BigNumber(sellerBalanceBefore.toNumber());
        moderatorBalanceBefore = new BigNumber(moderatorBalanceBefore.toNumber());

        txResult = await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, uniqueId, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);

        var eventName = txResult.logs[0].event;
        var receivedScriptHash = txResult.logs[0].args.scriptHash;

        assert.equal(eventName, "Executed", "Executed event must be fired");
        assert.equal(receivedScriptHash, scriptHash, "Received script hash does not matches the script hash of the transaction executed");

        var sellerBalanceAfter = await this.token.balanceOf(seller);
        var escrowContractBalanceAfter = await this.token.balanceOf(this.escrow.address);
        var moderatorBalanceAfter = await this.token.balanceOf(moderator);

        escrowContractBalanceAfter = new BigNumber(escrowContractBalanceAfter.toNumber());
        sellerBalanceAfter = new BigNumber(sellerBalanceAfter.toNumber());
        moderatorBalanceAfter = new BigNumber(moderatorBalanceAfter.toNumber());

        assert.equal(sellerBalanceBefore.plus(Number(amountToBeGivenToSeller)).toNumber(), sellerBalanceAfter.toNumber(), "Seller's token balance must increase by : "+amountToBeGivenToSeller);
        assert.equal(moderatorBalanceBefore.plus(Number(amountToBeGivenToModerator)).toNumber(), moderatorBalanceAfter.toNumber(), "Moderator's token balance must increase by : "+amountToBeGivenToModerator);
        assert.equal(escrowContractBalanceBefore.minus(Number(amountToBeGivenToSeller) + Number(amountToBeGivenToModerator)).toNumber(), escrowContractBalanceAfter.toNumber(), "Escrow contract's token balance must reduce by escrowed amount");

    });

    
});