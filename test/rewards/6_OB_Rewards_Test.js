var OBRewards = artifacts.require("OBRewards");
var OBToken = artifacts.require("OBToken");
var Escrow = artifacts.require("Escrow");
var EscrowProxy = artifacts.require("EscrowProxy");

var helper = require("../helper.js");
var Web3 = require("web3");
var web3 = new Web3("http://localhost:8555");
var BigNumber = require('bignumber.js');

let acct;
var buyers = new Array();
var nonPromotedSellers = new Array();
var promotedSellers = new Array();
var moderators = new Array();

contract("OB Rewards Contract", function() {

    var createCompletedTransactionsWithPromotedSellers = async(start, numberOfTransactions)=>{
        var transactions = new Object();
    
        for (var i = 0;i<numberOfTransactions;i++){
        var buyer = buyers[start + i];
        var index = ((start + i) % 10);
        var seller = promotedSellers[index];
        var moderator = moderators[index];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = helper.getUniqueId();
        var redeemScript = helper.generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = helper.getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");
        await this.escrow.addTransaction(buyer, seller, moderator, threshold, timeoutHours, scriptHash, uniqueId, {from:acct[0], value:amount});
        
        var amountToBeGivenToSeller = web3.utils.toWei("0.9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");
            
        var txHash = await this.escrowProxy.getTransactionHash(this.escrow.address, scriptHash, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
        var sig = helper.signMessageHash(txHash, [seller, moderator]);

        await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
    
        transactions[scriptHash] = new Object();
        transactions[scriptHash].buyer = buyer;
        transactions[scriptHash].seller = seller;    
    }
        return transactions;
    }

    var createCompletedTransactionsWithNonPromotedSellers = async(start, numberOfTransactions)=>{
        var transactions = new Object();
    
        for (var i = 0;i<numberOfTransactions;i++){
        var buyer = buyers[start + i];
        var index = ((start + i) % 10);
        var seller = nonPromotedSellers[index];
        var moderator = moderators[index];
        var threshold = 2;
        var timeoutHours = 6;
        var uniqueId = helper.getUniqueId();
        var redeemScript = helper.generateRedeemScript(uniqueId, threshold, timeoutHours, buyer, seller, moderator,  this.escrow.address);
        var scriptHash = helper.getScriptHash(redeemScript);
        var amount = web3.utils.toWei("1", "ether");
        await this.escrow.addTransaction(buyer, seller, moderator, threshold, timeoutHours, scriptHash, uniqueId, {from:acct[0], value:amount});
        
        var amountToBeGivenToSeller = web3.utils.toWei("0.9", "ether");
        var amountToBeGivenToModerator = web3.utils.toWei("0.1", "ether");
    
        var txHash = await this.escrowProxy.getTransactionHash(this.escrow.address, scriptHash, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
        var sig = helper.signMessageHash(txHash, [seller, moderator]);

        await this.escrow.execute(sig.sigV, sig.sigR, sig.sigS, scriptHash, [seller, moderator], [amountToBeGivenToSeller, amountToBeGivenToModerator]);
    
        transactions[scriptHash] = new Object();
        transactions[scriptHash].buyer = buyer;
        transactions[scriptHash].seller = seller;    
    }
        return transactions;
    }

    before(async() => {
        acct = await helper.setupWallet();

        //Push promoted sellers
        for(var i = 0;i<10; i++){
            promotedSellers.push(acct[1+i]);
        }

        //push non promoted seller accounts
        for(var i = 0;i<10;i++){
            nonPromotedSellers.push(acct[11+i]);
        }
        
        //push moderator accounts
        for(var i = 0;i<10;i++){
            moderators.push(acct[21+i]);
        }

        //Push buyer accounts
        for(var i = 0;i<1500;i++){
            buyers.push(acct[31+i]);
        }

        this.escrow = await Escrow.new({from:acct[0]});
    
        this.OBT = await OBToken.new("Open Bazaar", "OBT", 18, "100000000", {from:acct[0]});

        this.rewards = await OBRewards.new("500000000000000000000", 432000, this.escrow.address, this.OBT.address, {from:acct[0]});
        await this.rewards.addPromotedSellers(promotedSellers, {from:acct[0]});

        await this.OBT.transfer(this.rewards.address, "570000000000000000000", {from:acct[0]});
        this.escrowProxy = await EscrowProxy.new("0x0000000000000000000000000000000000000000");
    });

    it("Claim reward for transaction when rewards is not on", async()=>{
        var transactions = await createCompletedTransactionsWithPromotedSellers(0, 1);
        var scriptHashes = new Array();

        for(var key in transactions){
            scriptHashes.push(key);    
        }
        try{
            await this.rewards.claimRewards(scriptHashes);
            assert.equal(true, false, "Should not be able to claim rewards when rewards is not on");
        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);
        }
    });

    it("Turn rewards on from non-owner account", async()=>{
        try{
            await this.rewards.turnOnRewards({from:acct[1]});
            assert.equal(true, false, "Should not be able to turn on rewards from non-owner account");
        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);
        }
    });

    it("Turn rewards on from owner account", async()=>{
        var txResult = await this.rewards.turnOnRewards({from:acct[0]});
        var event = txResult.logs[0].event;
        assert.equal(event, "RewardsOn", "RewardsOn event must be fired");
        var rewardsOn = await this.rewards.rewardsOn();
        assert(rewardsOn, true, "Rewards must be on");
    });

    it("Claim reward when rewards are not running", async()=>{
        var transactions = await createCompletedTransactionsWithPromotedSellers(0, 1);
        var scriptHashes = new Array();
        for(var key in transactions){
            scriptHashes.push(key);    
        }
        try{
            await this.rewards.claimRewards(scriptHashes);
            assert.equal(true, false, "Should not be able to claim rewards when rewards are not running");
        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);
        }
    });

    it("Set end date from non-owner account", async()=>{
        var endDate = new Date();
        endDate.setDate(endDate.getDate()+2);

        try{
            await this.rewards.setEndDate(endDate.getTime()/1000, {from:acct[100]});
            assert.equal(true, false, "Should not be able to change end date from non-owner account");
        }catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);
        }
    });

    it("Set end date to some point in the future", async()=>{
        var endDate = new Date();
        endDate.setDate(endDate.getDate()+2);

        var txResult = await this.rewards.setEndDate(Math.floor(endDate.getTime()/1000), {from:acct[0]});
        var event = txResult.logs[0].event;
        var receivedEndDate = txResult.logs[0].args.endDate;
        assert.equal(event, "EndDateChanged", "EndDateChanged event must be fired");
        assert.equal(receivedEndDate.toNumber(), Math.floor(endDate.getTime()/1000), "Passed and received end date must match");

        var running = await this.rewards.isRewardsRunning();
        assert(running, true, "Rewards must be running now");
    });

    it("Claim reward for 1 valid scriptHashes", async()=>{
        var transactions = await createCompletedTransactionsWithPromotedSellers(0, 1);
        var scriptHashes = new Array();
        for(var key in transactions){
            scriptHashes.push(key);    
        }
        var txResult = await this.rewards.claimRewards(scriptHashes);

        for(var i=0;i<txResult.logs.length;i++){
            var eventName = txResult.logs[i].event;
            var buyer = txResult.logs[i].args.buyer;
            var scriptHash = txResult.logs[i].args.scriptHash;
            var seller = txResult.logs[i].args.seller;
            assert.equal(eventName, "SuccessfulClaim", "SuccessfulClaim event must be fired");
            assert.equal(buyer, web3.utils.toChecksumAddress(transactions[scriptHash].buyer), "Passed and received buyers are not matching");
            assert.equal(seller, web3.utils.toChecksumAddress(transactions[scriptHash].seller), "Passed and received sellers are not matching");
        }
    });

    it("Claim reward for multiple valid scriptHashes", async()=>{
        var transactions = await createCompletedTransactionsWithPromotedSellers(1, 10);
        var scriptHashes = new Array();

        for(var key in transactions){
            scriptHashes.push(key);    
        }
        var txResult = await this.rewards.claimRewards(scriptHashes);
        for(var i=0;i<txResult.logs.length;i++){
            var eventName = txResult.logs[i].event;
            var buyer = txResult.logs[i].args.buyer;
            var scriptHash = txResult.logs[i].args.scriptHash;
            var seller = txResult.logs[i].args.seller;

            assert.equal(eventName, "SuccessfulClaim", "SuccessfulClaim event must be fired");
            assert.equal(buyer, web3.utils.toChecksumAddress(transactions[scriptHash].buyer), "Passed and received buyers are not matching");
            assert.equal(seller, web3.utils.toChecksumAddress(transactions[scriptHash].seller), "Passed and received sellers are not matching");
        }
    });

    it("If buyer is eligible for more tokens than are available in the contract then the contract should pay out as much as it can", async()=>{
        var transactions = await createCompletedTransactionsWithPromotedSellers(11, 1);
        var scriptHashes = new Array();
        var buyer;

        for(var key in transactions){
            scriptHashes.push(key);    
            buyer = transactions[key].buyer;
        }
        var previousBuyerBalance = await this.OBT.balanceOf(buyer);
        previousBuyerBalance=new BigNumber(previousBuyerBalance);
        var contractTokenBalance = await this.OBT.balanceOf(this.rewards.address);
        contractTokenBalance = new BigNumber(contractTokenBalance);
        var txResult = await this.rewards.claimRewards(scriptHashes);
        for(var i=0;i<txResult.logs.length;i++){
            var eventName = txResult.logs[i].event;
            var buyer = txResult.logs[i].args.buyer;
            var scriptHash = txResult.logs[i].args.scriptHash;
            var seller = txResult.logs[i].args.seller;

            assert.equal(eventName, "SuccessfulClaim", "SuccessfulClaim event must be fired");
            assert.equal(buyer, web3.utils.toChecksumAddress(transactions[scriptHash].buyer), "Passed and received buyers are not matching");
            assert.equal(seller, web3.utils.toChecksumAddress(transactions[scriptHash].seller), "Passed and received sellers are not matching");
        }
        var newBuyerBalance = await this.OBT.balanceOf(buyer);
        newBuyerBalance = new BigNumber(newBuyerBalance);
        assert.equal(newBuyerBalance.toNumber() - previousBuyerBalance.toNumber(), contractTokenBalance.toNumber(), "Contract's token balance before claim must match the tokens transferred to buyer after claim");
    });

    it("Once the contract has been replenished with more tokens buyer should be able to claim remaining tokens for the same seller", async()=>{
        await this.OBT.transfer(this.rewards.address, "20000000000000000000", {from:acct[0]});
        var transactions = await createCompletedTransactionsWithPromotedSellers(12, 1);
        var scriptHashes = new Array();
        var buyer;

        for(var key in transactions){
            scriptHashes.push(key);    
            buyer = transactions[key].buyer;
        }
        var previousBuyerBalance = await this.OBT.balanceOf(buyer);
        previousBuyerBalance = new BigNumber(previousBuyerBalance);
        var contractTokenBalance = await this.OBT.balanceOf(this.rewards.address);
        contractTokenBalance = new BigNumber(contractTokenBalance);
        var remainingTokens = 50000000000000000000 - contractTokenBalance.toNumber();
        var txResult = await this.rewards.claimRewards(scriptHashes);
        for(var i=0;i<txResult.logs.length;i++){
            var eventName = txResult.logs[i].event;
            var buyer = txResult.logs[i].args.buyer;
            var scriptHash = txResult.logs[i].args.scriptHash;
            var seller = txResult.logs[i].args.seller;

            assert.equal(eventName, "SuccessfulClaim", "SuccessfulClaim event must be fired");
            assert.equal(buyer, web3.utils.toChecksumAddress(transactions[scriptHash].buyer), "Passed and received buyers are not matching");
            assert.equal(seller, web3.utils.toChecksumAddress(transactions[scriptHash].seller), "Passed and received sellers are not matching");
        }
        var newBuyerBalance = await this.OBT.balanceOf(buyer);
        newBuyerBalance = new BigNumber(newBuyerBalance);
        assert.equal(newBuyerBalance.toNumber() - previousBuyerBalance.toNumber(), contractTokenBalance.toNumber(), "Contract's token balance before claim must match the tokens transferred to buyer after claim");
        
        await this.OBT.transfer(this.rewards.address, "100000000000000000000", {from:acct[0]});
        
        var txResult = await this.rewards.claimRewards(scriptHashes);
        for(var i=0;i<txResult.logs.length;i++){
            var eventName = txResult.logs[i].event;
            var buyer = txResult.logs[i].args.buyer;
            var scriptHash = txResult.logs[i].args.scriptHash;
            var seller = txResult.logs[i].args.seller;

            assert.equal(eventName, "SuccessfulClaim", "SuccessfulClaim event must be fired");
            assert.equal(buyer, web3.utils.toChecksumAddress(transactions[scriptHash].buyer), "Passed and received buyers are not matching");
            assert.equal(seller, web3.utils.toChecksumAddress(transactions[scriptHash].seller), "Passed and received sellers are not matching");
        }
        var secondNewBuyerBalance = await this.OBT.balanceOf(buyer);
        secondNewBuyerBalance = new BigNumber(secondNewBuyerBalance);
        assert.equal(secondNewBuyerBalance.toNumber() - newBuyerBalance.toNumber(), remainingTokens, "Buyer should receive the remaining amout of tokens");
    });
    
    it("Claim reward for non-promoted seller", async()=>{
        var transactions = await createCompletedTransactionsWithNonPromotedSellers(0, 1);
        var scriptHashes = new Array();

        for(var key in transactions){
            scriptHashes.push(key);    
        }
        var txResult = await this.rewards.claimRewards(scriptHashes);
        for(var i=0;i<txResult.logs.length;i++){
            var eventName = txResult.logs[i].event;
            var buyer = txResult.logs[i].args.buyer;
            var scriptHash = txResult.logs[i].args.scriptHash;
            var seller = txResult.logs[i].args.seller;

            assert.equal(eventName, "UnsuccessfulClaim", "UnsuccessfulClaim event must be fired");
            assert.equal(buyer, web3.utils.toChecksumAddress(transactions[scriptHash].buyer), "Passed and received buyers are not matching");
            assert.equal(seller, web3.utils.toChecksumAddress(transactions[scriptHash].seller), "Passed and received sellers are not matching");
        }
    });

    it("Claim reward for multiple non-promoted seller", async()=>{
        var transactions = await createCompletedTransactionsWithNonPromotedSellers(1, 10);
        var scriptHashes = new Array();

        for(var key in transactions){
            scriptHashes.push(key);    
        }
        var txResult = await this.rewards.claimRewards(scriptHashes);
        for(var i=0;i<txResult.logs.length;i++){
            var eventName = txResult.logs[i].event;
            var buyer = txResult.logs[i].args.buyer;
            var scriptHash = txResult.logs[i].args.scriptHash;
            var seller = txResult.logs[i].args.seller;

            assert.equal(eventName, "UnsuccessfulClaim", "UnsuccessfulClaim event must be fired");
            assert.equal(buyer, web3.utils.toChecksumAddress(transactions[scriptHash].buyer), "Passed and received buyers are not matching");
            assert.equal(seller, web3.utils.toChecksumAddress(transactions[scriptHash].seller), "Passed and received sellers are not matching");
        }
    });
});