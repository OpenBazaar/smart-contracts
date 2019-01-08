# ContractManager Contract Specification

## Introduction

The OpenBazaar client will interact with the Escrow contract, as well as a handful of other contracts in the future (a 'utility' contract, a 'rewards' contract, a 'name server' contract, etc). As time goes by, we may want to create new versions of these contracts for the client to use. However, it is important that we do not _force_ existing clients to use our newly updated contracts (such behavior would go against OpenBazaar's core values). So rather than _altering_ existing contracts (and thereby forcing changes on any clients who are using the existing contracts), we'll instead deploy entirely new contracts and allow the clients to _opt in_ to using them.

The purpose of the ContractManager is simply to provide a way for OB1 to signal to the client software which version(s) of the contracts are currently recommended (by OB1). When a new version of a contract is deployed, information about that version of the contract is added to the ContractManager contract. If an earlier version of a contract is found to have a bug, OB1 can signal that to the clients via the ContractManager.

We could achieve the same thing by using signed messages stored on a server or on IPFS. However, storing this information in the Ethereum blockchain gives us very high uptime guarantees with an (amortized) cost of $0 -- all while not having to maintain any hardware or incentivize any IPFS hosts.

## Intended Functionality

This contract is intended simply as a way for OB1 to communicate basic information about the state of OpenBazaar contracts to the clients. As such, only the Owner of the contract should be able to add/change/remove any information from the ContractManager.

Each contract added to the ContractManager has a `contractName`, which indicates its _type_ (ie: 'escrow', 'utility', 'rewards', 'wns', etc). It has a `versionName` which indicates the _version_ (ie 'v0.0.1', 'v1.2.0', etc). It has a `status` which is one of {BETA, RC, PRODUCTION, DEPRECATED}. It has a `bugLevel` which is one of {NONE, LOW, MEDIUM, HIGH, CRITICAL}. It has an `implementation`, which is simply the address of its instantiation. It has a timestamp of when the contract was added to the registry.

The Owner (and only the Owner) of the ContractManager should be able to register new contracts as well as change the `status` indicator, and `bugLevel` of registered contracts.

For each `contractName`, the Owner (and only the Owner) should be able to mark up to one `versionName` as the "recommended" version for a particular `contractName`. They should also be able to _remove_ the "recommended" status of any version.
