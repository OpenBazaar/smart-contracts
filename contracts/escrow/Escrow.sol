pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../token/ITokenContract.sol";


/**
* @title OpenBazaar Escrow
* @author OB1
* @notice Holds ETH and ERC20 tokens for moderated trades on the OpenBazaar
* platform. See the specification here:
* https://github.com/OpenBazaar/smart-contracts/blob/master/contracts/escrow/EscrowSpec.md
* @dev Do not use this contract with tokens that do not strictly adhere to the
* ERC20 token standard. In particular, all successful calls to `transfer` and
* `transferFrom` on the token contract MUST return true. Non-compliant tokens
* may get trapped in this contract forever. See the specification for more
* details.
*/
contract Escrow {

    using SafeMath for uint256;

    enum Status {FUNDED, RELEASED}

    enum TransactionType {ETHER, TOKEN}

    event Executed(
        bytes32 indexed scriptHash,
        address payable[] destinations,
        uint256[] amounts
    );

    event FundAdded(
        bytes32 indexed scriptHash,
        address indexed from,
        uint256 valueAdded
    );

    event Funded(
        bytes32 indexed scriptHash,
        address indexed from,
        uint256 value
    );

    struct Transaction {
        uint256 value;
        uint256 lastModified; //time txn was last modified (in seconds)
        Status status;
        TransactionType transactionType;
        uint8 threshold;
        uint32 timeoutHours;
        address buyer;
        address seller;
        address tokenAddress; //token address in case of token transfer
        address moderator;
        uint256 released;
        //Number of times execution took place. More like a nonce
        uint256 noOfReleases;
        mapping(address => bool) isOwner; //to keep track of owners.
        //to keep track of who all voted in latest transaction execution.
        //This list will be refreshed with every execution
        mapping(bytes32 => bool) voted;
        mapping(address => bool) beneficiaries; //beneficiaries of execution
    }

    mapping(bytes32 => Transaction) public transactions;

    uint256 public transactionCount = 0;

    //Contains mapping between each party and all of their transactions
    mapping(address => bytes32[]) private partyVsTransaction;

    modifier transactionExists(bytes32 scriptHash) {
        require(
            transactions[scriptHash].value != 0, "Transaction does not exist"
        );
        _;
    }

    modifier transactionDoesNotExist(bytes32 scriptHash) {
        require(transactions[scriptHash].value == 0, "Transaction exists");
        _;
    }

    modifier inFundedState(bytes32 scriptHash) {
        require(
            transactions[scriptHash].status == Status.FUNDED,
            "Transaction is not in FUNDED state"
        );
        _;
    }

    modifier fundsExist(bytes32 scriptHash) {
        require(
            transactions[scriptHash].value.sub(transactions[scriptHash].released) > 0,
            "All funds has been released"
        );
        _;
    }

    modifier nonZeroAddress(address addressToCheck) {
        require(addressToCheck != address(0), "Zero address passed");
        _;
    }

    modifier checkTransactionType(
        bytes32 scriptHash,
        TransactionType transactionType
    )
    {
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
    * @notice Registers a new OpenBazaar transaction to the contract
    * @dev To be used for moderated ETH transactions
    * @param buyer The buyer associated with the OpenBazaar transaction
    * @param seller The seller associated with the OpenBazaar transaction
    * @param moderator The moderator (if any) associated with the OpenBazaar
    * transaction
    * @param threshold The minimum number of signatures required to release
    * funds from escrow before the timeout.
    * @param timeoutHours The number hours after which the seller can
    * unilaterally release funds from escrow. When timeoutHours is set to 0
    * it means the seller can never unilaterally release funds from escrow
    * @param scriptHash The keccak256 hash of the redeem script. See
    * specification for more details
    * @param uniqueId A nonce chosen by the buyer
    * @dev This call is intended to be made by the buyer and should send the
    * amount of ETH to be put in escrow
    * @dev You MUST NOT pass a contract address for buyer, seller, or moderator
    * or else funds could be locked in this contract permanently. Releasing
    * funds from this contract require signatures that cannot be created by
    * contract addresses
    */
    function addTransaction(
        address buyer,
        address seller,
        address moderator,
        uint8 threshold,
        uint32 timeoutHours,
        bytes32 scriptHash,
        bytes20 uniqueId
    )
        external
        payable
        transactionDoesNotExist(scriptHash)
        nonZeroAddress(buyer)
        nonZeroAddress(seller)
    {
        _addTransaction(
            buyer,
            seller,
            moderator,
            threshold,
            timeoutHours,
            scriptHash,
            msg.value,
            uniqueId,
            TransactionType.ETHER,
            address(0)
        );

        emit Funded(scriptHash, msg.sender, msg.value);
    }

    /**
    * @notice Registers a new OpenBazaar transaction to the contract
    * @dev To be used for moderated ERC20 transactions
    * @param buyer The buyer associated with the OpenBazaar transaction
    * @param seller The seller associated with the OpenBazaar transaction
    * @param moderator The moderator (if any) associated with the OpenBazaar
    * transaction
    * @param threshold The minimum number of signatures required to release
    * funds from escrow before the timeout.
    * @param timeoutHours The number hours after which the seller can
    * unilaterally release funds from escrow. When timeoutHours is set to 0
    * it means the seller can never unilaterally release funds from escrow
    * @param scriptHash The keccak256 hash of the redeem script. See
    * specification for more details
    * @param value The number of tokens to be held in escrow
    * @param uniqueId A nonce chosen by the buyer
    * @param tokenAddress The address of the ERC20 token contract
    * @dev Be sure the buyer approves this contract to spend at least `value`
    * on the buyer's behalf
    * @dev You MUST NOT pass a contract address for buyer, seller, or moderator
    * or else funds could be locked in this contract permanently. Releasing
    * funds from this contract require signatures that cannot be created by
    * contract addresses
    */
    function addTokenTransaction(
        address buyer,
        address seller,
        address moderator,
        uint8 threshold,
        uint32 timeoutHours,
        bytes32 scriptHash,
        uint256 value,
        bytes20 uniqueId,
        address tokenAddress
    )
        external
        transactionDoesNotExist(scriptHash)
        nonZeroAddress(buyer)
        nonZeroAddress(seller)
        nonZeroAddress(tokenAddress)
    {
        _addTransaction(
            buyer,
            seller,
            moderator,
            threshold,
            timeoutHours,
            scriptHash,
            value,
            uniqueId,
            TransactionType.TOKEN,
            tokenAddress
        );

        ITokenContract token = ITokenContract(tokenAddress);

        emit Funded(scriptHash, msg.sender, value);

        require(
            token.transferFrom(msg.sender, address(this), value),
            "Token transfer failed, maybe you did not approve escrow contract to spend on behalf of sender"
        );
    }

    /**
    * @notice Determines whether a given address was a beneficiary of any
    * payout from the escrow associated with an OpenBazaar transaction that is
    * associated with a given scriptHash
    * @param scriptHash scriptHash associated with the OpenBazaar transaction
    * of interest
    * @param beneficiary Address to be checked
    * @return true if and only if the passed address was a beneficiary of some
    * payout from the escrow associated with `scriptHash`
    */
    function checkBeneficiary(
        bytes32 scriptHash,
        address beneficiary
    )
        external
        view
        returns (bool)
    {
        return transactions[scriptHash].beneficiaries[beneficiary];
    }

    /**
    * @notice Check whether given party has signed for funds to be released
    * from the escrow associated with a scriptHash.
    * @param scriptHash Hash identifying the OpenBazaar transaction in question
    * @param party The address we are checking
    * @return true if and only if `party` received any funds from the escrow
    * associated with `scripHash`
    */
    function checkVote(
        bytes32 scriptHash,
        address party
    )
        external
        view
        returns (bool)
    {
        bool voted = false;

        for (uint256 i = 0; i < transactions[scriptHash].noOfReleases; i++){

            bytes32 addressHash = keccak256(abi.encodePacked(party, i));

            if (transactions[scriptHash].voted[addressHash]){
                voted = true;
                break;
            }
        }

        return voted;
    }

    /**
    * @notice Allows the buyer in an OpenBazaar transaction to add more ETH to
    * an existing transaction
    * @param scriptHash The scriptHash of the OpenBazaar transaction to which
    * funds will be added
    */
    function addFundsToTransaction(
        bytes32 scriptHash
    )
        external
        payable
        transactionExists(scriptHash)
        inFundedState(scriptHash)
        checkTransactionType(scriptHash, TransactionType.ETHER)
        onlyBuyer(scriptHash)

    {
        require(msg.value > 0, "Value must be greater than zero.");

        transactions[scriptHash].value = transactions[scriptHash].value
            .add(msg.value);

        emit FundAdded(scriptHash, msg.sender, msg.value);
    }

    /**
    * @notice Allows the buyer in an OpenBazaar transaction to add more ERC20
    * tokens to an existing transaction
    * @param scriptHash The scriptHash of the OpenBazaar transaction to which
    * funds will be added
    * @param value The number of tokens to be added
    */
    function addTokensToTransaction(
        bytes32 scriptHash,
        uint256 value
    )
        external
        transactionExists(scriptHash)
        inFundedState(scriptHash)
        checkTransactionType(scriptHash, TransactionType.TOKEN)
        onlyBuyer(scriptHash)
    {
        require(value > 0, "Value must be greater than zero.");

        ITokenContract token = ITokenContract(
            transactions[scriptHash].tokenAddress
        );

        transactions[scriptHash].value = transactions[scriptHash].value
            .add(value);

        emit FundAdded(scriptHash, msg.sender, value);

        require(
            token.transferFrom(msg.sender, address(this), value),
            "Token transfer failed, maybe you did not approve the escrow contract to spend on behalf of the buyer"
        );
    }

    /**
    * @notice Returns an array of scriptHashes associated with trades in which
    * a given address was listed as a buyer or a seller
    * @param partyAddress The address to look up
    * @return an array of scriptHashes
    */
    function getAllTransactionsForParty(
        address partyAddress
    )
        external
        view
        returns (bytes32[] memory)
    {
        return partyVsTransaction[partyAddress];
    }

    /**
    * @notice This method will be used to release funds from the escrow
    * associated with an existing OpenBazaar transaction.
    * @dev please see the contract specification for more details
    * @param sigV Array containing V component of all the signatures
    * @param sigR Array containing R component of all the signatures
    * @param sigS Array containing S component of all the signatures
    * @param scriptHash ScriptHash of the transaction
    * @param destinations List of addresses who will receive funds
    * @param amounts List of amounts to be released to the destinations
    */
    function execute(
        uint8[] calldata sigV,
        bytes32[] calldata sigR,
        bytes32[] calldata sigS,
        bytes32 scriptHash,
        address payable[] calldata destinations,
        uint256[] calldata amounts
    )
        external
        transactionExists(scriptHash)
        fundsExist(scriptHash)
    {
        require(
            destinations.length > 0,
            "Number of destinations must be greater than 0"
        );
        require(
            destinations.length == amounts.length,
            "Number of destinations must match number of values sent"
        );

        _verifyTransaction(
            sigV,
            sigR,
            sigS,
            scriptHash,
            destinations,
            amounts
        );

        transactions[scriptHash].status = Status.RELEASED;
        //Last modified timestamp modified, which will be used by rewards
        // solium-disable-next-line security/no-block-members
        transactions[scriptHash].lastModified = block.timestamp;
        //Increment release conuter
        transactions[scriptHash].noOfReleases = transactions[scriptHash].
            noOfReleases.add(1);

        transactions[scriptHash].released = _transferFunds(
            scriptHash,
            destinations,
            amounts
        ).add(transactions[scriptHash].released);

        emit Executed(scriptHash, destinations, amounts);

        require(
            transactions[scriptHash].value >= transactions[scriptHash].released,
            "Value of transaction should be greater than released value"
        );
    }

    /**
    * @notice Gives the hash that the parties need to sign in order to
    * release funds from the escrow of a given OpenBazaar transactions given
    * a set of destinations and amounts
    * @param scriptHash Script hash of the OpenBazaar transaction
    * @param destinations List of addresses who will receive funds
    * @param amounts List of amounts for each destination
    * @return a bytes32 hash
    */
    function getTransactionHash(
        bytes32 scriptHash,
        address payable[] memory destinations,
        uint256[] memory amounts
    )
        public
        view
        returns (bytes32)
    {
        bytes32 releaseHash = keccak256(
            abi.encode(
                keccak256(abi.encodePacked(destinations)),
                keccak256(abi.encodePacked(amounts))
            )
        );

        // Follows ERC191 signature scheme: https://github.com/ethereum/EIPs/issues/191
        bytes32 txHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encodePacked(
                        byte(0x19),
                        byte(0),
                        address(this),
                        releaseHash,
                        transactions[scriptHash].noOfReleases,
                        scriptHash
                    )
                )
            )
        );
        return txHash;
    }

    /**
    * @notice Calculating scriptHash for a given OpenBazaar transaction
    * @param uniqueId A nonce chosen by the buyer
    * @param threshold The minimum number of signatures required to release
    * funds from escrow before the timeout.
    * @param timeoutHours The number hours after which the seller can
    * unilaterally release funds from escrow. When timeoutHours is set to 0
    * it means the seller can never unilaterally release funds from escrow
    * @param buyer The buyer associated with the OpenBazaar transaction
    * @param seller The seller associated with the OpenBazaar transaction
    * @param moderator The moderator (if any) associated with the OpenBazaar
    * transaction
    * @param tokenAddress The address of the ERC20 token contract
    * @return a bytes32 hash
    */
    function calculateRedeemScriptHash(
        bytes20 uniqueId,
        uint8 threshold,
        uint32 timeoutHours,
        address buyer,
        address seller,
        address moderator,
        address tokenAddress
    )
        public
        view
        returns (bytes32)
    {
        if (tokenAddress == address(0)) {
            return keccak256(
                abi.encodePacked(
                    uniqueId,
                    threshold,
                    timeoutHours,
                    buyer,
                    seller,
                    moderator,
                    address(this)
                )
            );
        } else {
            return keccak256(
                abi.encodePacked(
                    uniqueId,
                    threshold,
                    timeoutHours,
                    buyer,
                    seller,
                    moderator,
                    address(this),
                    tokenAddress
                )
            );
        }
    }

    /**
    * @notice This methods checks validity of a set of signatures AND whether
    * they are sufficient to release funds from escrow
    * @param sigV Array containing V component of all the signatures
    * @param sigR Array containing R component of all the signatures
    * @param sigS Array containing S component of all the signatures
    * @param scriptHash ScriptHash of the transaction
    * @param destinations List of addresses who will receive funds
    * @param amounts List of amounts to be released to the destinations
    * @dev This will revert if the set of signatures is not valid or the
    * attempted payout is not valid. It will succeed silently otherwise
    */
    function _verifyTransaction(
        uint8[] memory sigV,
        bytes32[] memory sigR,
        bytes32[] memory sigS,
        bytes32 scriptHash,
        address payable[] memory destinations,
        uint256[] memory amounts
    )
        private
    {
        _verifySignatures(
            sigV,
            sigR,
            sigS,
            scriptHash,
            destinations,
            amounts
        );

        bool timeLockExpired = _isTimeLockExpired(
            transactions[scriptHash].timeoutHours,
            transactions[scriptHash].lastModified
        );

        //if the minimum number of signatures are not gathered and either
        //timelock has not expired or transaction was not signed by seller
        //then revert
        if (sigV.length < transactions[scriptHash].threshold) {
            if (!timeLockExpired) {
                revert("Min number of sigs not present and timelock not expired");
            }
            else if (
                !transactions[scriptHash].voted[keccak256(
                    abi.encodePacked(
                        transactions[scriptHash].seller,
                        transactions[scriptHash].noOfReleases
                    )
                )]
            )
            {
                revert("Min number of sigs not present and seller did not sign");
            }
        }
    }

    /**
    * @notice Method to transfer funds to a set of destinations
    * @param scriptHash Hash identifying the OpenBazaar transaction
    * @param destinations List of addresses who will receive funds
    * @param amounts List of amounts to be released to the destinations
    * @return the total amount of funds that were paid out
    */
    function _transferFunds(
        bytes32 scriptHash,
        address payable[] memory destinations,
        uint256[] memory amounts
    )
        private
        returns (uint256)
    {
        Transaction storage t = transactions[scriptHash];

        uint256 valueTransferred = 0;

        if (t.transactionType == TransactionType.ETHER) {
            for (uint256 i = 0; i < destinations.length; i++) {

                require(
                    destinations[i] != address(0),
                    "zero address is not allowed as destination address"
                );

                require(
                    t.isOwner[destinations[i]],
                    "Destination address is not one of the owners"
                );

                require(
                    amounts[i] > 0,
                    "Amount to be sent should be greater than 0"
                );

                valueTransferred = valueTransferred.add(amounts[i]);

                //add receiver as beneficiary
                t.beneficiaries[destinations[i]] = true;
                destinations[i].transfer(amounts[i]);
            }

        } else if (t.transactionType == TransactionType.TOKEN) {

            ITokenContract token = ITokenContract(t.tokenAddress);

            for (uint256 j = 0; j < destinations.length; j++) {

                require(
                    destinations[j] != address(0),
                    "zero address is not allowed as destination address"
                );

                require(
                    t.isOwner[destinations[j]],
                    "Destination address is not one of the owners"
                );

                require(
                    amounts[j] > 0,
                    "Amount to be sent should be greater than 0"
                );

                valueTransferred = valueTransferred.add(amounts[j]);

                //add receiver as beneficiary
                t.beneficiaries[destinations[j]] = true;

                require(
                    token.transfer(destinations[j], amounts[j]),
                    "Token transfer failed."
                );
            }
        }
        return valueTransferred;
    }

    /**
    * @notice Checks whether a given set of signatures are valid
    * @param sigV Array containing V component of all the signatures
    * @param sigR Array containing R component of all the signatures
    * @param sigS Array containing S component of all the signatures
    * @param scriptHash ScriptHash of the transaction
    * @param destinations List of addresses who will receive funds
    * @param amounts List of amounts to be released to the destinations
    * @dev This also records which addresses have successfully signed
    * @dev This function SHOULD NOT be called by ANY function other than
    * `_verifyTransaction`
    */
    function _verifySignatures(
        uint8[] memory sigV,
        bytes32[] memory sigR,
        bytes32[] memory sigS,
        bytes32 scriptHash,
        address payable[] memory destinations,
        uint256[] memory amounts
    )
        private
    {
        require(sigR.length == sigS.length, "R,S length mismatch");
        require(sigR.length == sigV.length, "R,V length mismatch");

        bytes32 txHash = getTransactionHash(
            scriptHash,
            destinations,
            amounts
        );

        for (uint256 i = 0; i < sigR.length; i++) {

            address recovered = ecrecover(
                txHash,
                sigV[i],
                sigR[i],
                sigS[i]
            );

            bytes32 addressHash = keccak256(
                abi.encodePacked(
                    recovered,
                    transactions[scriptHash].noOfReleases
                )
            );

            require(
                transactions[scriptHash].isOwner[recovered],
                "Invalid signature"
            );
            require(
                !transactions[scriptHash].voted[addressHash],
                "Same signature sent twice"
            );
            transactions[scriptHash].voted[addressHash] = true;
        }
    }

    /**
    * @notice Checks whether a timeout has occured
    * @param timeoutHours The number hours after which the seller can
    * unilaterally release funds from escrow. When `timeoutHours` is set to 0
    * it means the seller can never unilaterally release funds from escrow
    * @param lastModified The timestamp of the last modification of escrow for
    * a particular OpenBazaar transaction
    * @return true if and only if `timeoutHours` hours have passed since
    * `lastModified`
    */
    function _isTimeLockExpired(
        uint32 timeoutHours,
        uint256 lastModified
    )
        private
        view
        returns (bool)
    {
        // solium-disable-next-line security/no-block-members
        uint256 timeSince = block.timestamp.sub(lastModified);
        return (
            timeoutHours == 0 ? false : timeSince > uint256(timeoutHours).mul(1 hours)
        );
    }

    /**
    * @dev Private method for adding a new OpenBazaar transaction to the
    * contract. Used to reduce code redundancy
    * @param buyer The buyer associated with the OpenBazaar transaction
    * @param seller The seller associated with the OpenBazaar transaction
    * @param moderator The moderator (if any) associated with the OpenBazaar
    * transaction
    * @param threshold The minimum number of signatures required to release
    * funds from escrow before the timeout.
    * @param timeoutHours The number hours after which the seller can
    * unilaterally release funds from escrow. When timeoutHours is set to 0
    * it means the seller can never unilaterally release funds from escrow
    * @param scriptHash The keccak256 hash of the redeem script. See
    * specification for more details
    * @param value The amount of currency to add to escrow
    * @param uniqueId A nonce chosen by the buyer
    * @param transactionType Indicates whether the OpenBazaar trade is using
    * ETH or ERC20 tokens for payment
    * @param tokenAddress The address of the ERC20 token being used for
    * payment. Set to 0 if the OpenBazaar transaction is settling in ETH
    */
    function _addTransaction(
        address buyer,
        address seller,
        address moderator,
        uint8 threshold,
        uint32 timeoutHours,
        bytes32 scriptHash,
        uint256 value,
        bytes20 uniqueId,
        TransactionType transactionType,
        address tokenAddress
    )
        private
    {
        require(buyer != seller, "Buyer and seller are same");

        //value passed should be greater than 0
        require(value > 0, "Value passed is 0");

        // For now allowing 0 moderator to support 1-2 multisig wallet
        require(threshold > 0, "Threshold must be greater than 0");
        require(threshold <= 3, "Threshold must not be greater than 3");

        //if threshold is 1 then moderator can be any address
        //otherwise moderator should be a valid address
        require(
            threshold == 1 || moderator != address(0),
            "Either threshold should be 1 or valid moderator address should be passed"
        );

        require(
            scriptHash == calculateRedeemScriptHash(
                uniqueId,
                threshold,
                timeoutHours,
                buyer,
                seller,
                moderator,
                tokenAddress
            ),
            "Calculated script hash does not match passed script hash."
        );

        transactions[scriptHash] = Transaction({
            buyer: buyer,
            seller: seller,
            moderator: moderator,
            value: value,
            status: Status.FUNDED,
            // solium-disable-next-line security/no-block-members
            lastModified: block.timestamp,
            threshold: threshold,
            timeoutHours: timeoutHours,
            transactionType:transactionType,
            tokenAddress:tokenAddress,
            released: uint256(0),
            noOfReleases: uint256(0)
        });

        transactions[scriptHash].isOwner[seller] = true;
        transactions[scriptHash].isOwner[buyer] = true;

        //check if buyer or seller are not passed as moderator
        require(
            !transactions[scriptHash].isOwner[moderator],
            "Either buyer or seller is passed as moderator"
        );

        //set moderator as one of the owners only if threshold is greater than
        // 1 otherwise only buyer and seller should be able to release funds
        if (threshold > 1) {
            transactions[scriptHash].isOwner[moderator] = true;
        }

        transactionCount++;

        partyVsTransaction[buyer].push(scriptHash);
        partyVsTransaction[seller].push(scriptHash);
    }
}
