import { JsonRpcProvider, Wallet, Contract } from "ethers";
import addresses from "../contracts/addresses.json";
import abis from "../contracts/abis.json";

// Hardhat's default test mnemonic gives well-known accounts.
// We use them directly (no MetaMask) for a frictionless live demo.
// Account #0 = deployer, #1 = hospital admin. Patients/doctors get assigned below.
export const ROLES = {
  Deployer:      { idx: 0, address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", pk: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
  HospitalAdmin: { idx: 1, address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", pk: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
  PatientAlice:  { idx: 2, address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", pk: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
  DoctorBob:     { idx: 3, address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", pk: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" },
  PatientCarol:  { idx: 4, address: "0x15d34AaF54267DB7D7c367839AAf71A00a2C6A65", pk: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" },
  DoctorDave:    { idx: 5, address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", pk: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" },
} as const;

export type RoleName = keyof typeof ROLES;

export const provider = new JsonRpcProvider("http://127.0.0.1:8545");

export function walletFor(role: RoleName) {
  return new Wallet(ROLES[role].pk, provider);
}

export function contracts(role: RoleName) {
  const signer = walletFor(role);
  return {
    auditLog:         new Contract(addresses.AuditLog,         abis.AuditLog,         signer),
    patientRegistry:  new Contract(addresses.PatientRegistry,  abis.PatientRegistry,  signer),
    providerRegistry: new Contract(addresses.ProviderRegistry, abis.ProviderRegistry, signer),
    accessControl:    new Contract(addresses.AccessControl,    abis.AccessControl,    signer),
    recordManager:    new Contract(addresses.RecordManager,    abis.RecordManager,    signer),
    me: signer.address,
  };
}

export { addresses };
