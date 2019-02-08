# Rewards Contract Specification

## Introduction

OB1 will occasionally hold 'promotions' where users who buy goods from "promoted sellers" become eligible for reward tokens (OBT). Each of these promotions will be managed by an instance of the OBRewards contract.

## Time Limits

When a buyer purchases from a promoted seller they become eligible to receive up to 50 OBT from the rewards contract. The buyer has a fixed amount of time (`_timeWindow` seconds) after the completion of the sale to claim their reward tokens from the contract.

The promotion as a whole has an `endDate`, which is set (and changeble) by the owner. After the promotions `endDate` has come to pass, buyers can no longer claim any rewards.

## Claiming Rewards

The buyer can claim tokens for which she is eligible in on of two ways:

1.  By calling `claimRewards`, the buyer can pass a list of OB transactions (identified by their `scriptHash`). The contract ensures that each of the passed transactions do indeed make the buyer eligible for some reward tokens, computes the total amount of tokens the buyer is eligible to receive, and sends that amount of reward tokens to the buyer. (If the contract does not have enough reward tokens remaining, it will send the buyer all of the tokens it has. Then, if OB1 sends more reward tokens to the contract, the buyer should be able to claim whatever remaining tokens they are owed -- assuming they are still eligible to receive the tokens.)

2.  By calling `executeAndClaim` the buyer can complete their trade with the seller and claim any rewards with a single transaction.

# Limits on Reward Amounts

Each buyer may be rewarded tokens for purchasing from a given promoted seller only once per promotion. That is, if buyer Bob buys from promoted seller Sally, he'll be eligible for up to 50 reward tokens, but if he buys from her again during the same promotion, he will not be eligible for an additional 50 reward tokens. If Bob wants to earn more tokens during the same promotion, he'd have to complete a purchase from some other promoted seller.

Additionally, the owner of the contract sets a maximum total number of tokens that can be rewarded for purchasing from any given promoted seller (`_maxRewardPerSeller`).

## Additional Notes

- Any reward tokens remaining in the contract can be withdrawn from the contract by the owner.

- This approach to promoting sellers is subject to trivially-executable sybil attacks, as well as buyer collusion with promoted sellers. The limits on the rewards and the restriction to OB1-promoted sellers are intended to mitigate this risk.
