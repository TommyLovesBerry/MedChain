// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAccessControl {
    function checkAccess(address patient, address provider) external view returns (bool);
}

interface IAuditLogRM {
    function logEvent(address actor, address subject, address counterparty, string calldata action) external;
}

contract RecordManager {
    IAccessControl public accessControl;
    IAuditLogRM    public auditLog;

    // Comments suggest potential fields... look into these if enough time
    struct Record {
        address provider;
        address patient;
        string  cid;             // CID of encrypted file on IPFS
        // string  recordType;
        // uint256 timestamp;
        uint256 previousVersion; // 0 if original
        // bool    superseded;      
    }

    Record[] private records;
    mapping(address => uint256[]) private patientRecords; // patient => record ids

    // TODO: Events here

    constructor(address _accessControl, address _auditLog) {
        require(_accessControl != address(0), "RecordManager: zero accessControl");
        require(_auditLog != address(0), "RecordManager: zero auditLog");
        accessControl = IAccessControl(_accessControl);
        auditLog      = IAuditLogRM(_auditLog);
    }

    // TODO: functions

    // function updateRecord() external returns (uint256) {
    //     return 0;
    // }

    // function getRecord() external view returns (Record memory) {
    //     return 0;
    // }

    
}