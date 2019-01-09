/* solium-disable security/no-block-members */

pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "../token/ITokenContract.sol";


/**
* @dev 'Powering-up a listing' is spending OpenBazaar tokens to advertise a
* listing in one of the OpenBazaar clients.
*/
contract PowerUps {

    using SafeMath for uint256;

    ITokenContract public token;

    struct PowerUp {
        string contentAddress; // IPFS/IPNS address, peerID, etc
        uint256 tokensBurned; // total tokens burned towards this PowerUp
        uint256 lastTopupTime; // last time tokens were burned for this PowerUp
        bytes32 keyword; // search term, reserved keyword, etc
    }

    PowerUp[] powerUps; // stores PowerUps

    mapping(bytes32 => uint256[]) keywordVsPowerUpIds;

    event NewPowerUpAdded(
        address indexed initiator,
        uint256 id, // the index of this PowerUp in the powerUps[] array
        uint256 tokensBurned
    );

    event Topup(
        address indexed initiator,
        uint256 id, // the index of the PowerUp in the powerUps[] array
        uint256 tokensBurned
    );

    modifier powerUpExists(uint256 id) {
        require(id <= powerUps.length.sub(1), "PowerUp does not exists");
        _;
    }

    modifier nonZeroAddress(address addressToCheck) {
        require(addressToCheck != address(0), "Zero address passed");
        _;
    }

    constructor(address obTokenAddress) public nonZeroAddress(obTokenAddress) {
        token = ITokenContract(obTokenAddress);
    }

    /**
    * @dev Add new PowerUp
    * @param contentAddress IPFS/IPNS address, peerID, etc
    * @param amount Amount of tokens to burn
    * @param keyword Bytes32 search term, reserved keyword, etc
    * @return id Index of the PowerUp in the powerUps[] array
    */
    function addPowerUp(
        string contentAddress,
        uint256 amount,
        bytes32 keyword
    )
        external
        returns (uint256 id)
    {

        require(bytes(contentAddress).length > 0, "Content Address is empty");
        id = _addPowerUp(contentAddress, amount, keyword);

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
    * @param amounts Amount of tokens to be burnt for each PowerUp
    * @param keywords Keywords in bytes32 form for each PowerUp
    * Be sure to keep arrays small enough so as not to exceed the block gas
    * limit.
    */
    function addPowerUps(
        string contentAddress,
        uint256[] amounts,
        bytes32[] keywords
    )
        external
        returns (uint256[] ids)
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

        for (uint256 i = 0; i < amounts.length; i++) {
            ids[i] = _addPowerUp(contentAddress, amounts[i], keywords[i]);
        }

        return ids;
    }

/**
    * @dev Topup a PowerUp's balance (that is, burn more tokens in association
    * with am existing PowerUp)
    * @param id The index of the PowerUp in the powerUps array
    * @param amount Amount of tokens to burn
    */
    function topUpPowerUp(
        uint256 id,
        uint256 amount
    )
        external
        powerUpExists(id)
    {

        require(
            amount > 0,
            "Amount of tokens to burn should be greater than 0"
        );

        powerUps[id].tokensBurned = powerUps[id].tokensBurned.add(amount);

        powerUps[id].lastTopupTime = block.timestamp;

        token.burnFrom(msg.sender, amount);

        emit Topup(msg.sender, id, amount);
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
            string contentAddress,
            uint256 tokensBurned,
            uint256 lastTopupTime,
            bytes32 keyword
        )
    {
        if (powerUps.length > id) {

            PowerUp storage powerUp = powerUps[id];

            contentAddress = powerUp.contentAddress;
            tokensBurned = powerUp.tokensBurned;
            lastTopupTime = powerUp.lastTopupTime;
            keyword = powerUp.keyword;

        }

        return (contentAddress, tokensBurned, lastTopupTime, keyword);
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
    * PowerUp that burned tokens in association with the keyword "shoes".
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
        returns (uint256[] ids)
    {

        ids = keywordVsPowerUpIds[keyword];

        return ids;

    }

    //private helper
    function _addPowerUp(
        string contentAddress,
        uint256 amount,
        bytes32 keyword
    )
        private
        returns (uint256 id)
    {

        require(
            amount > 0,
            "Amount of tokens to burn should be greater than 0"
        );

        powerUps.push(
            PowerUp({
                contentAddress:contentAddress,
                tokensBurned:amount,
                lastTopupTime:block.timestamp,
                keyword: keyword
            })
        );

        keywordVsPowerUpIds[keyword].push(powerUps.length.sub(1));

        token.burnFrom(msg.sender, amount);

        emit NewPowerUpAdded(msg.sender, powerUps.length.sub(1), amount);

        id = powerUps.length.sub(1);

        return id;
    }
}
