pragma solidity 0.5.7;

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
        address buyer,
        address seller,
        address moderator,
        uint8 threshold,
        uint32 timeoutHours,
        bytes32 scriptHash,
        bytes20 uniqueId
    )
        external payable;

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
        external;

    function addFundsToTransaction(bytes32 scriptHash) external payable;

    function addTokensToTransaction(
        bytes32 scriptHash,
        uint256 value
    )
        external;

    function execute(
        uint8[] calldata sigV,
        bytes32[] calldata sigR,
        bytes32[] calldata sigS,
        bytes32 scriptHash,
        address[] calldata destinations,
        uint256[] calldata amounts
    )
        external;

    function checkBeneficiary(
        bytes32 scriptHash,
        address beneficiary
    )
        external
        view
        returns (bool);

    function checkVote(
        bytes32 scriptHash,
        address party
    )
        external
        view
        returns (bool);

    function getTransactionHash(
        bytes32 scriptHash,
        address[] calldata destinations,
        uint256[] calldata amounts
    )
        external
        view
        returns (bytes32);

    function getAllTransactionsForParty(
        address partyAddress
    )
        external
        view
        returns (bytes32[] memory);

    function calculateRedeemScriptHash(
        bytes20 uniqueId,
        uint8 threshold,
        uint32 timeoutHours,
        address buyer,
        address seller,
        address moderator,
        address tokenAddress
    )
        external
        view
        returns (bytes32);
}
