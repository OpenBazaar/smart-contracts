pragma solidity 0.5.4;

import "./IEscrow.sol";


/**
* @title Escrow Proxy
* @author OB1
* @notice This a proxy contract used to return hashes that need to be signed in
* order for funds to be released from a given version of the escrow contract
* @dev For v1.0.0 of the escrow contract this proxy will generate the hash
* that needs to be signed in order to release funds from escrow. For all later
* versions of the escrow contract, the escrow contract itself should have such
* a function.
*/
contract EscrowProxy {

    address public legacyEscrowVersion;

    constructor(address _legacyEscrowVersion) public {
        //the zero address is allowed
        legacyEscrowVersion = _legacyEscrowVersion;
    }

    /**
    * @notice Gets the hash that must be signed to release funds from escrow
    * for a given OpenBazaar transaction, set of destinations, set of amounts,
    * and version of the escrow contract
    * @param escrowVersion The address of the escrow contract being used for
    * the OpenBazaar tansaction in question
    * @param scriptHash The scriptHash of the OpenBazaar transaction
    * @param destinations List of addresses who will receive funds
    * @param amounts List of amounts to be released to the destinations
    * @return a bytes32 hash to sign
    */
    function getTransactionHash(
        address escrowVersion,
        bytes32 scriptHash,
        address[] calldata destinations,
        uint256[] calldata amounts
    )
        external
        view
        returns (bytes32)
    {
        require(
            escrowVersion != address(0),
            "Invalid escrow contract version!!"
        );

        if (escrowVersion == legacyEscrowVersion) {
            return _legacyEscrowTxHash(
                scriptHash,
                destinations,
                amounts
            );
        } else {
            IEscrow escrow = IEscrow(escrowVersion);

            return escrow.getTransactionHash(
                scriptHash,
                destinations,
                amounts
            );
        }
    }

    /**
    * @notice Gets the hash that must be signed to release funds from escrow
    * for a given OpenBazaar transaction, set of destinations, set of amounts,
    * and version 1.0.0 of the escrow contract
    * @param scriptHash The scriptHash of the OpenBazaar transaction
    * @param destinations List of addresses who will receive funds
    * @param amounts List of amounts to be released to the destinations
    * @return a bytes32 hash to sign
    */
    function _legacyEscrowTxHash(
        bytes32 scriptHash,
        address[] memory destinations,
        uint256[] memory amounts
    )
        private
        view
        returns (bytes32)
    {
        bytes32 txHash = keccak256(
            abi.encodePacked(
                "\x19Ethereum Signed Message:\n32",
                keccak256(
                    abi.encodePacked(
                        byte(0x19),
                        byte(0),
                        legacyEscrowVersion,
                        destinations,
                        amounts,
                        scriptHash
                    )
                )
            )
        );

        return txHash;
    }

}
