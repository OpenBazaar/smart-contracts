var ContractManager = artifacts.require("ContractManager");
var Escrow_v1_0 = artifacts.require("Escrow_v1_0");
var EscrowWithoutToken = artifacts.require("EscrowWithoutToken");

var util = require("ethereumjs-util");

contract("Contract Manager contract", function(accounts){

    var ownerAccount = accounts[0];
    var contracts = new Array();
    var contractVersions = new Object();
    var versions = new Array();


    before(async () => {

        this.contractManager = await ContractManager.new({from:ownerAccount});

        contracts[0] = "escrow";
        versions[0] = new Array();
        versions[0][0] = "v1.0";
        versions[0][1] = "v1.1";
        
    
    });

    it("Add version v1.0 for escrow contract", async()=>{

        var escrowVersion1_0 = await EscrowWithoutToken.new();

        var contractName = contracts[0];
        var version = versions[0][0];
        var status = 0;
        var _implementation = escrowVersion1_0.address;

        var txResult = await this.contractManager.addVersion(contractName, version, status, _implementation);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedImplementation = txResult.logs[0].args.implementation;

        assert.equal(eventName, "VersionAdded", "VersionAdded event must be fired");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed one");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedImplementation, _implementation, "Received implementation must match the passed one");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        receivedVersion = versionData[0];
        var receivedStatus = versionData[1].toNumber();
        var receivedbugLevel = versionData[2].toNumber();
        receivedImplementation = versionData[3];
        var receivedAudited = versionData[4];

        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedStatus, status, "Received staus must be the one which was passed");
        assert.equal(receivedbugLevel, 0, "Received bug level must be NONE(0)");
        assert.equal(receivedImplementation, _implementation, "Received implementation must match the passed one");
        assert.equal(receivedAudited, false, "Received audited must be false");

        contractVersions.escrow = new Object();

        contractVersions.escrow[version] = new Object();
        
        contractVersions.escrow[version].version = receivedVersion;
        contractVersions.escrow[version].status = receivedStatus;
        contractVersions.escrow[version].bugLevel = receivedbugLevel;
        contractVersions.escrow[version].implementation = receivedImplementation;
        contractVersions.escrow[version].audited = receivedAudited;
    });

    it("Add version v1.1 for escrow contract", async()=>{

        var escrowVersion1_1 = await Escrow_v1_0.new();

        var contractName = contracts[0];
        var version = versions[0][1];
        var status = 0;
        var _implementation = escrowVersion1_1.address;

        var txResult = await this.contractManager.addVersion(contractName, version, status, _implementation);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedImplementation = txResult.logs[0].args.implementation;

        assert.equal(eventName, "VersionAdded", "VersionAdded event must be fired");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed one");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedImplementation, _implementation, "Received implementation must match the passed one");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        receivedVersion = versionData[0];
        var receivedStatus = versionData[1].toNumber();
        var receivedbugLevel = versionData[2].toNumber();
        receivedImplementation = versionData[3];
        var receivedAudited = versionData[4];

        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedStatus, status, "Received staus must be the one which was passed");
        assert.equal(receivedbugLevel, 0, "Received bug level must be NONE(0)");
        assert.equal(receivedImplementation, _implementation, "Received implementation must match the passed one");
        assert.equal(receivedAudited, false, "Received audited must be false");

        contractVersions.escrow[version] = new Object();
        
        contractVersions.escrow[version].version = receivedVersion;
        contractVersions.escrow[version].status = receivedStatus;
        contractVersions.escrow[version].bugLevel = receivedbugLevel;
        contractVersions.escrow[version].implementation = receivedImplementation;
        contractVersions.escrow[version].audited = receivedAudited;


    });

    it("Add version v1.1 again for escrow contract", async()=>{

        var escrowVersion1_1 = await Escrow_v1_0.new();

        var contractName = contracts[0];
        var version = versions[0][1];
        var status = 0;
        var _implementation = escrowVersion1_1.address;
        try{
        await this.contractManager.addVersion(contractName, version, status, _implementation);
        assert.equal(true, false, "Should not be able to add version with v1.1 as it is already registered");
    
        } catch(error){
        assert.notInclude(error.toString(), 'AssertionError', error.message);        
        }
    });

    it("Add version with empty contract name", async()=>{

        var escrowVersion1_1 = await Escrow_v1_0.new();

        var contractName = '';
        var version = versions[0][1];
        var status = 0;
        var _implementation = escrowVersion1_1.address;
        try{
        await this.contractManager.addVersion(contractName, version, status, _implementation);
        assert.equal(true, false, "Should not be able to add version with empty contract name");
    
        } catch(error){
        assert.notInclude(error.toString(), 'AssertionError', error.message);        
        }
    });

    it("Add version with empty version name", async()=>{

        var escrowVersion1_1 = await Escrow_v1_0.new();

        var contractName = contracts[0];
        var version = '';
        var status = 0;
        var _implementation = escrowVersion1_1.address;
        try{
        await this.contractManager.addVersion(contractName, version, status, _implementation);
        assert.equal(true, false, "Should not be able to version with empty version name");
    
        } catch(error){
        assert.notInclude(error.toString(), 'AssertionError', error.message);        
        }
    });

    it("Mark non-audited version as recommended", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];
        
        try{ 
            await this.contractManager.markRecommendedVersion(contractName,version);
            assert.equal(true, false, "Should not be mark non-audited version as recommended");
    
        } catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);        
    }
    });

   
    it("Mark version as audited from auditor account", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];

        
        var txResult = await this.contractManager.markVersionAudited(contractName, version, {from:ownerAccount});
        
        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;

        assert.equal(eventName, "VersionAudited", "VersionAudited must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

       
        var receivedAudited = versionData[4];

     
        assert.equal(receivedAudited, true, "Received audited must be true");
        
        contractVersions.escrow[version].audited = receivedAudited;


    });

    it("Mark already audited version as audited from auditor account", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];

        try{

        await this.contractManager.markVersionAudited(contractName, version, {from:ownerAccount});
        
        assert.equal(true, false, "Should not be able to mark already audited version as audited");
    
        } catch(error){
        assert.notInclude(error.toString(), 'AssertionError', error.message);        
        }


    });

    it("Mark non-production ready version as recommended", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];
        
        try{ 
            await this.contractManager.markRecommendedVersion(contractName,version);
            assert.equal(true, false, "Should not be able to mark non-production ready version as recommended");
    
        } catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);        
    }
    });

    it("Change status of version to PRODUCTION", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];
        var status = 2//PRODUCTION;
        var txResult = await this.contractManager.changeStatus(contractName, version, status);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedStatus = txResult.logs[0].args.status;

        assert.equal(eventName, "StatusChanged", "StatusChanged must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedStatus, status, "Received status must be the one which was passed");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        receivedStatus = versionData[1].toNumber();
       
        assert.equal(receivedStatus, status, "Received staus must be correctly set in the storage");
            
        contractVersions[contractName][version].status = status;
    });

   
    it("Change bug level of version to HIGH", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];
        var bugLevel = 3//HIGH;
        var txResult = await this.contractManager.changeBugLevel(contractName, version, bugLevel);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedBugLevel = txResult.logs[0].args.bugLevel;

        assert.equal(eventName, "BugLevelChanged", "BugLevelChanged must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedBugLevel, bugLevel, "Received bug level must be the one which was passed");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        var receivedbugLevel = versionData[2].toNumber();
       
        assert.equal(receivedbugLevel, bugLevel, "Received bug level must be correctly set in the storage");
            
        contractVersions[contractName][version].bugLevel = bugLevel;
    });

    it("Mark buggy version as recommended", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];
        
        try{ 
            await this.contractManager.markRecommendedVersion(contractName,version);
            assert.equal(true, false, "Should not be mark version with bug level HIGH or higher as recommended");
    
        } catch(error){
            assert.notInclude(error.toString(), 'AssertionError', error.message);        
    }
    });

    it("Change bug level of version to NONE", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];
        var bugLevel = 0//NONE;
        var txResult = await this.contractManager.changeBugLevel(contractName, version, bugLevel);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedBugLevel = txResult.logs[0].args.bugLevel;

        assert.equal(eventName, "BugLevelChanged", "BugLevelChanged must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedBugLevel, bugLevel, "Received bug level must be the one which was passed");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        var receivedbugLevel = versionData[2].toNumber();
       
        assert.equal(receivedbugLevel, bugLevel, "Received bug level must be correctly set in the storage");
            
        contractVersions[contractName][version].bugLevel = bugLevel;
    });

    it("Mark version as recommended", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];
        
        var txResult = await this.contractManager.markRecommendedVersion(contractName,version);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
       
        assert.equal(eventName, "VersionRecommended", "VersionRecommended must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getRecommendedVersion(contractName);

        receivedVersion = versionData[0];
       
        var receivedImplementation = versionData[3];
        

        assert.equal(receivedVersion, version, "Received version must match the passed one");
        
        assert.equal(receivedImplementation, contractVersions[contractName][version].implementation, "Recommended version's implementation address must with the actual set one");
        

    });


    it("Check total contract count", async()=>{

        var count = await this.contractManager.getTotalContractCount();

        assert.equal(count.toNumber(), contracts.length, "Number of contracts does not match the contract registered");

    });

    it("Check registered contracts", async()=> {
        var count = await this.contractManager.getTotalContractCount();

        for(var i=0;i<count.toNumber();i++){
            var contractName = await this.contractManager.getContractAtIndex(i);
            assert.equal(contracts[i], contractName, "Contract name must match the registered contract");
        }
    });

    it("Check total count of versions for a contract", async()=>{

        var count = await this.contractManager.getTotalContractCount();

        for(var i=0;i<count.toNumber();i++){

            var contractName = await this.contractManager.getContractAtIndex(i);

            var versionCount = await this.contractManager.getVersionCountForContract(contractName);
            
            assert.equal(versionCount.toNumber(), Object.keys(contractVersions[contractName]).length, "Number of contracts versions does not match the versions registered");
        
        }
       
    });

    it("Check registered versions for a contract", async()=>{
        var contractCount = await this.contractManager.getTotalContractCount();

        for(var i=0;i<contractCount.toNumber();i++){

            var contractName = await this.contractManager.getContractAtIndex(i);

            var versionCount = await this.contractManager.getVersionCountForContract(contractName);

           for(var j=0;j<versionCount.toNumber();j++){

                var versionName = await this.contractManager.getVersionAtIndex(contractName, j);
                
                var versionData = await this.contractManager.getVersionDetails(contractName, versionName);

                var receivedVersion = versionData[0];
                var receivedStatus = versionData[1].toNumber();
                var receivedbugLevel = versionData[2].toNumber();
                var receivedImplementation = versionData[3];
                var receivedAudited = versionData[4];

                assert.equal(receivedVersion, contractVersions[contractName][versionName].version, "Received version must match the passed one");
                assert.equal(receivedStatus, contractVersions[contractName][versionName].status, "Received staus must be the one which was passed");
                assert.equal(receivedbugLevel, contractVersions[contractName][versionName].bugLevel, "Received bug level must match");
                assert.equal(receivedImplementation, contractVersions[contractName][versionName].implementation, "Received implementation must match the passed one");
                assert.equal(receivedAudited, contractVersions[contractName][versionName].audited, "Received audited must match");
           }
        
        }
    });

    it("Change status of version to BETA", async()=>{
        var contractName = contracts[0];
        var version = versions[0][0];
        var status = 0//BETA;
        var txResult = await this.contractManager.changeStatus(contractName, version, status);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedStatus = txResult.logs[0].args.status;

        assert.equal(eventName, "StatusChanged", "StatusChanged must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedStatus, status, "Received status must be the one which was passed");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        receivedStatus = versionData[1].toNumber();
       
        assert.equal(receivedStatus, status, "Received staus must be correctly set in the storage");
            
        contractVersions[contractName][version].status = status;
    });

    it("Change status of version to RC", async()=>{
        var contractName = contracts[0];
        var version = versions[0][0];
        var status = 1//RC;
        var txResult = await this.contractManager.changeStatus(contractName, version, status);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedStatus = txResult.logs[0].args.status;

        assert.equal(eventName, "StatusChanged", "StatusChanged must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedStatus, status, "Received status must be the one which was passed");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        receivedStatus = versionData[1].toNumber();
       
        assert.equal(receivedStatus, status, "Received staus must be correctly set in the storage");
            
        contractVersions[contractName][version].status = status;
    });


    it("Change status of version to DEPRECATED", async()=>{
        var contractName = contracts[0];
        var version = versions[0][0];
        var status = 3//DEPRECATED;
        var txResult = await this.contractManager.changeStatus(contractName, version, status);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedStatus = txResult.logs[0].args.status;

        assert.equal(eventName, "StatusChanged", "StatusChanged must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedStatus, status, "Received status must be the one which was passed");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        receivedStatus = versionData[1].toNumber();
       
        assert.equal(receivedStatus, status, "Received staus must be correctly set in the storage");
            
        contractVersions[contractName][version].status = status;
    });

    it("Change bug level of version to LOW", async()=>{
        var contractName = contracts[0];
        var version = versions[0][0];
        var bugLevel = 1//LOW;
        var txResult = await this.contractManager.changeBugLevel(contractName, version, bugLevel);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedBugLevel = txResult.logs[0].args.bugLevel;

        assert.equal(eventName, "BugLevelChanged", "BugLevelChanged must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedBugLevel, bugLevel, "Received bug level must be the one which was passed");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        var receivedbugLevel = versionData[2].toNumber();
       
        assert.equal(receivedbugLevel, bugLevel, "Received bug level must be correctly set in the storage");
            
        contractVersions[contractName][version].bugLevel = bugLevel;
    });
    it("Change bug level of version to MEDIUM", async()=>{
        var contractName = contracts[0];
        var version = versions[0][0];
        var bugLevel = 2//MEDIUM;
        var txResult = await this.contractManager.changeBugLevel(contractName, version, bugLevel);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedBugLevel = txResult.logs[0].args.bugLevel;

        assert.equal(eventName, "BugLevelChanged", "BugLevelChanged must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedBugLevel, bugLevel, "Received bug level must be the one which was passed");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        var receivedbugLevel = versionData[2].toNumber();
       
        assert.equal(receivedbugLevel, bugLevel, "Received bug level must be correctly set in the storage");
            
        contractVersions[contractName][version].bugLevel = bugLevel;
    });

   
    it("Change bug level of version to CRITICAL", async()=>{
        var contractName = contracts[0];
        var version = versions[0][0];
        var bugLevel = 4//CRITICAL;
        var txResult = await this.contractManager.changeBugLevel(contractName, version, bugLevel);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedBugLevel = txResult.logs[0].args.bugLevel;

        assert.equal(eventName, "BugLevelChanged", "BugLevelChanged must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedBugLevel, bugLevel, "Received bug level must be the one which was passed");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        var receivedbugLevel = versionData[2].toNumber();
       
        assert.equal(receivedbugLevel, bugLevel, "Received bug level must be correctly set in the storage");
            
        contractVersions[contractName][version].bugLevel = bugLevel;
    });

    it("Mark recommended version as DEPRECATED", async()=>{
        var contractName = contracts[0];

        var versionData = await this.contractManager.getRecommendedVersion(contractName);

        var version = versionData[0];
        
        var status = 3//DEPRECATED;
        
       
        await this.contractManager.changeStatus(contractName, version, status);
        
        contractVersions[contractName][version].status = status;

        var versionData = await this.contractManager.getRecommendedVersion(contractName);

        var receivedVersion = versionData[0];

        assert.equal(receivedVersion, '', "Recommended version should have been removed");
        
        //check version is still there and not removed
        versionData = await this.contractManager.getVersionDetails(contractName, version);

        var receivedVersion = versionData[0];
        var receivedStatus = versionData[1].toNumber();
        var receivedbugLevel = versionData[2].toNumber();
        var receivedImplementation = versionData[3];
        var receivedAudited = versionData[4];

        assert.equal(receivedVersion, contractVersions[contractName][version].version, "Received version must match the passed one");
        assert.equal(receivedStatus, contractVersions[contractName][version].status, "Received staus must be the one which was passed");
        assert.equal(receivedbugLevel, contractVersions[contractName][version].bugLevel, "Received bug level must match");
        assert.equal(receivedImplementation, contractVersions[contractName][version].implementation, "Received implementation must match the passed one");
        assert.equal(receivedAudited, contractVersions[contractName][version].audited, "Received audited must match");
           

    });

    it("Change bug level to critical for recommended version of a contract", async()=>{
         var contractName = contracts[0];
        var version = versions[0][1];
        var status = 2//PRODUCTION;
        await this.contractManager.changeStatus(contractName, version, status);
        contractVersions[contractName][version].status = status;

        await this.contractManager.markRecommendedVersion(contractName,version);


        var versionData = await this.contractManager.getRecommendedVersion(contractName);

        var version = versionData[0];

        var bugLevel = 4//CRITICAL;
        
        await this.contractManager.changeBugLevel(contractName, version, bugLevel);
     
        contractVersions[contractName][version].bugLevel = bugLevel;

        var versionData = await this.contractManager.getRecommendedVersion(contractName);

        var receivedVersion = versionData[0];

        assert.equal(receivedVersion, '', "Recommended version should have been removed");
        
        versionData = await this.contractManager.getVersionDetails(contractName, version);

        var receivedVersion = versionData[0];
        var receivedStatus = versionData[1].toNumber();
        var receivedbugLevel = versionData[2].toNumber();
        var receivedImplementation = versionData[3];
        var receivedAudited = versionData[4];

        assert.equal(receivedVersion, contractVersions[contractName][version].version, "Received version must match the passed one");
        assert.equal(receivedStatus, contractVersions[contractName][version].status, "Received staus must be the one which was passed");
        assert.equal(receivedbugLevel, contractVersions[contractName][version].bugLevel, "Received bug level must match");
        assert.equal(receivedImplementation, contractVersions[contractName][version].implementation, "Received implementation must match the passed one");
        assert.equal(receivedAudited, contractVersions[contractName][version].audited, "Received audited must match");


    });

    it("Change bug level of version to NONE", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];
        var bugLevel = 0//NONE;
        var txResult = await this.contractManager.changeBugLevel(contractName, version, bugLevel);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
        var receivedBugLevel = txResult.logs[0].args.bugLevel;

        assert.equal(eventName, "BugLevelChanged", "BugLevelChanged must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedBugLevel, bugLevel, "Received bug level must be the one which was passed");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getVersionDetails(contractName, version);

        var receivedbugLevel = versionData[2].toNumber();
       
        assert.equal(receivedbugLevel, bugLevel, "Received bug level must be correctly set in the storage");
            
        contractVersions[contractName][version].bugLevel = bugLevel;
    });

    it("Mark version as recommended", async()=>{
        var contractName = contracts[0];
        var version = versions[0][1];
        
        var txResult = await this.contractManager.markRecommendedVersion(contractName,version);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;
        var receivedVersion = txResult.logs[0].args.version;
       
        assert.equal(eventName, "VersionRecommended", "VersionRecommended must be fired");
        assert.equal(receivedVersion, version, "Received version must match the passed one");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getRecommendedVersion(contractName);

        receivedVersion = versionData[0];
       
        var receivedImplementation = versionData[3];
        

        assert.equal(receivedVersion, version, "Received version must match the passed one");
        
        assert.equal(receivedImplementation, contractVersions[contractName][version].implementation, "Recommended version's implementation address must with the actual set one");
        

    });

    it("Remove recommended version", async()=>{
        var contractName = contracts[0];

        var versionData = await this.contractManager.getRecommendedVersion(contractName);

        var version = versionData[0];

        var txResult = await this.contractManager.removeRecommendedVersion(contractName);

        var eventName = txResult.logs[0].event;
        var receivedContractName = txResult.logs[0].args.contractName;

        assert.equal(eventName, "RecommendedVersionRemoved", "RecommendedVersionRemoved must be fired");
        assert.equal(receivedContractName, contractName, "Received contract name must match the passed contract name");

        var versionData = await this.contractManager.getRecommendedVersion(contractName);

        var receivedVersion = versionData[0];

        assert.equal(receivedVersion, '', "Recommended version should have been removed");
        
        versionData = await this.contractManager.getVersionDetails(contractName, version);

        var receivedVersion = versionData[0];
        var receivedStatus = versionData[1].toNumber();
        var receivedbugLevel = versionData[2].toNumber();
        var receivedImplementation = versionData[3];
        var receivedAudited = versionData[4];

        assert.equal(receivedVersion, contractVersions[contractName][version].version, "Received version must match the passed one");
        assert.equal(receivedStatus, contractVersions[contractName][version].status, "Received staus must be the one which was passed");
        assert.equal(receivedbugLevel, contractVersions[contractName][version].bugLevel, "Received bug level must match");
        assert.equal(receivedImplementation, contractVersions[contractName][version].implementation, "Received implementation must match the passed one");
        assert.equal(receivedAudited, contractVersions[contractName][version].audited, "Received audited must match");

    }); 

    it("Add version with implementation address as non-contract address", async()=>{
       

        var contractName = contracts[0];
        var version =  "v1.2";
        var status = 0;
        var _implementation = accounts[7];
        var _auditor = accounts[2];
        try{
        await this.contractManager.addVersion(contractName, version, status, _implementation, _auditor);
        assert.equal(true, false, "Should not be able to add version with implementaion address as non-contract address");
    
        } catch(error){
        assert.notInclude(error.toString(), 'AssertionError', error.message);        
        }

    })

});

