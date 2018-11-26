pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/utils/Address.sol";


/**
* @dev Contract Version Manager
*/
contract ContractManager is Ownable {

    event VersionAdded(
        string contractName,
        string versionName,
        address indexed implementation
    );

    event StatusChanged(
        string contractName,
        string versionName,
        Status status
    );

    event BugLevelChanged(
        string contractName,
        string versionName,
        BugLevel bugLevel
    );

    event VersionAudited(string contractName, string versionName);

    event VersionRecommended(string contractName, string versionName);

    event RecommendedVersionRemoved(string contractName);

    /**
    * @dev Indicates the status of the version
    */
    enum Status {BETA, RC, PRODUCTION, DEPRECATED}

    /**
    * @dev Indicates the highest level of bug found in this version
    */
    enum BugLevel{NONE, LOW, MEDIUM, HIGH, CRITICAL}

    /**
    * @dev struct to store info about each version
    */
    struct Version {
        string versionName; // ie: "0.0.1"
        Status status;
        BugLevel bugLevel;
        address implementation;
        bool audited;
        uint256 timeAdded;
    }

    /**
    * @dev List of all registered contracts
    */
    string[] internal _contracts;

    /**
    * @dev To keep track of which contracts have been registered so far
    * to save gas while checking for redundant contracts
    */
    mapping(string => bool) internal _contractExists;

    /**
    * @dev To keep track of all versions of a given contract
    */
    mapping(string => string[]) internal _contractVsVersionString;


    /**
    * @dev Mapping of contract name & version name to version struct
    */
    mapping(string => mapping(string => Version)) internal _contractVsVersions;

    /**
    * @dev Mapping between contract name and the name of its recommended
    * version
    */
    mapping(string => string) internal _contractVsRecommendedVersion;


    modifier nonZeroAddress(address _address){
        require(_address != address(0), "The provided address is a 0 address");
        _;
    }

    modifier contractRegistered(string contractName) {

        require(_contractExists[contractName], "Contract does not exists");
        _;
    }

    modifier versionExists(string contractName, string versionName) {
        require(
            _contractVsVersions[contractName][versionName].implementation != address(0),
            "Version does not exists for contract"
        );
        _;
    }

    /**
    * @dev Allow owner to add a new version for a contract
    * @param contractName The contract name
    * @param versionName The version name
    * @param status Status of the new version
    * @param implementation The address of the new version
    */
    function addVersion(
        string contractName,
        string versionName,
        Status status,
        address implementation
    )
        external
        onlyOwner
        nonZeroAddress(implementation)
    {

        //do not allow contract name to be the empty string
        require(
            bytes(contractName).length > 0,
            "ContractName cannot be empty"
        );

        //do not allow empty string as version name
        require(
            bytes(versionName).length > 0,
            "VersionName cannot be empty"
        );

        //implementation must be a contract address
        require(
            Address.isContract(implementation),
            "Iimplementation cannot be a non-contract address"
        );

        //version should not already exist for the contract
        require(
            _contractVsVersions[contractName][versionName].implementation == address(0),
            "This Version already exists for this contract"
        );

        //if this is a new contractName then push it to the contracts[] array
        if (!_contractExists[contractName]) {
            _contracts.push(contractName);
            _contractExists[contractName] = true;
        }

        _contractVsVersionString[contractName].push(versionName);

        _contractVsVersions[contractName][versionName] = Version({
            versionName:versionName,
            status:status,
            bugLevel:BugLevel.NONE,
            implementation:implementation,
            audited:false,
            timeAdded:block.timestamp
        });

        emit VersionAdded(contractName, versionName, implementation);
    }

    /**
    * @dev Change the status of a version of a contract
    * @param contractName Name of the contract
    * @param versionName Version of the contract
    * @param status Status to be set
    */
    function changeStatus(
        string contractName,
        string versionName,
        Status status
    )
        external
        onlyOwner
        contractRegistered(contractName)
        versionExists(contractName, versionName)
    {
        string storage recommendedVersion = _contractVsRecommendedVersion[
            contractName
        ];

        //if the recommended version is being marked as DEPRECATED then it will
        //be removed from being recommended
        if (
            keccak256(
                abi.encodePacked(
                    recommendedVersion
                )
            ) == keccak256(
                abi.encodePacked(
                    versionName
                )
            ) && status == Status.DEPRECATED
        )
        {
            removeRecommendedVersion(contractName);
        }

        _contractVsVersions[contractName][versionName].status = status;

        emit StatusChanged(contractName, versionName, status);
    }

    /**
    * @dev Change the bug level for a version of a contract
    * @param contractName Name of the contract
    * @param versionName Version of the contract
    * @param bugLevel New bug level for the contract
    */
    function changeBugLevel(
        string contractName,
        string versionName,
        BugLevel bugLevel
    )
        external
        onlyOwner
        contractRegistered(contractName)
        versionExists(contractName, versionName)
    {
        string storage recommendedVersion = _contractVsRecommendedVersion[
            contractName
        ];

        //if the recommended version of this contract is being marked as
        // CRITICAL (status level 4) then it will no longer be marked as
        // recommended
        if (
            keccak256(
                abi.encodePacked(
                    recommendedVersion
                )
            ) == keccak256(
                abi.encodePacked(
                    versionName
                )
            ) && bugLevel == BugLevel.CRITICAL
        )
        {
            removeRecommendedVersion(contractName);
        }

        _contractVsVersions[contractName][versionName].bugLevel = bugLevel;

        emit BugLevelChanged(contractName, versionName, bugLevel);
    }

    /**
    * @dev Mark a version of a contract as having been audited
    * @param contractName Name of the contract
    * @param versionName Version of the contract
    */
    function markVersionAudited(
        string contractName,
        string versionName
    )
        external
        contractRegistered(contractName)
        versionExists(contractName, versionName)
        onlyOwner
    {
        //this version should not already be marked audited
        require(
            !_contractVsVersions[contractName][versionName].audited,
            "Version is already audited"
        );

        _contractVsVersions[contractName][versionName].audited = true;

        emit VersionAudited(contractName, versionName);
    }

    /**
    * @dev Set recommended version
    * @param contractName Name of the contract
    * @param versionName Version of the contract
    * Version should be in Production stage (status 2) and bug level should
    * not be HIGH or CRITICAL (status level should be less than 3).
    * Version must be marked as audited
    */
    function markRecommendedVersion(
        string contractName,
        string versionName
    )
        external
        onlyOwner
        contractRegistered(contractName)
        versionExists(contractName, versionName)
    {
        //version must be in PRODUCTION state (status 2)
        require(
            _contractVsVersions[contractName][versionName].status == Status.PRODUCTION,
            "Version is not in PRODUCTION state (status level should be 2)"
        );

        //check version must be audited
        require(
            _contractVsVersions[contractName][versionName].audited,
            "Version is not audited"
        );

        //version must have bug level lower than HIGH
        require(
            _contractVsVersions[contractName][versionName].bugLevel < BugLevel.HIGH,
            "Version bug level is HIGH or CRITICAL (bugLevel should be < 3)"
        );

        //mark new version as recommended version for the contract
        _contractVsRecommendedVersion[contractName] = versionName;

        emit VersionRecommended(contractName, versionName);
    }

    /**
    * @dev Get the version of the recommended version for a contract.
    * @return Details of recommended version
    */
    function getRecommendedVersion(
        string contractName
    )
        external
        view
        contractRegistered(contractName)
        returns (
            string versionName,
            Status status,
            BugLevel bugLevel,
            address implementation,
            bool audited,
            uint256 timeAdded
        )
    {
        versionName = _contractVsRecommendedVersion[contractName];

        Version storage recommendedVersion = _contractVsVersions[
            contractName
        ][
            versionName
        ];

        status = recommendedVersion.status;
        bugLevel = recommendedVersion.bugLevel;
        implementation = recommendedVersion.implementation;
        audited = recommendedVersion.audited;
        timeAdded = recommendedVersion.timeAdded;
    }

    /**
    * @dev Get the total number of contracts registered
    */
    function getTotalContractCount() external view returns (uint256 count) {
        count = _contracts.length;
    }

    /**
    * @dev Get total count of versions for a contract
    * @param contractName Name of the contract
    */
    function getVersionCountForContract(string contractName)
        external
        view
        returns (uint256 count)
    {
        count = _contractVsVersionString[contractName].length;
    }

    /**
    * @dev Returns the contract at index
    * @param index The index to be searched for
    */
    function getContractAtIndex(uint256 index)
        external
        view
        returns (string contractName)
    {
        contractName = _contracts[index];
    }

    /**
    * @dev Returns versionName of a contract at a specific index
    * @param contractName Name of the contract
    * @param index The index to be searched for
    */
    function getVersionAtIndex(string contractName, uint256 index)
        external
        view
        returns (string versionName)
    {
        versionName = _contractVsVersionString[contractName][index];
    }

    /**
    * @dev Returns the version details for the given contract and version
    * @param contractName Name of the contract
    * @param versionName Version string for the contract
    */
    function getVersionDetails(string contractName, string versionName)
        external
        view
        returns (
            string versionString,
            Status status,
            BugLevel bugLevel,
            address implementation,
            bool audited,
            uint256 timeAdded
        )
    {
        Version storage v = _contractVsVersions[contractName][versionName];

        versionString = v.versionName;
        status = v.status;
        bugLevel = v.bugLevel;
        implementation = v.implementation;
        audited = v.audited;
        timeAdded = v.timeAdded;
    }

    /**
    * @dev Remove the "recommended" status of the currently recommended version
    * of a contract (if any)
    * @param contractName Name of the contract
    */
    function removeRecommendedVersion(string contractName)
        public
        onlyOwner
        contractRegistered(contractName)
    {
        //delete it from mapping
        delete _contractVsRecommendedVersion[contractName];

        emit RecommendedVersionRemoved(contractName);
    }
}
