# MedChain — Patient-Owned Healthcare Records on a Permissioned EVM Chain

IFB452 Blockchain Technology · Semester 1, 2026 · **Group 104**
Tommy Dinh (n11883952) · Jacob O'Toole (n11580232)

A multi-stakeholder dApp where patients **own**, **control**, and **audit** access to their healthcare records. Records are encrypted off-chain on IPFS — only the content hash (CID) is stored on-chain. Patients grant and revoke per-provider access via Solidity smart contracts. Every action is logged immutably.

## Architecture

Five Solidity contracts in [`contracts/`](contracts/), three stakeholder roles, one append-only audit log.

| Contract | Role |
|---|---|
| [`PatientRegistry.sol`](contracts/PatientRegistry.sol) | Patients self-register an on-chain identity + encryption public key. |
| [`ProviderRegistry.sol`](contracts/ProviderRegistry.sol) | Hospital admin onboards / revokes clinicians. |
| [`AccessControl.sol`](contracts/AccessControl.sol) | Patients grant or revoke per-provider access. Checked on every record action. |
| [`RecordManager.sol`](contracts/RecordManager.sol) | Authorised providers upload and version encrypted record CIDs. |
| [`AuditLog.sol`](contracts/AuditLog.sol) | Append-only event trail. Internally called by the other contracts. |

```
Patient ─ register, grant/revoke ─→ PatientRegistry / AccessControl
Doctor  ─ upload / update record ─→ RecordManager ──┐
Admin   ─ onboard provider       ─→ ProviderRegistry┤
                                                     ├─ logEvent() ─→ AuditLog
                            checkAccess()  ───────────┘
                            isActiveProvider()
                            isPatient()
```

## Run locally

Requires Node ≥ 18.

```bash
npm install          # installs Hardhat + toolbox
cd frontend && npm install && cd ..
```

You need **three terminals** open:

### Terminal 1 — chain
```bash
npx hardhat node
```
Starts a local EVM at `http://127.0.0.1:8545` with 20 pre-funded test accounts.

### Terminal 2 — deploy
```bash
npm run deploy:local
```
Deploys all 5 contracts, wires up the `AuditLog` authorisations, and writes
`frontend/src/contracts/{addresses,abis}.json` so the frontend picks them up automatically.
**Rerun this any time you restart the node.**

### Terminal 3 — frontend
```bash
npm run frontend
```
Opens at <http://localhost:5173>. No MetaMask required — the app uses Hardhat's
well-known test private keys directly so you can switch between Patient / Doctor /
Hospital Admin roles with a single click. (This is a deliberate choice for live demo
reliability — in a real deployment, each role would sign with their own wallet.)

## Tests

```bash
npx hardhat test
```

Covers the full BPMN flow (`register → onboard → grant → upload → update → revoke → audit`)
plus key revert cases (unauthorised admin, unregistered patient, revoked provider,
unauthorised viewer, unauthorised audit caller).

## Demo walkthrough (5 minutes)

This mirrors the BPMN diagram on slide 5 of the progress presentation.

1. **Hospital Admin** — onboard `DoctorBob` with name "Dr Bob Smith". A `REGISTER_PROVIDER` event lands in the audit log.
2. **PatientAlice** — click **Register as patient**. She's now identified on-chain.
3. **PatientAlice** — click **Grant** next to `DoctorBob`. Permission now exists in `AccessControl`. An audit entry appears under her trail.
4. **DoctorBob** — Alice's row is now active. Paste a mock CID (e.g. `QmEncryptedConsultNote1`) and click **Upload new record**.
5. **PatientAlice** — refresh; her records list now shows record #0 from DoctorBob.
6. **DoctorBob** — click **Update** on record #0, supply `QmEncryptedConsultNote2`. The previous version is marked `superseded`; a new record #1 is current with `previousVersion = 0`.
7. **PatientAlice** — click **Revoke** for DoctorBob. Switch back to **DoctorBob** — uploads now fail with `RecordManager: no access`. Audit log shows the revoke.
8. **Hospital Admin** — note total event count; admin cannot read record contents, only metadata.

## Design notes

| Concern | Approach |
|---|---|
| **Privacy** | Records are encrypted off-chain. Only the CID (32-byte hash) goes on-chain. Demo uses mock CIDs — see slide 6 for discussion of the IPFS pinning dependency. |
| **Scalability / gas** | On-chain payload is fixed size regardless of record contents. Intended for a permissioned EVM (e.g. Hyperledger Besu); local Hardhat node here for demo. |
| **Identity** | Hospital acts as registrar via `ProviderRegistry` (modelled on AHPRA). Patients self-register. |
| **Audit** | Every write contract calls `AuditLog.logEvent()`. Only contracts authorised by the AuditLog owner can write — blocks spoofing. |
| **Key recovery** | Out of scope (acknowledged on slide 6). Production would need social recovery / guardian scheme. |
| **CEI pattern** | All state changes happen before external calls to AuditLog. |

## Project layout

```
contracts/                   Solidity sources (5 contracts)
test/                        Hardhat test suite (Mocha + chai)
scripts/deploy.ts            Deploy + wire all contracts + emit addresses/ABIs
frontend/                    Vite + React + ethers.js demo UI
artifacts-hh/                Hardhat-compiled artifacts (gitignored)
artifacts/                   Legacy Remix artifacts (kept for reference only)
hardhat.config.ts            Solidity 0.8.20, optimizer on, localhost net
```
