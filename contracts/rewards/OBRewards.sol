/* solium-disable security/no-block-members */

pragma solidity 0.5.7;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "../token/ITokenContract.sol";
import "../escrow/IEscrow.sol";


/**
* @dev This contract will distribute tokens to the buyers who purchase items from
* the OB verified sellers
* For more information please visit below mentioned link
* https://github.com/OB1Company/openbazaar-smart-contracts/issues/10
*/
contract OBRewards is Ownable {

    using SafeMath for uint256;

    //Mapping of promoted sellers
    mapping(address => bool) public promotedSellers;

    uint256 public maxRewardPerSeller;

    uint256 public maxRewardToBuyerPerSeller;

    uint256 public totalTokensDistributed;

    //A time window in seconds where purchases between A and B will be
    //rewarded with tokens. Ie if a trade is completed satisfactorily at
    //time X, then the buyer can claim their reward any time after X and
    //before X + timeWindow.
    uint256 public timeWindow;

    //Mapping of seller to all buyers who received rewards by purchasing
    //from that seller.
    mapping(address => address[]) sellerVsBuyersArray;

    //Mapping of seller and buyer to a bool indicating whether the buyers has
    //claimed any rewards from that seller.
    mapping(address => mapping(address => bool)) sellerVsBuyersBool;

    //Given a seller and a buyer, this will return the amount of tokens that
    //have been rewarded to the buyer for purchasing from the seller.
    mapping(address => mapping(address => uint256)) sellerVsBuyerRewards;

    //For each seller, this returns the total number of tokens that have been
    //given out as rewards for purchasing from that seller.
    mapping(address => uint256) sellerVsRewardsDistributed;

    //Escrow contract address which will be used to calculate and validate
    //transactions
    IEscrow public escrowContract;

    //Address of the reward Token to be distributed to the buyers
    ITokenContract public obToken;

    //Bool to signify whether reward distribution is active or not
    bool public rewardsOn;

    //End date of the promotion
    uint256 public endDate;

    event SuccessfulClaim(
        bytes32 indexed scriptHash,
        address indexed seller,
        address indexed buyer,
        uint256 amount
    );

    event UnsuccessfulClaim(
        bytes32 indexed scriptHash,
        address indexed seller,
        address indexed buyer
    );

    event PromotedSellersAdded(address[] seller);

    event PromotedSellersRemoved(address[] seller);

    event RewardsOn();

    event EndDateChanged(uint256 endDate);

    modifier nonZeroAddress(address _address) {
        require(_address != address(0), "Zero address not allowed");
        _;
    }

    modifier rewardsRunning() {
        require(
            rewardsOn && (endDate > block.timestamp),
            "Reward distribution is not running"
        );
        _;
    }

    /**
    * @dev Add details to rewards contract at the time of deployment
    * @param _maxRewardPerSeller Maximum reward to be distributed from
    * each seller
    * @param _timeWindow A time window, in seconds, where purchases
    * will be rewarded with tokens
    * @param _escrowContractAddress Escrow address to be considered for
    * rewards distribution.
    * @param obTokenAddress Address of the reward token
    */
    constructor(
        uint256 _maxRewardPerSeller,
        uint256 _timeWindow,
        address _escrowContractAddress, // this should be a trusted contract
        address obTokenAddress
    )
        public
        nonZeroAddress(_escrowContractAddress)
        nonZeroAddress(obTokenAddress)
    {

        require(
            _maxRewardPerSeller > 0,
            "Maximum reward must be greater than 0"
        );

        require(
            _timeWindow > 0,
            "Time window must be greater than 0"
        );

        maxRewardPerSeller = _maxRewardPerSeller;
        timeWindow = _timeWindow;
        escrowContract = IEscrow(_escrowContractAddress);
        obToken = ITokenContract(obTokenAddress);
        maxRewardToBuyerPerSeller = uint256(50).mul(
            10 ** uint256(obToken.decimals())
        );

    }

    /**
    * @dev Allows owner to add new promoted sellers. Previous ones will
    * remain untouched
    * @param sellers List of sellers to be marked as promoted
    * No Seller out of this list should already be promoted, otherwise
    * transaction will fail
    */
    function addPromotedSellers(
        address[] calldata sellers
    ) 
        external 
        onlyOwner 
    {

        for (uint256 i = 0; i < sellers.length; i++) {
            require(
                sellers[i] != address(0),
                "Zero address cannot be a promoted seller"
            );

            require(
                !promotedSellers[sellers[i]],
                "One of the sellers is already promoted"
            ); //Also protects against the same being address passed twice.

            promotedSellers[sellers[i]] = true;
        }
        emit PromotedSellersAdded(sellers);
    }

    /**
    * @dev Remove exisiting promoted sellers
    * @param sellers List of sellers to be removed
    */
    function removePromotedSellers(
        address[] calldata sellers
    ) 
        external 
        onlyOwner 
    {

        for (uint256 i = 0; i < sellers.length; i++) {

            promotedSellers[sellers[i]] = false;
        }
        emit PromotedSellersRemoved(sellers);
    }

    /**
    * @dev Returns list of buyers that have been rewarded for purchasing from
    * a given seller
    * @param seller Address of promoted seller
    * @return buyers List of Buyers
    */
    function getRewardedBuyers(
        address seller
    )
        external
        view
        returns (address[] memory buyers)
    {
        buyers = sellerVsBuyersArray[seller];
        return buyers;
    }

    /**
    * @dev Return reward info for a buyer against a promoted seller
    * @param seller Address of promoted seller
    * @param buyer The buyer who reward info has to be fetched
    * @return rewardAmount
    */
    function getBuyerRewardInfo(
        address seller,
        address buyer
    )
        external
        view
        returns(
            uint256 rewardAmount
        )
    {
        return sellerVsBuyerRewards[seller][buyer];
    }

    /**
    * @dev Total reward distributed for a promoted seller so far
    * @param seller Promoted seller's address
    * @return Amount of tokens distributed as reward for a seller
    */
    function getDistributedReward(
        address seller
    )
        external
        view
        returns (uint256 rewardDistributed)
    {
        rewardDistributed = sellerVsRewardsDistributed[seller];
        return rewardDistributed;
    }

    /**
    * @dev Allows the owner of the contract to transfer all remaining tokens to
    * an address of their choosing.
    * @param receiver The receiver's address
    */
    function transferRemainingTokens(
        address receiver
    )
        external
        onlyOwner
        nonZeroAddress(receiver)
    {
        uint256 amount = obToken.balanceOf(address(this));

        obToken.transfer(receiver, amount);
    }

    /**
    * @dev Method to allow the owner to adjust the maximum reward per seller
    * @param _maxRewardPerSeller Max reward to be distributed for each seller
    */
    function changeMaxRewardPerSeller(
        uint256 _maxRewardPerSeller
    )
        external
        onlyOwner
    {
        maxRewardPerSeller = _maxRewardPerSeller;
    }

    /**
    * @dev Method to allow the owner to change the timeWindow variable
    * @param _timeWindow A time window in seconds
    */
    function changeTimeWindow(uint256 _timeWindow) external onlyOwner {
        timeWindow = _timeWindow;
    }

    /**
    * @dev Returns the number of rewarded buyers associated with a given seller
    * @param seller Address of the promoted seller
    */
    function noOfRewardedBuyers(
        address seller
    )
        external
        view
        returns (uint256 size)
    {
        size = sellerVsBuyersArray[seller].length;
        return size;
    }

    /**
    * @dev Method to get rewarded buyer address at specific index for a seller
    * @param seller Seller for whom the rewarded buyer is requested
    * @param index Index at which buyer has to be retrieved
    */
    function getRewardedBuyer(
        address seller,
        uint256 index
    )
        external
        view
        returns (address buyer)
    {
        require(
            sellerVsBuyersArray[seller].length > index,
            "Array index out of bound"
        );
        buyer = sellerVsBuyersArray[seller][index];
        return buyer;
    }

    /**
    * @dev Allows the owner of the contract to turn on the rewards distribution
    * Only if it was not previously turned on
    */
    function turnOnRewards() external onlyOwner {
        require(!rewardsOn, "Rewards distribution is already on");

        rewardsOn = true;

        emit RewardsOn();
    }

    /**
    * @dev ALlows owner to set endDate
    * @param _endDate date the promotion ends
    */
    function setEndDate(uint256 _endDate) external onlyOwner {
        require(
            _endDate > block.timestamp,
            "End date should be greater than current date"
        );

        endDate = _endDate;

        emit EndDateChanged(endDate);
    }

    function isRewardsRunning() external view returns (bool running) {
        running = rewardsOn && (endDate > block.timestamp);
        return running;
    }

    /**
    * @dev Buyer can call this method to calculate the reward for their
    * transaction
    * @param scriptHash Script hash of the transaction
    */
    function calculateReward(
        bytes32 scriptHash
    )
        public
        view
        returns (uint256 amount)
    {
        (
            address buyer,
            address seller,
            uint8 status,
            uint256 lastModified
        ) = _getTransaction(scriptHash);

        amount = _getTokensToReward(
            scriptHash,
            buyer,
            seller,
            status,
            lastModified
        );

        return amount;
    }

    /**
    * @dev Using this method user can choose to execute their transaction and
    * claim their rewards in one go. This will save one transaction.
    * Users can only use this method if their trade is using escrowContract
    * for escrow.
    * See the execute() method Escrow.sol for more information.
    */
    function executeAndClaim(
        uint8[] memory sigV,
        bytes32[] memory sigR,
        bytes32[] memory sigS,
        bytes32 scriptHash,
        address[] memory destinations,
        uint256[] memory amounts
    )
        public
        rewardsRunning

    {
        //1. Execute transaction
        //SECURITY NOTE: `escrowContract` is a known and trusted contract, but
        //the `execute` function transfers ETH or Tokens, and therefore hands
        //over control of the logic flow to a potential attacker.
        escrowContract.execute(
            sigV,
            sigR,
            sigS,
            scriptHash,
            destinations,
            amounts
        );

        //2. Claim Reward
        bytes32[] memory scriptHashes = new bytes32[](1);
        scriptHashes[0] = scriptHash;

        claimRewards(scriptHashes);
    }

    /**
    * @dev Function to claim tokens
    * @param scriptHashes Array of scriptHashes of OB trades for which
    * the buyer wants to claim reward tokens.
    * Note that a Buyer can perform trades with multiple promoted sellers and
    * then can claim their reward tokens all at once for all those trades using
    * this function.
    * Be mindful of the block gas limit (do not pass too many scripthashes).
    */
    function claimRewards(
        bytes32[] memory scriptHashes
    ) 
        public 
        rewardsRunning 
    {

        require(scriptHashes.length > 0, "No script hash passed");

        for (uint256 i = 0; i < scriptHashes.length; i++) {

            //1. Get the transaction from Escrow contract
            (
                address buyer,
                address seller,
                uint8 status,
                uint256 lastModified
            ) = _getTransaction(scriptHashes[i]);

            //2. Check that the transaction exists
            //3. Check seller is promoted seller and the
            //timeWindow has not closed
            //4. Get the number of tokens to be given as reward
            //5. The seller must be one of the beneficiaries
            uint256 rewardAmount = _getTokensToReward(
                scriptHashes[i],
                buyer,
                seller,
                status,
                lastModified
            );

            uint256 contractBalance = obToken.balanceOf(address(this));

            if (rewardAmount > contractBalance) {
                rewardAmount = contractBalance;
            }

            if (rewardAmount == 0) {
                emit UnsuccessfulClaim(scriptHashes[i], seller, buyer);
                continue;
            }

            //6. Update state
            if (!sellerVsBuyersBool[seller][buyer]) {
                sellerVsBuyersBool[seller][buyer] = true;
                sellerVsBuyersArray[seller].push(buyer);
            }

            sellerVsBuyerRewards[seller][buyer] = sellerVsBuyerRewards[
                seller
            ][
                buyer
            ].add(rewardAmount);

            sellerVsRewardsDistributed[seller] = sellerVsRewardsDistributed[
                seller
            ].add(rewardAmount);

            totalTokensDistributed = totalTokensDistributed.add(rewardAmount);

            //7. Emit event
            emit SuccessfulClaim(
                scriptHashes[i],
                seller,
                buyer,
                rewardAmount
            );

            //8. Transfer token
            obToken.transfer(buyer, rewardAmount);
        }

    }

    //Private method to get transaction info out from the escrow contract
    function _getTransaction(
        bytes32 _scriptHash
    )
        private
        view
        returns(
            address buyer,
            address seller,
            uint8 status,
            uint256 lastModified
        )
        {
        // calling a trusted contract's view function
        (
            ,
            lastModified,
            status,
            ,,,
            buyer,
            seller,

        ) = escrowContract.transactions(_scriptHash);

        return (buyer, seller, status, lastModified);
    }

    /**
    * @dev Checks -:
    * 1. If transaction exists
    * 2. If seller is promoted
    * 3. Transaction has been closed/released
    * 4. Transaction happened with the time window.
    * 5. Seller must be one of the beneficiaries of the transaction execution
    * @param scriptHash Script hash of the transaction
    * @param buyer Buyer in the transaction
    * @param seller Seller in the transaction
    * @param status Status of the transaction
    * @param lastModified Last modified time of the transaction
    * @return bool Returns whether transaction is valid and eligible
    * for rewards
    */
    function _verifyTransactionData(
        bytes32 scriptHash,
        address buyer,
        address seller,
        uint8 status,
        uint256 lastModified
    )
        private
        view
        returns (bool verified)
    {

        verified = true;

        if (buyer == address(0)) {
            //If buyer is a zero address then we treat the transaction as
            //a not verified
            verified = false;
        }

        else if (!promotedSellers[seller]) {
            //seller of the transaction is not a promoted seller
            verified = false;
        }
        else if (status != 1) {
            //Transaction has not been released
            verified = false;
        }
        else if (
            //Calling a trusted contract's view function
            !escrowContract.checkVote(scriptHash, seller)
        )
        {
            //Seller was not one of the signers
            verified = false;
        }
        else if (
            //Calling a trusted contract's view function
            !escrowContract.checkBeneficiary(scriptHash, seller)
        ) {
            //Seller was not one of the beneficiaries.
            //This means the transaction was either cancelled or
            //completely refunded.
            verified = false;
        }
        else if (lastModified.add(timeWindow) < block.timestamp) {
            //timeWindow has been exceeded
            verified = false;
        }

        return verified;
    }

    /**
    * @dev Private function to get Tokens to be distributed as reward
    * Checks whether transaction is verified or not and computes the
    * amount of the rewards using the _calculateReward() method
    */
    function _getTokensToReward(
        bytes32 scriptHash,
        address buyer,
        address seller,
        uint8 status,
        uint256 lastModified
    )
        private
        view
        returns (uint256 amount)
    {

        if (
            !_verifyTransactionData(
                scriptHash,
                buyer,
                seller,
                status,
                lastModified
            )
        )
        {
            amount = 0;
        }

        else {
            amount = _calculateReward(buyer, seller);
        }

        return amount;
    }

    /**
    * @dev Private function to calculate reward.
    * Please see link for rewards calculation algo
    *  https://github.com/OB1Company/openbazaar-smart-contracts/issues/10
    */
    function _calculateReward(
        address buyer,
        address seller
    )
        private
        view
        returns (uint256 amount)
    {

        if (sellerVsRewardsDistributed[seller] >= maxRewardPerSeller) {
            //No more rewards can be distributed for buying from the
            //given seller
            amount = 0;
          }

        else {
            //maxRewardToBuyerPerSeller tokens will be given to each buyer per
            //seller until the maximum amount of rewards for the seller has
            //been exhausted
            amount = maxRewardToBuyerPerSeller.sub(sellerVsBuyerRewards[seller][buyer]);

            //Check that we are not disbursing more rewards than are
            //allocated per seller
            if (sellerVsRewardsDistributed[seller].add(amount) > maxRewardPerSeller) {
                amount = maxRewardPerSeller.sub(sellerVsRewardsDistributed[seller]);
            }

        }

        return amount;

    }


}
