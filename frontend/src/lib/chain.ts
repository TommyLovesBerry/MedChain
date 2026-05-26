import { JsonRpcProvider, Wallet, Contract, Signer } from "ethers";
import addresses from "../contracts/addresses.json";
import abis from "../contracts/abis.json";

// Hardhat's default test mnemonic gives well-known accounts.
// We derive the address from each private key at module load so there's no chance
// of an EIP-55 checksum typo in a hardcoded string.
const PRIVATE_KEYS = {
  Deployer:      { idx: 0, pk: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" },
  HospitalAdmin: { idx: 1, pk: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" },
  PatientAlice:  { idx: 2, pk: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" },
  DoctorBob:     { idx: 3, pk: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" },
  PatientCarol:  { idx: 4, pk: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" },
  DoctorDave:    { idx: 5, pk: "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" },
} as const;

export type RoleName = keyof typeof PRIVATE_KEYS;

export const provider = new JsonRpcProvider("http://127.0.0.1:8545");

export const ROLES = Object.fromEntries(
  (Object.entries(PRIVATE_KEYS) as [RoleName, { idx: number; pk: string }][])
    .map(([name, { idx, pk }]) => [name, { idx, pk, address: new Wallet(pk).address }])
) as Record<RoleName, { idx: number; pk: string; address: string }>;

export function walletFor(role: RoleName) {
  return new Wallet(ROLES[role].pk, provider);
}

export type ChainCtx = {
  auditLog: Contract;
  patientRegistry: Contract;
  providerRegistry: Contract;
  accessControl: Contract;
  recordManager: Contract;
  me: string;
};

// `contracts(role)` uses the well-known Hardhat test key for that role (no MetaMask popup).
// `contracts(role, mmSigner, mmAddress)` uses the MetaMask signer for writes (popup!) but
// still binds the panel/view to `role` and shows the connected MetaMask address as `me`.
export function contracts(role: RoleName, mmSigner?: Signer, mmAddress?: string): ChainCtx {
  const signer: Signer = mmSigner ?? walletFor(role);
  const me = mmAddress ?? (signer as Wallet).address;
  return {
    auditLog:         new Contract(addresses.AuditLog,         abis.AuditLog,         signer),
    patientRegistry:  new Contract(addresses.PatientRegistry,  abis.PatientRegistry,  signer),
    providerRegistry: new Contract(addresses.ProviderRegistry, abis.ProviderRegistry, signer),
    accessControl:    new Contract(addresses.AccessControl,    abis.AccessControl,    signer),
    recordManager:    new Contract(addresses.RecordManager,    abis.RecordManager,    signer),
    me,
  };
}

export { addresses };
