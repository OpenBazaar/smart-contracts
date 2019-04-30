var PowerUps = artifacts.require("PowerUps");
var Web3 = require("web3");
var web3 = new Web3("http://localhost:8555");
var BigNumber = require("bignumber.js");
var helper = require("../helper.js");

contract("Keyword Based Powerups Contract", function(account) {
  var ids = new Array();
  var powerUps = new Object();
  var keywords = new Array();
  var keywordVsPowerUpIds = new Object();

  before(async () => {
    
    this.keywordPowerup = await PowerUps.new(account[2]);

    keywords.push(web3.utils.fromAscii("open bazaar"));
    keywordVsPowerUpIds[keywords[0]] = new Array();

    keywords.push(web3.utils.fromAscii("Christmas"));
    keywordVsPowerUpIds[keywords[1]] = new Array();

    keywords.push(web3.utils.fromAscii("New Year"));
    keywordVsPowerUpIds[keywords[2]] = new Array();

    keywords.push(web3.utils.fromAscii("Ethereum"));
    keywordVsPowerUpIds[keywords[3]] = new Array();
  });

  it("Add new Power up", async () => {
    var initiator = account[1];
    var contentAddress = "QmTDMoVqvyBkNMRhzvukTDznntByUNDwyNdSfV8dZ3VKRC";
    var amount = web3.utils.toWei("1", "ether");
    var keyword = keywords[0];

    var txResult = await this.keywordPowerup.addPowerUp(
      contentAddress,
      keyword,
      { from: initiator, value:amount }
    );

    var receivedEvent = txResult.logs[0].event;
    var receivedinitiator = txResult.logs[0].args.initiator;
    var receivedId = txResult.logs[0].args.id;
    var receivedAmount = txResult.logs[0].args.amount;
    
    receivedAmount = new BigNumber(receivedAmount);
    assert.equal(
      receivedEvent,
      "NewPowerUpAdded",
      "NewPowerUpAdded event should be fired"
    );
    assert.equal(
      receivedinitiator,
      initiator,
      "Received initiator and passed initiator must match"
    );
    assert.equal(
      receivedAmount.toNumber(),
      amount,
      "Received and passed amount must match"
    );

    ids.push(receivedId);

    powerUps[receivedId] = new Object();
    powerUps[receivedId].contentAddress = contentAddress;
    powerUps[receivedId].initiator = initiator;
    powerUps[receivedId].amount = Number(amount);

    keywordVsPowerUpIds[keyword].push(receivedId);
  });

  it("Add new power up with 0 ETH", async () => {
    var initiator = account[1];
    var contentAddress =
      "GFBasuH1829mTDMoVqvyBkNMRhzvukTDznnUY76yhnJKJgFhKlIhGFf678dZ3VKRC";
    var amount = 0;
    var keyword = keywords[0];

    try {
      await this.keywordPowerup.addPowerUp(contentAddress, keyword, {
        from: initiator,
        value: amount
      });
      assert.equal(true, false, "Add listing must fail for amount 0");
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });

  it("Add new power up with content address as empty string", async () => {
    var initiator = account[2];
    var contentAddress = "";
    var amount = web3.utils.toWei("1", "ether");
    var keyword = keywords[0];

    try {
      await this.keywordPowerup.addPowerUp(contentAddress, keyword, {
        from: initiator,
        value: amount
      });
      assert.equal(
        true,
        false,
        "Add listing must fail for empyt content address"
      );
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });

  it("Add power up with zero address as initiator", async () => {
    var initiator = "0x0000000000000000000000000000000000000000";
    var contentAddress = "AjhHKKhaKJHAKJshASHAshaSKHAjASHALHAHAKKJJKKJhjlkJK";
    var amount = web3.utils.toWei("1", "ether");
    var keyword = keywords[0];

    try {
      
      await this.keywordPowerup.addPowerUp(contentAddress, keyword, {
        from: initiator,
        value: amount
      });
      assert.equal(
        true,
        false,
        "Add listing must fail with initiator as zero address"
      );
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });
  it("Add multiple power-ups with different keyword for same content address", async () => {
    var contentAddress =
      "TmTDMoVqvyBkNMRhzvukTDznntByUNgkhasdgashdjhd0892138291038DwyNdSfV8dZ3VKRC";

    var initiator = account[3];
    var amounts = new Array();

    amounts.push(web3.utils.toWei("1", "ether"));
    amounts.push(web3.utils.toWei("1", "ether"));
    amounts.push(web3.utils.toWei("1", "ether"));
    amounts.push(web3.utils.toWei("1", "ether"));

    var amount = web3.utils.toWei("4", "ether");

    var txResult = await this.keywordPowerup.addPowerUps(
      contentAddress,
      amounts,
      keywords,
      { from: initiator, value: amount }
    );

    for (var i = 0; i < 4; i++) {
      var receivedEvent = txResult.logs[i].event;
      var receivedinitiator = txResult.logs[i].args.initiator;
      var receivedId = txResult.logs[i].args.id;
      var receivedAmount = txResult.logs[i].args.amount;
      receivedAmount = new BigNumber(receivedAmount);
      assert.equal(
        receivedEvent,
        "NewPowerUpAdded",
        "NewPowerUpAdded event should be fired"
      );
      assert.equal(
        receivedinitiator,
        initiator,
        "Received initiator and passed initiator must match"
      );
      assert.equal(
        receivedAmount.toNumber(),
        amounts[i],
        "Received and passed amount must match"
      );

      ids.push(receivedId);

      powerUps[receivedId] = new Object();
      powerUps[receivedId].contentAddress = contentAddress;
      powerUps[receivedId].initiator = initiator;
      powerUps[receivedId].amount = Number(amount);

      keywordVsPowerUpIds[keywords[i]].push(receivedId);
    }
  });

  it("Topup power up", async () => {
    var initiator = powerUps[ids[0]].initiator;
    var id = ids[0];

    var amount = web3.utils.toWei("1", "ether");
    var txResult = await this.keywordPowerup.topUpPowerUp(id, {
      from: initiator,
      value: amount
    });
    var receivedEvent = txResult.logs[0].event;
    var receivedinitiator = txResult.logs[0].args.initiator;
    var receivedId = txResult.logs[0].args.id;
    var receivedAmount = txResult.logs[0].args.amount;
    receivedAmount = new BigNumber(receivedAmount);
    assert.equal(receivedEvent, "Topup", "Topup event should be fired");
    assert.equal(
      receivedinitiator,
      initiator,
      "Received initiator and passed initiator must match"
    );
    assert.equal(
      receivedId.toNumber(),
      id.toNumber(),
      "Received and passed id must match"
    );
    assert.equal(
      receivedAmount.toNumber(),
      amount,
      "Received and passed amount must match"
    );

    powerUps[id].amount = Number(amount) + powerUps[id].amount;
  });

  it("Topup non-existing powerup", async () => {
    var initiator = powerUps[ids[0]].initiator;
    var id = 29;

    var amount = web3.utils.toWei("2", "ether");

    try {
      await this.keywordPowerup.topUpPowerUp(id, { from: initiator, value: amount });
      assert.equal(true, false, "Topup must fail for non-existing powerup");
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });

  it("Top up listing with amount of tokens to burn as 0", async () => {
    var initiator = powerUps[ids[0]].initiator;
    var id = ids[0];

    var amount = 0;

    try {
      await this.keywordPowerup.topUpPowerUp(id, { from: initiator, value: amount });
      assert.equal(true, false, "Topup must fail with topup amount as 0");
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });

  it("Get power up information for existing power up", async () => {
    var powerUpInfo = await this.keywordPowerup.getPowerUpInfo(ids[0]);

    var receivedContentAddress = powerUpInfo[0];
    var receivedAmount = powerUpInfo[1];
    receivedAmount = new BigNumber(receivedAmount);
    assert.equal(
      receivedContentAddress,
      powerUps[ids[0]].contentAddress,
      "Recieved and passed content address must match"
    );
    assert.equal(
      receivedAmount.toNumber(),
      powerUps[ids[0]].amount,
      "Recived  amount must match with total amount for this listing"
    );
  });

  it("Get power up information for non-existing power up", async () => {
   
    try{
      var powerUpInfo = await this.keywordPowerup.getPowerUpInfo("29");
      assert.equal(true, false, "Fetching must fails for non-existent powerup");
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });  
  
});
