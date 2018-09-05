pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../token/ITokenContract.sol";


/**
* @dev Supports ERC20 tokens
* The escrow smart contract for the open bazaar trades in Ethereum
* The smart contract is desgined keeping in mind the current wallet interface of the OB-core
* https://github.com/OpenBazaar/wallet-interface/blob/master/wallet.go
* Current wallet interface strictly adheres to UTXO(bitcoin) model
*/
contract Escrow_v1_0 {

  using SafeMath for uint256;

  enum Status {FUNDED, RELEASED}

  enum TransactionType {ETHER, TOKEN}

  event Executed(bytes32 scriptHash, address[] destinations, uint256[] amounts);

  event FundAdded(bytes32 scriptHash, address indexed from, uint256 valueAdded);

  event Funded(bytes32 scriptHash, address indexed from, uint256 value);

  struct Transaction {
    bytes32 scriptHash;//This is unique indentifier for a transaction
    address buyer;
    address seller;
    address[] moderators;
    uint256 value;
    Status status;
    uint256 lastFunded;//Time at which transaction was last funded
    uint32 timeoutHours;
    uint8 threshold;
    mapping(address=>bool) isOwner;//to keep track of owners/signers.
    mapping(address=>bool) voted;//to keep track of who all voted
    TransactionType transactionType;
    address tokenAddress;// Token address in case of token transfer
  }

  mapping(bytes32 => Transaction) public transactions;

  uint256 public transactionCount = 0;

  //Contains mapping between each party and all of his transactions
  mapping(address => bytes32[])public partyVsTransaction;

  modifier transactionExists(bytes32 scriptHash) {
    require(
      transactions[scriptHash].value != 0,
      "Transaction does not exists"
    );
    _;
  }

  modifier transactionDoesNotExists (bytes32 scriptHash) {
    require(transactions[scriptHash].value == 0, "Transaction exists");
    _;
  }

  modifier inFundedState(bytes32 scriptHash) {
    require(
      transactions[scriptHash].status == Status.FUNDED,
      "Transaction is either in dispute or released state"
    );
    _;
  }

  modifier nonZeroAddress(address _address) {
    require(_address != address(0), "Zero address passed");
    _;
  }

  modifier checkTransactionType(bytes32 scriptHash, TransactionType transactionType) {
    require(
      transactions[scriptHash].transactionType == transactionType,
      "Transaction type does not match"
    );
    _;
  }

  modifier onlyBuyer(bytes32 scriptHash) {
    require(
      msg.sender == transactions[scriptHash].buyer,
      "The initiator of the transaction is not buyer"
    );
    _;
  }

  /**
  *@dev Add new transaction in the contract
  *@param _buyer The buyer of the transaction
  *@param _seller The seller of the listing associated with the transaction
  *@param _moderators List of moderators for this transaction. For now only single moderator
  *@param scriptHash keccak256 hash of the redeem script
  *@param threshold Minimum number of singatures required to released funds
  *@param timeoutHours Hours after which seller can release funds into his favour by signing transaction
  *Redeem Script format will be following
  <uniqueId: 20><threshold:1><timeoutHours:4><buyer:20><seller:20><moderator:20><multisigAddress:20>
  * scripthash-> keccak256(uniqueId, threshold, timeoutHours, buyer, seller, moderator)
  *Pass amount of the ethers to be put in escrow
  *Please keep in mind you will have to add moderators fees also in the value
  */
  function addTransaction(
    address _buyer,
    address _seller,
    address[] _moderators,
    uint8 threshold,
    uint32 timeoutHours,
    bytes32 scriptHash
  )
    public
    payable
    transactionDoesNotExists(scriptHash)
    nonZeroAddress(_buyer)
    nonZeroAddress(_seller)
  {
    addTransactionInternal(
      _buyer,
      _seller,
      _moderators,
      threshold,
      timeoutHours,
      scriptHash,
      msg.value,
      TransactionType.ETHER,
      address(0)
    );
  }

  /**
  *@dev Add new transaction in the contract
  *@param _buyer The buyer of the transaction
  *@param _seller The seller of the listing associated with the transaction
  *@param _moderators List of moderators for this transaction. For now only single moderator
  *@param scriptHash keccak256 hash of the redeem script
  *@param threshold Minimum number of singatures required to released funds
  *@param timeoutHours Hours after which seller can release funds into his favour by signing transaction
  *@param value Amount of tokens to be put in escrow
  *@param _tokenAddress Address of the token to be used
  *Redeem Script format will be following
  <uniqueId: 20><threshold:1><timeoutHours:4><buyer:20><seller:20><moderator:20><multisigAddress:20><tokenAddress:20>
  * scripthash-> keccak256(uniqueId, threshold, timeoutHours, buyer, seller, moderator, tokenAddress)
  *approve escrow contract to spend amount of token on your behalf
  *Please keep in mind you will have to add moderators fees also in the value
  */
  function addTokenTransaction(
    address _buyer,
    address _seller,
    address[] _moderators,
    uint8 threshold,
    uint32 timeoutHours,
    bytes32 scriptHash,
    uint256 value,
    address _tokenAddress
  )
    public
    transactionDoesNotExists(scriptHash)
    nonZeroAddress(_buyer)
    nonZeroAddress(_seller)
    nonZeroAddress(_tokenAddress)
  {
    ITokenContract token = ITokenContract(_tokenAddress);

    require(
      token.transferFrom(msg.sender, this, value),
      "Token transfer failed, maybe you did not approve escrow contract to spend on behalf of buyer"
    );

    addTransactionInternal(
      _buyer,
      _seller,
      _moderators,
      threshold,
      timeoutHours,
      scriptHash,
      value,
      TransactionType.TOKEN,
      _tokenAddress
    );
  }

    /**
    * Internal method to add transaction to reduce code redundancy
    */
  function addTransactionInternal(
    address _buyer,
    address _seller,
    address[] _moderators,
    uint8 threshold,
    uint32 timeoutHours,
    bytes32 scriptHash,
    uint256 value,
    TransactionType _transactionType,
    address _tokenAddress
  )
    internal
  {
    uint256 _value = value;

    require(_buyer != _seller, "Buyer and seller are same");

    //value passed should be greater than 0
    require(_value>0, "Value passed is 0");

    // For now allowing 0 moderators to support 1-2 multisig wallet
    //require(_moderators.length>0,"There should be atleast 1 moderator");//TODO- What to do in case of 1-2 multi sig transaction

    require(
      threshold <= _moderators.length + 2,
      "Threshold is greater than total owners"
    );

    require(threshold > 0, "Threshold can't be 0");

    transactions[scriptHash] = Transaction({
      buyer: _buyer,
      seller: _seller,
      moderators: _moderators,
      value: _value,
      status: Status.FUNDED,
      lastFunded: block.timestamp,
      scriptHash: scriptHash,
      threshold: threshold,
      timeoutHours: timeoutHours,
      transactionType:_transactionType,
      tokenAddress:_tokenAddress
    });

    transactions[scriptHash].isOwner[_seller] = true;
    transactions[scriptHash].isOwner[_buyer] = true;

    for (uint8 i=0;i<_moderators.length; i++) {
      require(_moderators[i] != address(0), "Zero address passed");
      //Check if same moderator is passed twice in the list
      require(
        !transactions[scriptHash].isOwner[_moderators[i]],
        "Moderator is beign repeated"
      );

      transactions[scriptHash].isOwner[_moderators[i]] = true;
    }
      transactionCount++;

      partyVsTransaction[_buyer].push(scriptHash);
      partyVsTransaction[_seller].push(scriptHash);

      emit Funded(scriptHash, msg.sender, _value);
    }

    /**
    *@dev Allows buyer of the transaction to add more funds(ether) in the transaction. This will help to cater scenarios wherein initially buyer missed to fund transaction as required
    *@param scriptHash script hash of the transaction
    * Only buyer of the transaction can invoke this method
    */
  function addFundsToTransaction(bytes32 scriptHash)
    public
    payable
    transactionExists(scriptHash)
    inFundedState(scriptHash)
    checkTransactionType(scriptHash, TransactionType.ETHER)
    onlyBuyer(scriptHash)
  {
    uint256 _value = msg.value;
    require(_value > 0);
    transactions[scriptHash].value = transactions[scriptHash].value.add(_value);
    transactions[scriptHash].lastFunded = block.timestamp;

    emit FundAdded(scriptHash, msg.sender, _value);
  }

  /**
  *@dev Allows buyer of the transaction to add more funds(Tokens) in the transaction. This will help to cater scenarios wherein initially buyer missed to fund transaction as required
  *@param scriptHash script hash of the transaction
  */
  function addTokensToTransaction(bytes32 scriptHash, uint256 value)
    public
    transactionExists(scriptHash)
    inFundedState(scriptHash)
    checkTransactionType(scriptHash, TransactionType.TOKEN)
    onlyBuyer(scriptHash)
  {
    uint256 _value = value;

    require(_value > 0);

    ITokenContract token = ITokenContract(transactions[scriptHash].tokenAddress);

    require(
      token.transferFrom(transactions[scriptHash].buyer, this, value),
      "Token transfer failed, maybe you did not approve escrow contract to spend on behalf of buyer"
    );

    transactions[scriptHash].value = transactions[scriptHash].value.add(_value);
    transactions[scriptHash].lastFunded = block.timestamp;

    emit FundAdded(scriptHash, msg.sender, _value);
  }

  /**
  *@dev Allows one of the moderator to collect all the signature to solve dispute and submit it to this method.
  * If all the required signatures are collected and consensus has been reached than funds will be released to the voted party
  *@param sigV Array containing V component of all the signatures(signed by each moderator)
  *@param sigR Array containing R component of all the signatures(signed by each moderator)
  *@param signS Array containing S component of all the signature(signed by each moderator)
  *@param scriptHash script hash of the transaction
  *@param uniqueId bytes20 unique id for the transaction, generated by ETH wallet
  *@param destinations address of the destination in whose favour dispute resolution is taking place. In case of split payments it will be address of the split payments contract
  *@param amounts value to send to each destination
  */
  function execute(
    uint8[] sigV,
    bytes32[] sigR,
    bytes32[] sigS,
    bytes32 scriptHash,
    bytes20 uniqueId,
    address[] destinations,
    uint256[] amounts
  )
    public
    transactionExists(scriptHash)
    inFundedState(scriptHash)
  {
    require(destinations.length>0 && destinations.length == amounts.length);

    Transaction storage t = transactions[scriptHash];

    bytes32 calculatedScriptHash = calculateRdeemScriptHash(scriptHash, uniqueId);

    require(
      scriptHash == calculatedScriptHash,
      "Calculated script hash does not match passed script hash"
    );

    address lastRecovered = verifySignatures(
      sigV,
      sigR,
      sigS,
      scriptHash,
      destinations,
      amounts
    );

    bool timeLockExpired = isTimeLockExpired(t.timeoutHours, t.lastFunded);

    //assuming threshold will always be greater than 1, else its not multisig
    if (sigV.length < t.threshold && (!timeLockExpired || lastRecovered != t.seller)) {
      revert();
    }

    transactions[scriptHash].status = Status.RELEASED;

    uint256 totalValue = transferFunds(scriptHash, destinations, amounts);

    require(
      totalValue <= transactions[scriptHash].value,
      "Total value to be sent is greater than the transaction value"
    );

    emit Executed(scriptHash, destinations, amounts);
  }

  /**
  *@dev Internal method to transfer funds to the destination addresses on the basis of transaction type
  */
  function transferFunds(
    bytes32 scriptHash,
    address[]destinations,
    uint256[]amounts
  )
    internal
    returns(uint256 valueTransferred)
  {
    Transaction storage t = transactions[scriptHash];

    if (t.transactionType == TransactionType.ETHER) {
      for (uint8 i = 0; i<destinations.length; i++) {
        require(
          destinations[i] != address(0) && t.isOwner[destinations[i]],
          "Not a valid destination"
        );
        require(amounts[i] > 0, "Amount to be sent should be greater than 0");

        valueTransferred = valueTransferred.add(amounts[i]);

        destinations[i].transfer(amounts[i]);
      }
    } else if (t.transactionType == TransactionType.TOKEN) {
      ITokenContract token = ITokenContract(t.tokenAddress);

      for (uint8 i = 0; i<destinations.length; i++) {
        require(
          destinations[i] != address(0) && t.isOwner[destinations[i]],
          "Not a valid destination"
        );
        require(amounts[i] > 0, "Amount to be sent should be greater than 0");

        valueTransferred = valueTransferred.add(amounts[i]);

        require(token.transfer(destinations[i], amounts[i]));
      }
    } else {
      //transaction type is not supported. Ideally this state should never be reached
      revert();
    }
  }

  /**
  *@dev Internal method for calculating script hash. Calculation will depend upon the type of transaction
  * ETHER Type transaction-:
  * Script Hash- keccak256(uniqueId, threshold, timeoutHours, buyer, seller, moderator)
  * TOKEN Type transaction
  * Script Hash- keccak256(uniqueId, threshold, timeoutHours, buyer, seller, moderator, tokenAddress)
  */
  function calculateRdeemScriptHash(bytes32 scriptHash, bytes20 uniqueId)
    internal
    view
    returns (bytes32 hash)
  {
    Transaction storage t = transactions[scriptHash];
    if (t.transactionType == TransactionType.ETHER) {
      hash = keccak256(abi.encodePacked(uniqueId, t.threshold, t.timeoutHours, t.buyer, t.seller, t.moderators[0], this));
    }
    else if (t.transactionType == TransactionType.TOKEN) {
      hash = keccak256(abi.encodePacked(uniqueId, t.threshold, t.timeoutHours, t.buyer, t.seller, t.moderators[0], this, t.tokenAddress));
    }
  }

  //to check whether the signature are valid or not and if consensus was reached
  //returns the last address recovered, in case of timeout this must be the sender's address
  function verifySignatures(
    uint8[] sigV,
    bytes32[] sigR,
    bytes32[] sigS,
    bytes32 scriptHash,
    address[] destinations,
    uint256[]amounts
  )
    private
    returns (address lastAddress)
  {
    require(sigR.length == sigS.length && sigR.length == sigV.length);

    // Follows ERC191 signature scheme: https://github.com/ethereum/EIPs/issues/191
    bytes32 txHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", keccak256(abi.encodePacked(byte(0x19), byte(0), this, destinations, amounts, scriptHash))));

    for (uint i = 0; i < sigR.length; i++) {
      address recovered = ecrecover(txHash, sigV[i], sigR[i], sigS[i]);

      require(
        transactions[scriptHash].isOwner[recovered],
        "Invalid signature"
      );
      require(
        !transactions[scriptHash].voted[recovered],
        "Same signature sent twice"
      );
      transactions[scriptHash].voted[recovered] = true;
      lastAddress = recovered;
    }

  }

  /**
  *@dev Returns all transaction ids for a party
  *@param _partyAddress Address of the party
  */
  function getAllTransactionsForParty(address _partyAddress)
    public
    view
    returns(bytes32[] scriptHashes)
  {
    return partyVsTransaction[_partyAddress];
  }

  function isTimeLockExpired(uint32 timeoutHours, uint256 lastFunded)
    internal
    view
    returns(bool expired)
  {
    uint256 timeSince = now.sub(lastFunded);
    expired = timeoutHours == 0?false:timeSince > uint256(timeoutHours).mul(3600000);
  }
}
