// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ProviderRegistry {
    address public hospitalAdmin;

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

    constructor(address _hospitalAdmin) {
        require(_hospitalAdmin != address(0), "ProviderRegistry: zero admin");
        hospitalAdmin = _hospitalAdmin;
    }

    // TODO: functions
    // registerProvider, revokeProvider, isProvider, getProvider

}