pragma solidity 0.5.4;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


contract Airdrop is Ownable {

    using SafeMath for uint256;

    IERC20 public token;

    constructor(address _tokenAddress)public {
        require(_tokenAddress != address(0));

        token = IERC20(_tokenAddress);
    }

    function multisend(
        address[] calldata dests,
        uint256[] calldata values
    )
        external
        onlyOwner
    {
        require(
            dests.length == values.length,
            "Number of addresses and values should be same"
        );

        for (uint256 i = 0; i<dests.length; i = i.add(1)) {
            require(
                token.transferFrom(msg.sender, dests[i], values[i])
            );
        }
    }
}