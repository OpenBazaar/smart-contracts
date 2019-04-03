pragma solidity 0.4.24;

import "./IEscrow.sol";


/** 
* @dev This contract is used as proxy to return the hash which needs to be signed
* For our current audited version of Escrow contract Proxy will contain code to generate hash
* For all other furture Escrow contract versions, the version in itself should contain a function
* And proxy will only be calling that function
*/
contract EscrowProxy {

    address public legacyEscrowVersion;

    constructor(address _legacyEscrowVersion) public {

        //empty address allowed in case of no legacy contract
        legacyEscrowVersion = _legacyEscrowVersion;
    }

    /** 
    * @dev Return Transaction has for the given input
    * For our current audited version of Escrow contract Proxy will contain code to generate hash
    * For all other furture Escrow contract versions, the version in itself should contain a function
    * And proxy will only be calling that function
    * @param escrowVersion The version of the escrow contract for which this trade is executed
    * @param scriptHash script hash of the transaction
    * @param destinations Receivers of the funds
    * @param amounts Amount distributed to each receiver
    */
    function getTransactionHash(
        address escrowVersion, 
        bytes32 scriptHash, 
        address[] destinations, 
        uint256[] amounts
    ) 
        external
        view 
        returns(bytes32) 
    {   

        require(
            escrowVersion != address(0), 
            "Invalid escrow contract version!!"
        );
        //if legacy version of escrow is called than
        //calculate tx hash in this contract
        if (escrowVersion == legacyEscrowVersion) {

            return _legacyEscrowTxHash(
                scriptHash,
                destinations,
                amounts
            );

        }
        //If legacy version is not called
        //then pass on the call to the escro contract version
        else {
            IEscrow escrow = IEscrow(escrowVersion);

            return escrow.getTransactionHash(
                scriptHash,
                destinations,
                amounts
            );
        }

    }

    function _legacyEscrowTxHash(
        bytes32 scriptHash, 
        address[] destinations, 
        uint256[] amounts
    )
        private
        view
        returns(bytes32)
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