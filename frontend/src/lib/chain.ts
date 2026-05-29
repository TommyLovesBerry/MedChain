import { JsonRpcProvider, Wallet, Contract, Signer, ContractRunner, Mnemonic, HDNodeWallet } from "ethers";
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
  PatientEve:    { idx: 6, pk: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e" },
  DoctorFrank:   { idx: 7, pk: "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356" },
  PatientGrace:  { idx: 8, pk: "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97" },
  DoctorHeidi:   { idx: 9, pk: "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6" },
} as const;

export type RoleName = keyof typeof PRIVATE_KEYS;

export const provider = new JsonRpcProvider("http://127.0.0.1:8545");

export const ROLES = Object.fromEntries(
  (Object.entries(PRIVATE_KEYS) as [RoleName, { idx: number; pk: string }][])
    .map(([name, { idx, pk }]) => [name, { idx, pk, address: new Wallet(pk).address }])
) as Record<RoleName, { idx: number; pk: string; address: string }>;

// All 20 default Hardhat accounts, derived from the standard test mnemonic.
// Used so that any account added by address (e.g. via the admin form) can still
// instant-sign in the demo if it happens to be a well-known Hardhat account.
const HH_MNEMONIC = "test test test test test test test test test test test junk";
const HARDHAT_PK_BY_ADDR: Record<string, string> = (() => {
  const m = Mnemonic.fromPhrase(HH_MNEMONIC);
  const out: Record<string, string> = {};
  for (let i = 0; i < 20; i++) {
    const w = HDNodeWallet.fromMnemonic(m, `m/44'/60'/0'/0/${i}`);
    out[w.address.toLowerCase()] = w.privateKey;
  }
  return out;
})();

/** Returns the demo private key for an address if it is a known Hardhat account. */
export function pkForAddress(address: string): string | undefined {
  return HARDHAT_PK_BY_ADDR[address.toLowerCase()];
}

export function walletFor(role: RoleName) {
  return new Wallet(ROLES[role].pk, provider);
}

// A selectable actor in the UI. `pk` is present only when we can instant-sign
// for it (a known Hardhat account); otherwise writes require a MetaMask signer.
export type Identity = {
  key: string;     // unique selection id (the address)
  label: string;
  address: string;
  pk?: string;
  kind: "admin" | "doctor" | "patient";
};

export type ChainCtx = {
  auditLog: Contract;
  patientRegistry: Contract;
  providerRegistry: Contract;
  accessControl: Contract;
  recordManager: Contract;
  me: string;
};

// `contracts(identity)` signs with the identity's demo key when available
// (no MetaMask popup). When a MetaMask signer is supplied it is used for writes
// instead, and `me` is the connected MetaMask address. Identities without a demo
// key and without MetaMask are read-only (view calls still work).
export function contracts(identity: Identity, mmSigner?: Signer, mmAddress?: string): ChainCtx {
  const runner: ContractRunner =
    mmSigner ?? (identity.pk ? new Wallet(identity.pk, provider) : provider);
  const me = mmAddress ?? identity.address;
  return {
    auditLog:         new Contract(addresses.AuditLog,         abis.AuditLog,         runner),
    patientRegistry:  new Contract(addresses.PatientRegistry,  abis.PatientRegistry,  runner),
    providerRegistry: new Contract(addresses.ProviderRegistry, abis.ProviderRegistry, runner),
    accessControl:    new Contract(addresses.AccessControl,    abis.AccessControl,    runner),
    recordManager:    new Contract(addresses.RecordManager,    abis.RecordManager,    runner),
    me,
  };
}

export { addresses };
