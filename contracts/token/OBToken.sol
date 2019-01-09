pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Burnable.sol";


contract OBToken is ERC20Burnable {

    string public name;
    string public symbol;
    uint8 public decimals;

    constructor(
        string _name,
        string _symbol,
        uint8 _decimals, 
        uint256 _totalSupply
    )
        public
    {

        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        _mint(msg.sender, _totalSupply * (10 ** uint256(decimals)));
    }

}
