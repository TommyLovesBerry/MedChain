// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IAuditLogPR {
    function logEvent(address actor, address subject, address counterparty, string calldata action) external;
}

contract ProviderRegistry {
    address public hospitalAdmin;
    IAuditLogPR public auditLog;

    struct Provider {
        address wallet;
        string  name;
        bool    active;
    }

    mapping(address => Provider) private providers;
    address[] private providerList;

    event ProviderRegistered(address indexed provider, string name, uint256 timestamp);
    event ProviderRevoked(address indexed provider, uint256 timestamp);
    event AdminTransferred(address indexed from, address indexed to);

    modifier onlyAdmin() {
        require(msg.sender == hospitalAdmin, "ProviderRegistry: not hospital admin");
        _;
    }

    constructor(address _hospitalAdmin, address _auditLog) {
        require(_hospitalAdmin != address(0), "ProviderRegistry: zero admin");
        require(_auditLog != address(0), "ProviderRegistry: zero auditLog");
        hospitalAdmin = _hospitalAdmin;
        auditLog = IAuditLogPR(_auditLog);
    }

    function registerProvider(address provider, string calldata name) external onlyAdmin {
        require(provider != address(0), "ProviderRegistry: zero provider");
        require(providers[provider].wallet == address(0), "ProviderRegistry: already registered");

        providers[provider] = Provider({wallet: provider, name: name, active: true});
        providerList.push(provider);

        emit ProviderRegistered(provider, name, block.timestamp);
        auditLog.logEvent(msg.sender, provider, provider, "REGISTER_PROVIDER");
    }

    function revokeProvider(address provider) external onlyAdmin {
        require(providers[provider].active, "ProviderRegistry: not active");
        providers[provider].active = false;

        emit ProviderRevoked(provider, block.timestamp);
        auditLog.logEvent(msg.sender, provider, provider, "REVOKE_PROVIDER");
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "ProviderRegistry: zero address");
        emit AdminTransferred(hospitalAdmin, newAdmin);
        hospitalAdmin = newAdmin;
    }

    function isActiveProvider(address addr) external view returns (bool) {
        return providers[addr].active;
    }

    function getProvider(address addr) external view returns (Provider memory) {
        require(providers[addr].wallet != address(0), "ProviderRegistry: not registered");
        return providers[addr];
    }

    function providerCount() external view returns (uint256) {
        return providerList.length;
    }
}
