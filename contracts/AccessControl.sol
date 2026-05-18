// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IPatientRegistry {
    function isPatient(address addr) external view returns (bool);
}

interface IProviderRegistry {
    function isActiveProvider(address addr) external view returns (bool);
}

interface IAuditLog {
    function logEvent(address actor, address subject, string calldata action) external;
}

contract AccessControl {
    IPatientRegistry  public patientRegistry;
    IProviderRegistry public providerRegistry;
    IAuditLog         public auditLog;

    // patient => provider => granted?
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

    // TODO: functions
    // grantAccess, revokeAccess, checkAccess

}