import { ethers } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer, hospitalAdmin] = await ethers.getSigners();

  console.log("Deployer:       ", deployer.address);
  console.log("Hospital admin: ", hospitalAdmin.address);

  // 1. AuditLog — owned by deployer; will authorise the other contracts below.
  const AuditLog = await ethers.getContractFactory("AuditLog");
  const auditLog = await AuditLog.deploy();
  await auditLog.waitForDeployment();
  const auditLogAddr = await auditLog.getAddress();
  console.log("AuditLog:        ", auditLogAddr);

  // 2. PatientRegistry — self-service, no dependencies.
  const PatientRegistry = await ethers.getContractFactory("PatientRegistry");
  const patientRegistry = await PatientRegistry.deploy();
  await patientRegistry.waitForDeployment();
  const patientRegistryAddr = await patientRegistry.getAddress();
  console.log("PatientRegistry: ", patientRegistryAddr);

  // 3. ProviderRegistry — hospitalAdmin signer onboards doctors.
  const ProviderRegistry = await ethers.getContractFactory("ProviderRegistry");
  const providerRegistry = await ProviderRegistry.deploy(hospitalAdmin.address, auditLogAddr);
  await providerRegistry.waitForDeployment();
  const providerRegistryAddr = await providerRegistry.getAddress();
  console.log("ProviderRegistry:", providerRegistryAddr);

  // 4. AccessControl
  const AccessControl = await ethers.getContractFactory("AccessControl");
  const accessControl = await AccessControl.deploy(patientRegistryAddr, providerRegistryAddr, auditLogAddr);
  await accessControl.waitForDeployment();
  const accessControlAddr = await accessControl.getAddress();
  console.log("AccessControl:   ", accessControlAddr);

  // 5. RecordManager
  const RecordManager = await ethers.getContractFactory("RecordManager");
  const recordManager = await RecordManager.deploy(accessControlAddr, providerRegistryAddr, patientRegistryAddr, auditLogAddr);
  await recordManager.waitForDeployment();
  const recordManagerAddr = await recordManager.getAddress();
  console.log("RecordManager:   ", recordManagerAddr);

  // Wire up AuditLog: any contract that calls logEvent() must be authorised.
  await (await auditLog.authorise(providerRegistryAddr)).wait();
  await (await auditLog.authorise(accessControlAddr)).wait();
  await (await auditLog.authorise(recordManagerAddr)).wait();
  console.log("AuditLog: authorised PR, AC, RM");

  // Write addresses to a JSON file the frontend reads.
  const addresses = {
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    hospitalAdmin: hospitalAdmin.address,
    AuditLog: auditLogAddr,
    PatientRegistry: patientRegistryAddr,
    ProviderRegistry: providerRegistryAddr,
    AccessControl: accessControlAddr,
    RecordManager: recordManagerAddr,
  };
  const outDir = join(__dirname, "..", "frontend", "src", "contracts");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "addresses.json"), JSON.stringify(addresses, null, 2));

  // Emit ABIs (just the abi field, not the full hardhat artifact) for the frontend.
  const names = ["AuditLog", "PatientRegistry", "ProviderRegistry", "AccessControl", "RecordManager"];
  const abis: Record<string, any> = {};
  for (const n of names) {
    const art = await import(`../artifacts-hh/contracts/${n}.sol/${n}.json`);
    abis[n] = art.abi;
  }
  writeFileSync(join(outDir, "abis.json"), JSON.stringify(abis, null, 2));
  console.log("\nWrote frontend/src/contracts/{addresses,abis}.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
