pragma solidity 0.4.24;

interface IEscrow {

    function transactions(
        bytes32 _scriptHash
    )
        external view
        returns(
            uint256 value,
            uint256 lastModified,
            uint8 status,
            uint8 transactionType,
            uint8 threshold,
            uint32 timeoutHours,
            address buyer,
            address seller,
            address tokenAddress
        );

    function addTransaction(
        address _buyer,
        address _seller,
        address _moderator,
        uint8 threshold,
        uint32 timeoutHours,
        bytes32 scriptHash,
        bytes20 uniqueId
    )
        external payable;

    function addTokenTransaction(
        address _buyer,
        address _seller,
        address _moderator,
        uint8 threshold,
        uint32 timeoutHours,
        bytes32 scriptHash,
        uint256 value,
        bytes20 uniqueId,
        address _tokenAddress
    )
        external;

    function addFundsToTransaction(bytes32 scriptHash)external payable;

    function addTokensToTransaction(bytes32 scriptHash, uint256 value)external;

    function execute(
        uint8[] sigV,
        bytes32[] sigR,
        bytes32[] sigS,
        bytes32 scriptHash,
        address[] destinations,
        uint256[] amounts
    )
        external;

    function checkBeneficiary(
        bytes32 scriptHash,
        address beneficiary
    )
        external
        view
        returns(bool check);

    function checkVote(
        bytes32 scriptHash,
        address party
    )
        external
        view
        returns(bool vote);

    function getTransactionHash(
        bytes32 scriptHash, 
        address[] destinations, 
        uint256[] amounts
    )
        external
        view
        returns(bytes32);
}
