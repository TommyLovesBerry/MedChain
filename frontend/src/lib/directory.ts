// Shared address-book of doctors and patients shown across the panels.
//
// Seeded with the built-in Hardhat demo accounts so the existing demo keeps
// working, and extendable at runtime via the UI. Additions are persisted to
// localStorage so they survive reloads on the same machine. New members are
// identified purely by address (no demo private key), so to *act* as a newly
// added doctor/patient you connect that account through MetaMask.

import { getAddress } from "ethers";
import { ROLES } from "./chain";

export type Member = { address: string; label: string };

const LS_KEY = "medchain.directory.v1";

const BUILTIN_DOCTORS: Member[] = [
  { address: ROLES.DoctorBob.address, label: "DoctorBob" },
  { address: ROLES.DoctorDave.address, label: "DoctorDave" },
  { address: ROLES.DoctorFrank.address, label: "DoctorFrank" },
  { address: ROLES.DoctorHeidi.address, label: "DoctorHeidi" },
];
const BUILTIN_PATIENTS: Member[] = [
  { address: ROLES.PatientAlice.address, label: "PatientAlice" },
  { address: ROLES.PatientCarol.address, label: "PatientCarol" },
  { address: ROLES.PatientEve.address, label: "PatientEve" },
  { address: ROLES.PatientGrace.address, label: "PatientGrace" },
];

type Store = { doctors: Member[]; patients: Member[] };

function read(): Store {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Store>;
      return { doctors: s.doctors ?? [], patients: s.patients ?? [] };
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { doctors: [], patients: [] };
}

function write(s: Store) {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

function merge(builtin: Member[], extra: Member[]): Member[] {
  const seen = new Set(builtin.map((m) => m.address.toLowerCase()));
  const out = [...builtin];
  for (const m of extra) {
    const k = m.address.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(m);
    }
  }
  return out;
}

/** Validate + checksum an address; throws a friendly error otherwise. */
export function normalizeAddress(input: string): string {
  try {
    return getAddress(input.trim());
  } catch {
    throw new Error("Invalid Ethereum address.");
  }
}

export function getDoctors(): Member[] {
  return merge(BUILTIN_DOCTORS, read().doctors);
}

export function getPatients(): Member[] {
  return merge(BUILTIN_PATIENTS, read().patients);
}

function addMember(kind: "doctors" | "patients", rawAddress: string, label: string) {
  const address = normalizeAddress(rawAddress);
  const name = label.trim() || `${address.slice(0, 6)}…${address.slice(-4)}`;
  const s = read();
  s[kind] = [
    ...s[kind].filter((m) => m.address.toLowerCase() !== address.toLowerCase()),
    { address, label: name },
  ];
  write(s);
}

export function addDoctor(address: string, label: string) {
  addMember("doctors", address, label);
}

export function addPatient(address: string, label: string) {
  addMember("patients", address, label);
}
