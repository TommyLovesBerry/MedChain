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

    // TODO: functions
    // registerPatient, isPatient, getPatient, 

}