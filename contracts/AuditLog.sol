// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AuditLog {
    address public owner;

    struct LogEntry {
        address actor;        // address that performed the action
        address subject;      // patient the action concerns
        address counterparty; // related party the action concerns (eg, provider)
        string  action;       // e.g. "GRANT_ACCESS", "UPLOAD_RECORD"
        uint256 timestamp;
    }

    LogEntry[] private logs;
    mapping(address => bool) public authorisedCallers;

    event Logged(
        uint256 indexed id,
        address indexed actor,
        address indexed subject,
        address counterparty,
        string action,
        uint256 timestamp
    );
    event AuthorisedCallerAdded(address indexed caller);
    event AuthorisedCallerRemoved(address indexed caller);
    event OwnershipTransferred(address indexed from, address indexed to);

    modifier onlyOwner() {
        require(msg.sender == owner, "AuditLog: not owner");
        _;
    }

    modifier onlyAuthorised() {
        require(authorisedCallers[msg.sender] || msg.sender == owner, "AuditLog: not authorised");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function authorise(address caller) external onlyOwner {
        authorisedCallers[caller] = true;
        emit AuthorisedCallerAdded(caller);
    }

    function deauthorise(address caller) external onlyOwner {
        authorisedCallers[caller] = false;
        emit AuthorisedCallerRemoved(caller);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "AuditLog: zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function logEvent(
        address actor,
        address subject,
        address counterparty,
        string calldata action
    ) external onlyAuthorised {
        // pushes logEvent to array of logs
        logs.push(LogEntry(actor, subject, counterparty, action, block.timestamp));
        // emits Logged event
        emit Logged(
            logs.length - 1,
            actor,
            subject,
            counterparty,
            action, 
            block.timestamp);
    }

    function getLogCount() external view returns (uint256) {
        return logs.length;
    }

    function getLogsForSubject(address subject) external view returns (LogEntry[] memory) {
        // Count how many logs there are related to subject
        uint256 count = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].subject == subject) count++;
        }

        // Use the count to intiialise a new array for result logs
        LogEntry[] memory result = new LogEntry[](count);
        
        // Iterate throuh logs again
        // If subject matches, add log to results array
        uint256 j = 0;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].subject == subject) {
                result[j] = logs[i];
                j++;
            }
        }
        return result;
    }

    // MAYBE: getLogsForId, getLogsForCounterparty
    // ^^ more useful audit trail if we have time

}