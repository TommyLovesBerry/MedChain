// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAccessControl {
    function checkAccess(address patient, address provider) external view returns (bool);
}

interface IProviderRegistryRM {
    function isActiveProvider(address addr) external view returns (bool);
}

interface IPatientRegistryRM {
    function isPatient(address addr) external view returns (bool);
}

interface IAuditLogRM {
    function logEvent(address actor, address subject, address counterparty, string calldata action) external;
}

contract RecordManager {
    IAccessControl        public accessControl;
    IProviderRegistryRM   public providerRegistry;
    IPatientRegistryRM    public patientRegistry;
    IAuditLogRM           public auditLog;

    struct Record {
        address provider;
        address patient;
        string  cid;             // CID of encrypted file on IPFS
        uint256 timestamp;
        uint256 previousVersion; // 0 if original, else id of prior version
        bool    superseded;
    }

    Record[] private records;
    mapping(address => uint256[]) private patientRecords; // patient => record ids

    event RecordUploaded(uint256 indexed id, address indexed patient, address indexed provider, string cid, uint256 timestamp);
    event RecordUpdated(uint256 indexed newId, uint256 indexed previousId, address indexed patient, address provider, string cid, uint256 timestamp);

    constructor(address _accessControl, address _providerRegistry, address _patientRegistry, address _auditLog) {
        require(_accessControl != address(0), "RecordManager: zero accessControl");
        require(_providerRegistry != address(0), "RecordManager: zero providerRegistry");
        require(_patientRegistry != address(0), "RecordManager: zero patientRegistry");
        require(_auditLog != address(0), "RecordManager: zero auditLog");
        accessControl    = IAccessControl(_accessControl);
        providerRegistry = IProviderRegistryRM(_providerRegistry);
        patientRegistry  = IPatientRegistryRM(_patientRegistry);
        auditLog         = IAuditLogRM(_auditLog);
    }

    function uploadRecord(address patient, string calldata cid) external returns (uint256) {
        require(providerRegistry.isActiveProvider(msg.sender), "RecordManager: caller not active provider");
        require(patientRegistry.isPatient(patient), "RecordManager: patient not registered");
        require(accessControl.checkAccess(patient, msg.sender), "RecordManager: no access");
        require(bytes(cid).length > 0, "RecordManager: empty cid");

        records.push(Record({
            provider: msg.sender,
            patient: patient,
            cid: cid,
            timestamp: block.timestamp,
            previousVersion: 0,
            superseded: false
        }));
        uint256 id = records.length - 1;
        patientRecords[patient].push(id);

        emit RecordUploaded(id, patient, msg.sender, cid, block.timestamp);
        auditLog.logEvent(msg.sender, patient, msg.sender, "UPLOAD_RECORD");
        return id;
    }

    function updateRecord(uint256 previousId, string calldata cid) external returns (uint256) {
        require(previousId < records.length, "RecordManager: bad id");
        Record storage prev = records[previousId];
        require(!prev.superseded, "RecordManager: already superseded");
        require(providerRegistry.isActiveProvider(msg.sender), "RecordManager: caller not active provider");
        require(accessControl.checkAccess(prev.patient, msg.sender), "RecordManager: no access");
        require(bytes(cid).length > 0, "RecordManager: empty cid");

        prev.superseded = true;
        records.push(Record({
            provider: msg.sender,
            patient: prev.patient,
            cid: cid,
            timestamp: block.timestamp,
            previousVersion: previousId,
            superseded: false
        }));
        uint256 newId = records.length - 1;
        patientRecords[prev.patient].push(newId);

        emit RecordUpdated(newId, previousId, prev.patient, msg.sender, cid, block.timestamp);
        auditLog.logEvent(msg.sender, prev.patient, msg.sender, "UPDATE_RECORD");
        return newId;
    }

    function getRecord(uint256 id) external view returns (Record memory) {
        require(id < records.length, "RecordManager: bad id");
        Record memory r = records[id];
        // patient can always read their own records; provider must have current access
        require(
            msg.sender == r.patient || accessControl.checkAccess(r.patient, msg.sender),
            "RecordManager: not authorised to view"
        );
        return r;
    }

    function getRecordIdsForPatient(address patient) external view returns (uint256[] memory) {
        require(
            msg.sender == patient || accessControl.checkAccess(patient, msg.sender),
            "RecordManager: not authorised to view"
        );
        return patientRecords[patient];
    }

    function recordCount() external view returns (uint256) {
        return records.length;
    }
}
