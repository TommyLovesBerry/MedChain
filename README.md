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
Opens at <http://localhost:5173>. The UI supports **two signing modes**:

- **Demo accounts (default)** — one-click role switching backed by Hardhat's well-known
  test keys. No browser extension required, no popups, instant signing. Ideal for the
  live walkthrough.
- **MetaMask** — click "🦊 Connect MetaMask" in the sidebar. Every write triggers a
  MetaMask popup, exactly like a production dApp.

### Using MetaMask (optional)

1. Install the [MetaMask](https://metamask.io) browser extension.
2. Click **Connect MetaMask** in the sidebar — the app will prompt MetaMask to add the
   "Hardhat Localhost" network (chainId 31337, RPC `http://127.0.0.1:8545`) and switch to it.
3. Import one or more of Hardhat's test accounts into MetaMask so you can act as different
   roles. In MetaMask: *Account → Import account → Private key*, then paste one of:
   - **Hospital admin** (account #1): `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
   - **Patient Alice**  (account #2): `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`
   - **Doctor Bob**     (account #3): `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6`
4. Switch the active account in MetaMask to act as a different role. The app listens for
   `accountsChanged` and refreshes automatically. The "View as" buttons in the sidebar
   choose which panel (Patient / Doctor / Admin) is shown — make sure the active MetaMask
   account matches the role you're trying to use.

These private keys are public — they come from Hardhat's default test mnemonic
(`test test test test test test test test test test test junk`) and are safe to commit.
**Never** use them on mainnet or any network handling real value.

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
