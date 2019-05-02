var PowerUps = artifacts.require("PowerUps");
var OBToken = artifacts.require("OBToken");
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
    this.OBT = await OBToken.new("Open Bazaar", "OBT", 18, 1000000000, {
      from: account[0]
    });

    this.keywordPowerup = await PowerUps.new(this.OBT.address);

    await this.OBT.transfer(account[1], web3.utils.toWei("1000000", "ether"), {
      from: account[0]
    });
    await this.OBT.transfer(account[2], web3.utils.toWei("1000000", "ether"), {
      from: account[0]
    });
    await this.OBT.transfer(account[3], web3.utils.toWei("1000000", "ether"), {
      from: account[0]
    });
    await this.OBT.transfer(account[4], web3.utils.toWei("1000000", "ether"), {
      from: account[0]
    });
    await this.OBT.transfer(account[5], web3.utils.toWei("1000000", "ether"), {
      from: account[0]
    });
    await this.OBT.transfer(account[6], web3.utils.toWei("1000000", "ether"), {
      from: account[0]
    });
    await this.OBT.transfer(account[7], web3.utils.toWei("1000000", "ether"), {
      from: account[0]
    });

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
    var amount = web3.utils.toWei("1000", "ether");
    var keyword = keywords[0];

    await this.OBT.approve(this.keywordPowerup.address, amount, {
      from: initiator
    });

    var initiatorTokenBalanceBefore = await this.OBT.balanceOf(initiator);

    initiatorTokenBalanceBefore = new BigNumber(initiatorTokenBalanceBefore);

    var txResult = await this.keywordPowerup.addPowerUp(
      contentAddress,
      amount,
      keyword,
      { from: initiator }
    );

    var receivedEvent = txResult.logs[0].event;
    var receivedinitiator = txResult.logs[0].args.initiator;
    var receivedId = txResult.logs[0].args.id;
    var receivedTokensBurnt = txResult.logs[0].args.tokensBurned;
    receivedTokensBurnt = new BigNumber(receivedTokensBurnt);
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
      receivedTokensBurnt.toNumber(),
      amount,
      "Received and passed token amount to burn must match"
    );

    var initiatorTokenBalanceAfter = await this.OBT.balanceOf(initiator);

    initiatorTokenBalanceAfter = new BigNumber(initiatorTokenBalanceAfter);

    assert.equal(
      initiatorTokenBalanceBefore.toNumber(),
      initiatorTokenBalanceAfter.plus(Number(amount)).toNumber(),
      "initiator's token balance must reduce by the amount sent"
    );

    ids.push(receivedId);

    powerUps[receivedId] = new Object();
    powerUps[receivedId].contentAddress = contentAddress;
    powerUps[receivedId].initiator = initiator;
    powerUps[receivedId].tokensBurnt = Number(amount);

    keywordVsPowerUpIds[keyword].push(receivedId);
  });

  it("Add new power up with tokens to burn as 0", async () => {
    var initiator = account[1];
    var contentAddress =
      "GFBasuH1829mTDMoVqvyBkNMRhzvukTDznnUY76yhnJKJgFhKlIhGFf678dZ3VKRC";
    var amount = 0;
    var keyword = keywords[0];

    await this.OBT.approve(this.keywordPowerup.address, amount, {
      from: initiator
    });

    try {
      await this.keywordPowerup.addPowerUp(contentAddress, amount, keyword, {
        from: initiator
      });
      assert.equal(true, false, "Add listing must fail for amount 0");
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });

  it("Add new power up with content address as empty string", async () => {
    var initiator = account[2];
    var contentAddress = "";
    var amount = web3.utils.toWei("1000", "ether");
    var keyword = keywords[0];

    await this.OBT.approve(this.keywordPowerup.address, amount, {
      from: initiator
    });

    try {
      await this.keywordPowerup.addPowerUp(contentAddress, amount, keyword, {
        from: initiator
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

  it("Add new power up without apporving contract to burn tokens on behalf of initiator", async () => {
    var initiator = account[3];
    var contentAddress = "AjhHKKhaKJHAKJshASHAshaSKHAjASHALHAHAKKJJKKJhjlkJK";
    var amount = web3.utils.toWei("1000", "ether");
    var keyword = keywords[0];

    try {
      await this.keywordPowerup.addPowerUp(contentAddress, amount, keyword, {
        from: initiator
      });
      assert.equal(
        true,
        false,
        "Add listing must fail without approving powered listing contract to burn tokens on behalf of initiator"
      );
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });

  it("Add power up with zero address as initiator", async () => {
    var initiator = "0x0000000000000000000000000000000000000000";
    var contentAddress = "AjhHKKhaKJHAKJshASHAshaSKHAjASHALHAHAKKJJKKJhjlkJK";
    var amount = web3.utils.toWei("1000", "ether");
    var keyword = keywords[0];

    try {
      await this.OBT.approve(this.keywordPowerup.address, amount, {
        from: initiator
      });
      await this.keywordPowerup.addPowerUp(contentAddress, amount, keyword, {
        from: initiator
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

    amounts.push(web3.utils.toWei("1000", "ether"));
    amounts.push(web3.utils.toWei("2000", "ether"));
    amounts.push(web3.utils.toWei("3000", "ether"));
    amounts.push(web3.utils.toWei("4000", "ether"));

    var amount = web3.utils.toWei("10000", "ether");

    await this.OBT.approve(this.keywordPowerup.address, amount, {
      from: initiator
    });

    var initiatorTokenBalanceBefore = await this.OBT.balanceOf(initiator);

    initiatorTokenBalanceBefore = new BigNumber(initiatorTokenBalanceBefore);

    var txResult = await this.keywordPowerup.addPowerUps(
      contentAddress,
      amounts,
      keywords,
      { from: initiator }
    );

    for (var i = 0; i < 4; i++) {
      var receivedEvent = txResult.logs[i].event;
      var receivedinitiator = txResult.logs[i].args.initiator;
      var receivedId = txResult.logs[i].args.id;
      var receivedTokensBurnt = txResult.logs[i].args.tokensBurned;
      receivedTokensBurnt = new BigNumber(receivedTokensBurnt);
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
        receivedTokensBurnt.toNumber(),
        amounts[i],
        "Received and passed token amount to burn must match"
      );

      ids.push(receivedId);

      powerUps[receivedId] = new Object();
      powerUps[receivedId].contentAddress = contentAddress;
      powerUps[receivedId].initiator = initiator;
      powerUps[receivedId].tokensBurnt = Number(amount);

      keywordVsPowerUpIds[keywords[i]].push(receivedId);
    }

    var initiatorTokenBalanceAfter = await this.OBT.balanceOf(initiator);

    initiatorTokenBalanceAfter = new BigNumber(initiatorTokenBalanceAfter);
    assert.equal(
      initiatorTokenBalanceBefore.toNumber(),
      initiatorTokenBalanceAfter.plus(Number(amount)).toNumber(),
      "initiator's token balance must reduce by the amount sent"
    );
  });

  it("Topup power up", async () => {
    var initiator = powerUps[ids[0]].initiator;
    var id = ids[0];

    var amount = web3.utils.toWei("2000", "ether");

    await this.OBT.approve(this.keywordPowerup.address, amount, {
      from: initiator
    });

    var initiatorTokenBalanceBefore = await this.OBT.balanceOf(initiator);

    initiatorTokenBalanceBefore = new BigNumber(initiatorTokenBalanceBefore);

    var txResult = await this.keywordPowerup.topUpPowerUp(id, amount, {
      from: initiator
    });

    var receivedEvent = txResult.logs[0].event;
    var receivedinitiator = txResult.logs[0].args.initiator;
    var receivedId = txResult.logs[0].args.id;
    var receivedTokensBurnt = txResult.logs[0].args.tokensBurned;
    receivedTokensBurnt = new BigNumber(receivedTokensBurnt);
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
      receivedTokensBurnt.toNumber(),
      amount,
      "Received and passed token amount to burn must match"
    );

    var initiatorTokenBalanceAfter = await this.OBT.balanceOf(initiator);

    initiatorTokenBalanceAfter = new BigNumber(initiatorTokenBalanceAfter);

    assert.equal(
      initiatorTokenBalanceBefore.toNumber(),
      initiatorTokenBalanceAfter.plus(Number(amount)).toNumber(),
      "initiator's token balance must reduce by the amount sent"
    );

    powerUps[id].tokensBurnt = Number(amount) + powerUps[id].tokensBurnt;
  });

  it("Topup non-existing powerup", async () => {
    var initiator = powerUps[ids[0]].initiator;
    var id = 29;

    var amount = web3.utils.toWei("2000", "ether");

    await this.OBT.approve(this.keywordPowerup.address, amount, {
      from: initiator
    });
    try {
      await this.keywordPowerup.topUpPowerUp(id, amount, { from: initiator });
      assert.equal(true, false, "Topup must fail for non-existing powerup");
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });

  it("Topup listing without approving contract to burn tokens on behalf of initiator", async () => {
    var initiator = powerUps[ids[0]].initiator;
    var id = ids[0];

    var amount = web3.utils.toWei("7000", "ether");

    try {
      await this.keywordPowerup.topUpPowerUp(id, amount, { from: initiator });
      assert.equal(
        true,
        false,
        "Topup must fail without approving contract to burn on behalf of initiator"
      );
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });

  it("Top up listing with amount of tokens to burn as 0", async () => {
    var initiator = powerUps[ids[0]].initiator;
    var id = ids[0];
    var amount = 0;

    await this.OBT.approve(this.keywordPowerup.address, amount, {
      from: initiator
    });

    try {
      await this.keywordPowerup.topUpPowerUp(id, amount, { from: initiator });
      assert.equal(true, false, "Topup must fail with topup amount as 0");
    } catch (error) {
      assert.notInclude(error.toString(), "AssertionError", error.message);
    }
  });

  it("Get power up information for existing power up", async () => {
    var id = ids[0]
    var powerUpInfo = await this.keywordPowerup.getPowerUpInfo(id);
    var receivedContentAddress = powerUpInfo[0];
    var receivedTokensBurnt = powerUpInfo[1];
    receivedTokensBurnt = new BigNumber(receivedTokensBurnt);
    assert.equal(
      receivedContentAddress,
      powerUps[ids[0]].contentAddress,
      "Recieved and passed content address must match"
    );
    assert.equal(
      receivedTokensBurnt.toNumber(),
      powerUps[ids[0]].tokensBurnt,
      "Recived tokens burnt must match total tokens burnt for this listing"
    );
  });

  it("Get power up information for non-existing power up", async () => {
    var powerUpInfo = await this.keywordPowerup.getPowerUpInfo("29");

    var receivedContentAddress = powerUpInfo[0];
    var receivedTokensBurnt = powerUpInfo[1];

    assert.equal(
      receivedContentAddress,
      "",
      "Recieved content address must be empty"
    );
    assert.equal(receivedTokensBurnt, 0, "Recived tokens burnt must be zero");
  });
});
