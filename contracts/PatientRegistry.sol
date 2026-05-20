// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PatientRegistry {
    struct Patient {
        address wallet;
        string  publicKey;     // off-chain encryption public key
        bool    exists;
    }

    mapping(address => Patient) private patients;
    address[] private patientList;

    event PatientRegistered(address indexed patient, uint256 timestamp);

    // TODO: functions
    // registerPatient, isPatient, getPatient, 

    function registerPatient(string calldata publicKey) external {
        require(!patients[msg.sender].exists, "PatientRegistry: already registered");

        patients[msg.sender] = Patient({
            wallet: msg.sender,
            publicKey: publicKey,
            exists: true
        });

        patientList.push(msg.sender);
        emit PatientRegistered(msg.sender, block.timestamp);
    }

    function isPatient(address addr) external view returns (bool) {
        return patients[addr].exists;
    }

    function getPatient(address addr) external view returns (Patient memory) {
        require(patients[addr].exists, "PatientRegistry: not registered");
        return patients[addr];
    }

    function patientCount() external view returns (uint256) {
        return patientList.length;
    }

}