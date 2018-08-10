pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/AddressUtils.sol";

/** 
* @dev Contract Version Manager for non-upgradeable contracts
*/
contract ContractManager is Ownable {


    event VersionAdded(string contractName, string version, address indexed implementation);

    event StatusChanged(string contractName, string version, Status status);

    event BugLevelChanged(string contractName, string version, BugLevel bugLevel);

    event VersionAudited(string contractName, string version);

    event VersionRecommended(string contractName, string version);

    event RecommendedVersionRemoved(string contractName);

    /**
    * @dev SIGNIFIES THE STATUS OF THE VERSION
    */
    enum Status {BETA, RC, PRODUCTION, DEPRECATED}
    
    /**
    * @dev SIGNIFIES THE LEVEL OF BUG FOUND WITHIN THE VERSION
    */
    enum BugLevel{NONE, LOW, MEDIUM, HIGH, CRITICAL}

    /**
    * @dev The structure of the each version to be followed
    */
    struct Version {
        string version;// the version number string v1.0
        Status status;// Whether the version is BETA, RC OR PRODUCTION
        BugLevel bugLevel;// If any found
        address implementation;// The address of the version contract being referenced
        bool audited;// The boolean to mark whether the contract was audited or not
        bytes32 auditHash;// bytes32 hash of the contract code
        bytes auditReportIPFSPointer;// IPFS content address for the audit report
        address auditor;// Address of the auditor
        uint256 dateAdded;// The date when this version was registered with the contract
        bool recommended;// Whether this version is recommended or not
    }

    /** 
    * @dev List of all contracts registered
    */
    string[] internal contracts;

    /** 
    * @dev To keep track which contracts has been registered so far to save gas while check redundant contracts
    */
    mapping(string=>bool)internal contractExists;

    /** 
    * @dev Kepp track of all contract version
    */
    mapping(string=>string[])internal contactVsVersionString;     


    /** 
    * @dev Mapping of contract name and each of it's different versions
    */
    mapping(string=>mapping(string=>Version))internal  contractVsVersions;

    /** 
    * @dev Mapping between contract name and it's recommended version
    */

    mapping(string=>string)internal contractVsRecommendedVersion;


    modifier nonZeroAddress(address _address){
        require(_address != address(0), "The provided address is a 0 address");
        _;
    }

    modifier onlyAuditor(string contractName, string version) {
        
        require(msg.sender == contractVsVersions[contractName][version].auditor, "Non auditor called this method");
        _;
    }

    modifier doesContractExists(string contractName) {
        
        require(contractExists[contractName], "Contract does not exists");
        _;
    }

    modifier versionExists(string contractName, string version) {
        require(contractVsVersions[contractName][version].implementation != address(0), "Version does not exists for contract");
        _;
    }


    /** 
    * @dev Allow owner to add new version for the contract
    * @param contractName The contract name for which the version is to be added
    * @param version The version string
    * @param status Status of the version
    * @param _implementation The address of the version implementation
    * @param _auditor The address of the auditor. It can be 0 address but in the case the version can never be marked as audited and hence can never become a recommended version
    */
    function addVersion(string contractName, string version, Status status, address _implementation, address _auditor)external
     onlyOwner nonZeroAddress(_implementation){

        //can't pass empty string as version
        require(bytes(version).length>0, "Empty string passed as version");

        //contract name can't be empty string
        require(bytes(contractName).length>0, "Empty string passed as contract name");

        //Check that the implementation corresponds to a contract address
        require(AddressUtils.isContract(_implementation), "Cannot set a implementation to a non-contract address");

        if(!contractExists[contractName]){
            contracts.push(contractName);
            contractExists[contractName] = true;
        }

        //check version should not already exist for the contract
        require(contractVsVersions[contractName][version].implementation == address(0), "Version already exists for contract");
        contactVsVersionString[contractName].push(version);

        contractVsVersions[contractName][version] = Version({
            version:version,
            status:status,
            bugLevel:BugLevel.NONE,
            implementation:_implementation,
            audited:false,
            auditHash:bytes32(0),
            auditReportIPFSPointer:"",
            auditor:_auditor,
            dateAdded:block.timestamp,
            recommended:false

        });

        emit VersionAdded(contractName, version, _implementation);
    }

    /** 
    * @dev change status of the version
    * @param contractName Name of the contract
    * @param version Version of the contract
    * @param status Status to be set
    */
    function changeStatus(string contractName, string version, Status status)external
     onlyOwner doesContractExists(contractName) versionExists(contractName, version) {
         
        string storage recommendedVersion = contractVsRecommendedVersion[contractName];
        
        //Recommended version can't be marked as deprecated
        if(keccak256(abi.encodePacked(recommendedVersion)) == keccak256(abi.encodePacked(version)) && status == Status.DEPRECATED){
            revert("Recommended version cannot be deprecated");
        }

        contractVsVersions[contractName][version].status = status;

        emit StatusChanged(contractName, version, status);
    }

    /** 
    * @dev Change the bug level for the contract
    * @param contractName Name of the contract
    * @param version Version of the contract
    * @param bugLevel New bug level for the contract
    */
    function changeBugLevel(string contractName, string version, BugLevel bugLevel)external
     onlyOwner doesContractExists(contractName) versionExists(contractName, version) {

        string storage recommendedVersion = contractVsRecommendedVersion[contractName];

        //if recommended version is being marked as critical then it will removed from being recommended
        if(keccak256(abi.encodePacked(recommendedVersion)) == keccak256(abi.encodePacked(version)) && bugLevel == BugLevel.CRITICAL){
            removeRecommendedVersion(contractName);
        } 

        contractVsVersions[contractName][version].bugLevel = bugLevel;

        emit BugLevelChanged(contractName, version, bugLevel);
    }

    /**
    * @dev Mark version as audited
    * @param contractName Name of the contract
    * @param version Version of the contract
    * @param auditHash Audit hash of the version
    * @param auditReportIPFSPointer IPFS content address to the audit report
    * Only auditor can call this method
    */
    function markVersionAudited(string contractName, string version, bytes32 auditHash, bytes auditReportIPFSPointer)external
     doesContractExists(contractName) versionExists(contractName, version) onlyAuditor(contractName, version){
        
        //audit hash should not be empty hash
        require(auditHash != bytes32(0), "Audit hash is empty");

        //audit report not passed
        require(auditReportIPFSPointer.length>0, "IPFS content address for audit report not passed");
        
        //Version should not be already audited
        require(!contractVsVersions[contractName][version].audited, "Version is already audited");

        contractVsVersions[contractName][version].audited = true;
        contractVsVersions[contractName][version].auditHash = auditHash;
        contractVsVersions[contractName][version].auditReportIPFSPointer = auditReportIPFSPointer;

        emit VersionAudited(contractName, version);
    }  

    /** 
    * @dev Set recommended version
    * @param contractName Name of the contract
    * @param version Version of the contract
    * Version should be in Production stage and bug level should not be high or critical.
    * Version must be audited
    */
    function markRecommendedVersion(string contractName, string version)external
     onlyOwner doesContractExists(contractName) versionExists(contractName, version){

        //check version should be in production state
        require(contractVsVersions[contractName][version].status == Status.PRODUCTION, "Version not in production state");

        //check version must be audited
        require(contractVsVersions[contractName][version].audited, "Version is not audited");

        //check version has bug level lower than HIGH
        require(contractVsVersions[contractName][version].bugLevel < BugLevel.HIGH, "Version bug level is not lower than HIGH");

        string storage previousRecommendedVersionName = contractVsRecommendedVersion[contractName];

        Version storage previousRecommendedVersion = contractVsVersions[contractName][previousRecommendedVersionName];

        Version storage newRecommendedVersion = contractVsVersions[contractName][version];

        //Mark previous as non-recommended
        previousRecommendedVersion.recommended = false;

        //Mark new version as recommened
        newRecommendedVersion.recommended = true;

        //Put new version as recommended version for the contract
        contractVsRecommendedVersion[contractName] = newRecommendedVersion.version;

        emit VersionRecommended(contractName, version);

    }

    /** 
    * @dev Remove any recommended version for the contract and sets it to NULL
    * @param contractName Name of the contract
    */
    function removeRecommendedVersion(string contractName)public
     onlyOwner doesContractExists(contractName){

        string storage versionName = contractVsRecommendedVersion[contractName];
        
        Version storage previousRecommendedVersion = contractVsVersions[contractName][versionName];

        //Mark previous version as non-recommended
        previousRecommendedVersion.recommended = false;

        //delete it from mapping
        delete contractVsRecommendedVersion[contractName];

        emit RecommendedVersionRemoved(contractName);

    }

    /** 
    * @dev Get recommended version for the contract.
    * @return Details of recommended version    
    */
    function getRecommendedVersion(string contractName)external view doesContractExists(contractName)
     returns(string version, Status status, BugLevel bugLevel, address implementation,  address auditor, bool audited, bytes32 auditHash, bytes auditReportIPFSPointer, uint256 dateAdded, bool recommended){

        string storage versionName = contractVsRecommendedVersion[contractName];

        Version storage recommendedVersion = contractVsVersions[contractName][versionName];

        version = recommendedVersion.version;
        status = recommendedVersion.status;
        bugLevel = recommendedVersion.bugLevel;
        implementation = recommendedVersion.implementation;
        audited = recommendedVersion.audited;
        auditHash = recommendedVersion.auditHash;
        auditReportIPFSPointer = recommendedVersion.auditReportIPFSPointer;
        dateAdded = recommendedVersion.dateAdded;
        auditor = recommendedVersion.auditor;
        recommended = recommendedVersion.recommended;
    }
    
    /** 
    * @dev Get total count of contracts registered
    */
    function getTotalContractCount()external view returns(uint256 count) {
        count = contracts.length;
    }

    /** 
    * @dev Get total count of versions for the contract
    * @param contractName Name of the contract
    */
    function getVersionCountForContract(string contractName)external view returns(uint256 count){
        count = contactVsVersionString[contractName].length;
    }

    /** 
    * @dev Returns the contract at index
    * @param index The index to be searched for
    */
    function getContractAtIndex(uint256 index)external view returns(string contractName){
        contractName = contracts[index];
    }

    /** 
    * @dev Returns version of a contract at specific index
    * @param contractName Name of the contract
    * @param index The index to be searched for
    */
    function getVersionAtIndex(string contractName, uint256 index)external view returns(string version){
        version = contactVsVersionString[contractName][index];
    }

    /** 
    * @dev Returns the version details for the given contract and version
    * @param contractName Name of the contract
    * @param version Version string for the contract
    */
    function getVersionDetails(string contractName, string versionName)external view
     returns(string version, Status status, BugLevel bugLevel, address implementation,  address auditor, bool audited, bytes32 auditHash, bytes auditReportIPFSPointer, uint256 dateAdded, bool recommended){
        
        Version storage v = contractVsVersions[contractName][versionName];

        version = v.version;
        status = v.status;
        bugLevel = v.bugLevel;
        implementation = v.implementation;
        audited = v.audited;
        auditHash = v.auditHash;
        auditReportIPFSPointer = v.auditReportIPFSPointer;
        dateAdded = v.dateAdded;
        auditor = v.auditor;
        recommended = v.recommended;

    }
}