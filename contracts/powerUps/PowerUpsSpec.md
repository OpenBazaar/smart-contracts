# PowerUps Contract Specification

## Introduction

We want to allow users to burn tokens in order to:

1.  Have a listing appear in the top results of a keyword search in one of the OB clients
2.  Have a listing appear in a special section of one of the OB clients (for example, on the front page above the fold)
3.  Have some visual indicator on their store that indicates they've burned some tokens in association with their store (which signals that the store is unlikely to be one of a huge number of sybils)

All three of these are handled using a single `PowerUps` contract.

## Intended Functionality

The `PowerUps` contract stores a list of "PowerUps", which is a struct with 4 properties:

1.  A `contentAddress` (string), which is either the IPFS/IPNS address of an OB listing or the peerID of a store on the OB network. (The contract does NOT need to verify that the string is a valid IPFS/IPNS address).
2.  An integer `tokensBurned` (uint256), which indicates the total number of tokens that have been burned in association with this PowerUp.
3.  A timestamp `lastTopupTime` (uint256), which indicates the last time funds were burned in association with this PowerUp.
4.  A `keyword` (bytes32), which is a keyword that is used to indicate the purpose of the PowerUp, Ie: `keyword = web3.utils.fromAscii("kw:shoes")` may indicate that the PowerUp is being used to have a listing appear in the search results when a user searches for "shoes" in the OB client. Ie: `keyword = web3.utils.fromAscii("pl:mc-fp-af")` may indicate that the PowerUp is being used to have a listing appear in the **m**obile **c**lient, on the **f**ront **p**age, **a**bove the **f**old. Ie: `keyword = web3.utils.fromAscii("ps:")` may indicate that the PowerUp is being used to have an non-sybil indicator put on a store. Etc.

Users can create a new PowerUp by calling `addPowerUp`. They can burn more tokens towards an existing PowerUp by calling `topUpPowerUp`.

They can add multiple PowerUps at once (with the restriction that the `contentAddress` be the same for each PowerUp) by calling `addPowerUps`.

## Additional Notes

- Multiple PowerUps may exist that have the same `contentAddress` and/or `keyword`. There is no uniqueness requirement here.
- It is not required that the creator of a new PowerUp be in control of the IPFS/IPNS/peerID stored in the `contentAddress` of the PowerUp.
- It is not necessary to check (at the contract level) whether `contentAddress` is actually a valid IPFS/IPNS/peerID (this will be done client side and any "bad" PowerUps will simply be ignored by the client).
- Similarly, it is not necessary to check (at the contract level) whether `keyword` is formatted properly or using the correct prefixes/namespaces.
- Every time a new PowerUp is created, or an existing PowerUp is 'topped up', an event should be emitted that includes the timestamp, and the new amount of tokens that have been burned in association with the TopUp (this is what will allow the client to 'score' a given PowerUp based both on the total number of tokens that have been burned and -- critically -- how long ago those tokens were burned).
