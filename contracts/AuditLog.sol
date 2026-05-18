// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AuditLog {
    address public owner;

    struct LogEntry {
        address actor;     // address that performed the action
        address subject;   // patient the action concerns
        string  action;    // e.g. "GRANT_ACCESS", "UPLOAD_RECORD"
        uint256 timestamp;
    }

    LogEntry[] private logs;
    mapping(address => bool) public authorizedCallers;

    event Logged(
        uint256 indexed id,
        address indexed actor,
        address indexed subject,
        string action,
        uint256 timestamp
    );
    event AuthorizedCallerAdded(address indexed caller);
    event AuthorizedCallerRemoved(address indexed caller);
    // event OwnershipTransferred(address indexed from, address indexed to);  (suggested addition, look into if enough time)

    modifier onlyOwner() {
        require(msg.sender == owner, "AuditLog: not owner");
        _;
    }

    modifier onlyAuthorized() {
        require(
            authorizedCallers[msg.sender] || msg.sender == owner,
            "AuditLog: not authorized"
        );
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // TODO: functions
    // logEvent()


}