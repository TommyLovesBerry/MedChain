// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPatientRegistry {
    function isPatient(address addr) external view returns (bool);
}

interface IProviderRegistry {
    function isActiveProvider(address addr) external view returns (bool);
}

interface IAuditLog {
    function logEvent(address actor, address subject, address relatedParty, string calldata action) external;
}

contract AccessControl {
    IPatientRegistry  public patientRegistry;
    IProviderRegistry public providerRegistry;
    IAuditLog         public auditLog;

    // permissions mapping: patient => provider => granted?
    mapping(address => mapping(address => bool)) private permissions;

    event AccessGranted(address indexed patient, address indexed provider, uint256 timestamp);
    event AccessRevoked(address indexed patient, address indexed provider, uint256 timestamp);

    constructor(address _patientRegistry, address _providerRegistry, address _auditLog) {
        require(_patientRegistry != address(0), "AccessControl: zero patientRegistry");
        require(_providerRegistry != address(0), "AccessControl: zero providerRegistry");
        require(_auditLog != address(0), "AccessControl: zero auditLog");
        patientRegistry  = IPatientRegistry(_patientRegistry);
        providerRegistry = IProviderRegistry(_providerRegistry);
        auditLog         = IAuditLog(_auditLog);
    }


    function grantAccess(address provider) external {
        // require patient exists, provider is active, check if access is not already granted
        require(patientRegistry.isPatient(msg.sender), "AccessControl: caller not a patient");
        require(providerRegistry.isActiveProvider(provider), "AccessControl: provider not active");
        require(!permissions[msg.sender][provider], "AccessControl: already granted");

        permissions[msg.sender][provider] = true;

        emit AccessGranted(msg.sender, provider, block.timestamp);
        auditLog.logEvent(msg.sender, msg.sender, provider, "GRANT_ACCESS");
    }

    function revokeAccess(address provider) external {
        // require patient exists and provider does not already have access
        require(patientRegistry.isPatient(msg.sender), "AccessControl: caller not a patient");
        require(permissions[msg.sender][provider], "AccessControl: no access to revoke");

        permissions[msg.sender][provider] = false;

        emit AccessRevoked(msg.sender, provider, block.timestamp);
        auditLog.logEvent(msg.sender, msg.sender, provider, "REVOKE_ACCESS");
    }

    function checkAccess(address patient, address provider) external view returns(bool) {
        return permissions[patient][provider];
    }

}