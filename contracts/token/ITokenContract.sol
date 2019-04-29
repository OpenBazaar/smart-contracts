pragma solidity 0.5.7;

interface ITokenContract {
    function balanceOf(address _owner) external view returns (uint256 balance);

    function transfer(
        address _to,
        uint256 _amount
    )
        external
        returns (bool success);

    function transferFrom(
        address _from,
        address _to,
        uint256 _amount
    )
        external
        returns (bool success);

    function burnFrom(address from, uint256 _amount) external;

    function approve(address spender, uint256 value) external returns (bool);

    function decimals() external view returns (uint8);
}
