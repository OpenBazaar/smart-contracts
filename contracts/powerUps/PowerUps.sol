/* solium-disable security/no-block-members */

pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/lifecycle/Pausable.sol";


/**
* @dev 'Powering-up a listing' is spending ETH to advertise a
* listing in one of the OpenBazaar clients.
*/
contract PowerUps is Pausable {

    using SafeMath for uint256;

    address payable payoutAddress; // address that will receive funds

    struct PowerUp {
        string contentAddress; // IPFS/IPNS address, peerID, etc
        uint256 amount; // total ETH spent towards this PowerUp
        uint256 lastTopupTime; // last time ETH was added to this PowerUp
        bytes32 keyword; // search term, reserved keyword, etc
    }

    PowerUp[] powerUps; // stores PowerUps

    mapping(bytes32 => uint256[]) keywordVsPowerUpIds;

    event NewPowerUpAdded(
        address indexed initiator,
        uint256 id, // the index of this PowerUp in the powerUps[] array
        uint256 amount
    );

    event Topup(
        address indexed initiator,
        uint256 id, // the index of the PowerUp in the powerUps[] array
        uint256 amount
    );

    modifier powerUpExists(uint256 id) {
        require(id <= powerUps.length.sub(1), "PowerUp does not exists");
        _;
    }

    modifier nonZeroAddress(address addressToCheck) {
        require(addressToCheck != address(0), "Zero address passed");
        _;
    }

    constructor(
        address payable _payoutAddress
    )
        public
        nonZeroAddress(_payoutAddress)
    {
        payoutAddress = _payoutAddress;
    }

    /**
    * @dev Add new PowerUp
    * @param contentAddress IPFS/IPNS address, peerID, etc
    * @param keyword Bytes32 search term, reserved keyword, etc
    * @return id Index of the PowerUp in the powerUps[] array
    */
    function addPowerUp(
        string calldata contentAddress,
        bytes32 keyword
    )
        external
        payable
        whenNotPaused
        returns (uint256 id)
    {
        require(bytes(contentAddress).length > 0, "Content Address is empty");
        id = _addPowerUp(contentAddress, msg.value, keyword);

        return id;
    }

    /**
    * @dev Add multiple PowerUps for different keywords but the same
    * content address
    * This is intended to be used for associating a given contentAddress with
    * multiple search keywords by batching the PowerUps together. This is
    * simply to allow the creation of multiple PowerUps with a single function
    * call.
    * @param contentAddress IPFS/IPNS address of the listing
    * @param amounts Amount of ETH to be spent for each PowerUp
    * @param keywords Keywords in bytes32 form for each PowerUp
    * Be sure to keep arrays small enough so as not to exceed the block gas
    * limit.
    */
    function addPowerUps(
        string calldata contentAddress,
        uint256[] calldata amounts,
        bytes32[] calldata keywords
    )
        external
        payable
        whenNotPaused
        returns (uint256[] memory ids)
    {

        require(
            bytes(contentAddress).length > 0,
            "Content Address is empty"
        );

        require(
            amounts.length == keywords.length,
            "keywords and amounts length mismatch"
        );

        ids = new uint256[](amounts.length);

        uint256 amountsTotal = 0;

        for (uint256 i = 0; i < amounts.length; i++) {
            ids[i] = _addPowerUp(contentAddress, amounts[i], keywords[i]);
            amountsTotal = amountsTotal.add(amounts[i]);
        }

        require(
            amountsTotal == msg.value,
            "Total of amounts[] must equal the amount of ETH sent"
        );

        return ids;
    }

    /**
    * @dev Topup a PowerUp's balance (that is, spend more ETH in association
    * with an existing PowerUp)
    * @param id The index of the PowerUp in the powerUps array
    */
    function topUpPowerUp(
        uint256 id
    )
        external
        payable
        whenNotPaused
        powerUpExists(id)
    {
        require(
            msg.value > 0,
            "Amount of ETH sent should be greater than 0"
        );

        powerUps[id].amount = powerUps[id].amount.add(msg.value);

        powerUps[id].lastTopupTime = block.timestamp;

        emit Topup(msg.sender, id, msg.value);
    }

    /**
    * @dev Allows anyone to transfer the contract's funds to the payoutAddress
    */
    function withdrawFunds() external {
        payoutAddress.transfer(address(this).balance);
    }

    /**
    * @dev Returns info about a given PowerUp
    * @param id The index of the PowerUp in the powerUps array
    */
    function getPowerUpInfo(
        uint256 id
    )
        external
        view
        returns (
            string memory contentAddress,
            uint256 amount,
            uint256 lastTopupTime,
            bytes32 keyword
        )
    {
        require(id < powerUps.length, "invalid id passed");

        PowerUp storage powerUp = powerUps[id];
        contentAddress = powerUp.contentAddress;
        amount = powerUp.amount;
        lastTopupTime = powerUp.lastTopupTime;
        keyword = powerUp.keyword;

        return (contentAddress, amount, lastTopupTime, keyword);

    }

    /**
    * @dev returns how many powerups are available for the given keyword
    * @param keyword Keyword for which the result needs to be fetched
    */
    function noOfPowerUps(bytes32 keyword)
        external
        view
        returns (uint256 count)
    {
        count = keywordVsPowerUpIds[keyword].length;

        return count;
    }

    /**
    * @dev returns the id (index in the powerUps[] array) of the PowerUp
    * refered to by the `index`th element of a given `keyword` array.
    * ie: getPowerUpIdAtIndex("shoes",23) will return the id of the 23rd
    * PowerUp that spent ETH in association with the keyword "shoes".
    * @param keyword Keyword string for which the PowerUp ids will be fetched
    * @param index Index at which id of the PowerUp needs to be fetched
    */
    function getPowerUpIdAtIndex(
        bytes32 keyword,
        uint256 index
    )
        external
        view
        returns (uint256 id)
    {

        require(
            keywordVsPowerUpIds[keyword].length > index,
            "Array index out of bounds"
        );

        id = keywordVsPowerUpIds[keyword][index];

        return id;
    }

    /**
    * @dev This method will return an array of ids of PowerUps associated with
    * the given keyword
    * @param keyword The keyword for which the array of PowerUps will be fetched
    */
    function getPowerUpIds(bytes32 keyword)
        external
        view
        returns (uint256[] memory ids)
    {

        ids = keywordVsPowerUpIds[keyword];

        return ids;

    }

    //private helper
    function _addPowerUp(
        string memory contentAddress,
        uint256 amount,
        bytes32 keyword
    )
        private
        returns (uint256 id)
    {

        require(
            amount > 0,
            "Amount of ETH should be greater than 0"
        );

        powerUps.push(
            PowerUp({
                contentAddress: contentAddress,
                amount: amount,
                lastTopupTime: block.timestamp,
                keyword: keyword
            })
        );

        keywordVsPowerUpIds[keyword].push(powerUps.length.sub(1));

        emit NewPowerUpAdded(msg.sender, powerUps.length.sub(1), amount);

        id = powerUps.length.sub(1);

        return id;
    }
}
