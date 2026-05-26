import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const PATIENT_PUBKEY = "0xPATIENT_PUBKEY_DEMO";
const CID_V1 = "QmDemoCidV1";
const CID_V2 = "QmDemoCidV2";

async function deployFixture() {
  const [deployer, hospitalAdmin, patient, doctor, otherDoctor, outsider] = await ethers.getSigners();

  const AuditLog = await ethers.getContractFactory("AuditLog");
  const auditLog = await AuditLog.deploy();

  const PatientRegistry = await ethers.getContractFactory("PatientRegistry");
  const patientRegistry = await PatientRegistry.deploy();

  const ProviderRegistry = await ethers.getContractFactory("ProviderRegistry");
  const providerRegistry = await ProviderRegistry.deploy(hospitalAdmin.address, await auditLog.getAddress());

  const AccessControl = await ethers.getContractFactory("AccessControl");
  const accessControl = await AccessControl.deploy(
    await patientRegistry.getAddress(),
    await providerRegistry.getAddress(),
    await auditLog.getAddress(),
  );

  const RecordManager = await ethers.getContractFactory("RecordManager");
  const recordManager = await RecordManager.deploy(
    await accessControl.getAddress(),
    await providerRegistry.getAddress(),
    await patientRegistry.getAddress(),
    await auditLog.getAddress(),
  );

  await auditLog.authorise(await providerRegistry.getAddress());
  await auditLog.authorise(await accessControl.getAddress());
  await auditLog.authorise(await recordManager.getAddress());

  return { auditLog, patientRegistry, providerRegistry, accessControl, recordManager,
           deployer, hospitalAdmin, patient, doctor, otherDoctor, outsider };
}

describe("MedChain — full BPMN flow", () => {
  it("walks register → onboard → grant → upload → update → revoke → audit", async () => {
    const { patientRegistry, providerRegistry, accessControl, recordManager, auditLog,
            hospitalAdmin, patient, doctor } = await loadFixture(deployFixture);

    // patient self-registers
    await expect(patientRegistry.connect(patient).registerPatient(PATIENT_PUBKEY))
      .to.emit(patientRegistry, "PatientRegistered");
    expect(await patientRegistry.isPatient(patient.address)).to.equal(true);

    // hospital admin onboards doctor
    await expect(providerRegistry.connect(hospitalAdmin).registerProvider(doctor.address, "Dr Smith"))
      .to.emit(providerRegistry, "ProviderRegistered");
    expect(await providerRegistry.isActiveProvider(doctor.address)).to.equal(true);

    // patient grants doctor access
    await expect(accessControl.connect(patient).grantAccess(doctor.address))
      .to.emit(accessControl, "AccessGranted");
    expect(await accessControl.checkAccess(patient.address, doctor.address)).to.equal(true);

    // doctor uploads a record
    await expect(recordManager.connect(doctor).uploadRecord(patient.address, CID_V1))
      .to.emit(recordManager, "RecordUploaded");
    const ids = await recordManager.connect(patient).getRecordIdsForPatient(patient.address);
    expect(ids.length).to.equal(1);

    // doctor updates the record (version chain)
    await expect(recordManager.connect(doctor).updateRecord(0, CID_V2))
      .to.emit(recordManager, "RecordUpdated");
    const r0 = await recordManager.connect(patient).getRecord(0);
    const r1 = await recordManager.connect(patient).getRecord(1);
    expect(r0.superseded).to.equal(true);
    expect(r1.cid).to.equal(CID_V2);
    expect(r1.previousVersion).to.equal(0n);

    // patient revokes
    await expect(accessControl.connect(patient).revokeAccess(doctor.address))
      .to.emit(accessControl, "AccessRevoked");
    expect(await accessControl.checkAccess(patient.address, doctor.address)).to.equal(false);

    // doctor can no longer upload
    await expect(recordManager.connect(doctor).uploadRecord(patient.address, "QmShouldFail"))
      .to.be.revertedWith("RecordManager: no access");

    // audit log captured every on-chain event for this patient
    const logs = await auditLog.getLogsForSubject(patient.address);
    const actions = logs.map((l: any) => l.action);
    expect(actions).to.include.members(["GRANT_ACCESS", "UPLOAD_RECORD", "UPDATE_RECORD", "REVOKE_ACCESS"]);
  });
});

describe("PatientRegistry", () => {
  it("rejects double registration", async () => {
    const { patientRegistry, patient } = await loadFixture(deployFixture);
    await patientRegistry.connect(patient).registerPatient(PATIENT_PUBKEY);
    await expect(patientRegistry.connect(patient).registerPatient(PATIENT_PUBKEY))
      .to.be.revertedWith("PatientRegistry: already registered");
  });
});

describe("ProviderRegistry", () => {
  it("only admin can register", async () => {
    const { providerRegistry, outsider, doctor } = await loadFixture(deployFixture);
    await expect(providerRegistry.connect(outsider).registerProvider(doctor.address, "x"))
      .to.be.revertedWith("ProviderRegistry: not hospital admin");
  });

  it("revoke flips active to false", async () => {
    const { providerRegistry, hospitalAdmin, doctor } = await loadFixture(deployFixture);
    await providerRegistry.connect(hospitalAdmin).registerProvider(doctor.address, "Dr S");
    await providerRegistry.connect(hospitalAdmin).revokeProvider(doctor.address);
    expect(await providerRegistry.isActiveProvider(doctor.address)).to.equal(false);
  });

  it("allows re-onboarding a revoked provider without duplicating the directory", async () => {
    const { providerRegistry, hospitalAdmin, doctor } = await loadFixture(deployFixture);
    await providerRegistry.connect(hospitalAdmin).registerProvider(doctor.address, "Dr S");
    await providerRegistry.connect(hospitalAdmin).revokeProvider(doctor.address);
    await providerRegistry.connect(hospitalAdmin).registerProvider(doctor.address, "Dr S (returned)");
    expect(await providerRegistry.isActiveProvider(doctor.address)).to.equal(true);
    expect(await providerRegistry.providerCount()).to.equal(1n);
    const p = await providerRegistry.getProvider(doctor.address);
    expect(p.name).to.equal("Dr S (returned)");
  });

  it("rejects re-register when provider is currently active", async () => {
    const { providerRegistry, hospitalAdmin, doctor } = await loadFixture(deployFixture);
    await providerRegistry.connect(hospitalAdmin).registerProvider(doctor.address, "Dr S");
    await expect(providerRegistry.connect(hospitalAdmin).registerProvider(doctor.address, "Dr X"))
      .to.be.revertedWith("ProviderRegistry: already active");
  });
});

describe("AccessControl", () => {
  it("rejects grant when caller is not a registered patient", async () => {
    const { accessControl, providerRegistry, hospitalAdmin, doctor, outsider } = await loadFixture(deployFixture);
    await providerRegistry.connect(hospitalAdmin).registerProvider(doctor.address, "Dr S");
    await expect(accessControl.connect(outsider).grantAccess(doctor.address))
      .to.be.revertedWith("AccessControl: caller not a patient");
  });

  it("rejects grant for inactive provider", async () => {
    const { accessControl, patientRegistry, providerRegistry, hospitalAdmin, patient, doctor } = await loadFixture(deployFixture);
    await patientRegistry.connect(patient).registerPatient(PATIENT_PUBKEY);
    await providerRegistry.connect(hospitalAdmin).registerProvider(doctor.address, "Dr S");
    await providerRegistry.connect(hospitalAdmin).revokeProvider(doctor.address);
    await expect(accessControl.connect(patient).grantAccess(doctor.address))
      .to.be.revertedWith("AccessControl: provider not active");
  });
});

describe("RecordManager", () => {
  it("rejects getRecord from unauthorised viewer", async () => {
    const { recordManager, accessControl, patientRegistry, providerRegistry, hospitalAdmin, patient, doctor, outsider } = await loadFixture(deployFixture);
    await patientRegistry.connect(patient).registerPatient(PATIENT_PUBKEY);
    await providerRegistry.connect(hospitalAdmin).registerProvider(doctor.address, "Dr S");
    await accessControl.connect(patient).grantAccess(doctor.address);
    await recordManager.connect(doctor).uploadRecord(patient.address, CID_V1);
    await expect(recordManager.connect(outsider).getRecord(0))
      .to.be.revertedWith("RecordManager: not authorised to view");
  });
});

describe("AuditLog", () => {
  it("blocks unauthorised callers from logging", async () => {
    const { auditLog, outsider } = await loadFixture(deployFixture);
    await expect(auditLog.connect(outsider).logEvent(outsider.address, outsider.address, outsider.address, "SPOOF"))
      .to.be.revertedWith("AuditLog: not authorised");
  });
});
