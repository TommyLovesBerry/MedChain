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

### Adding more doctors and patients

The sidebar ships with several built-in demo doctors and patients, but you can add more
at runtime from the **Hospital Admin** panel:

- **Onboard a new provider by address** — paste any address + name. This is a real
  on-chain `registerProvider` call, so the new doctor becomes an active provider immediately.
- **Add a patient by address** — adds the patient to the directory so providers can see and
  request access to them. (Patients self-register on-chain from their own wallet — by design,
  the contract only lets a patient register themselves.)

Added members appear as their own sidebar tab. If the address is one of Hardhat's 20
well-known accounts, the app already knows its key and the tab **instant-signs** with no
MetaMask popup. Any other address is marked with a 🦊 and must be driven via MetaMask.
The directory is stored in the browser's `localStorage`, so added tabs persist across
reloads on the same machine (on-chain registrations live on the node).

### Encrypted files (optional, real IPFS)

Providers can encrypt and upload an actual file (not just a mock CID). Set a
[Pinata](https://pinata.cloud) JWT in `frontend/.env` (see `frontend/.env.example`):

```
VITE_PINATA_JWT=your_pinata_jwt
```

On upload, the file is encrypted in the browser with **AES-GCM**; only the encrypted blob
is pinned to IPFS and only the CID goes on-chain. The original filename + type are sealed
inside the encrypted envelope. The provider is shown a one-time base64 decrypt key to share
with the patient. The patient pastes that key next to the record and clicks **Download** to
fetch, decrypt, and save the file under its original name — entirely client-side. Without a
Pinata JWT the file-upload button is disabled, but the mock-CID flow still works.

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

Optional extras to show the newer features:

- **Add more staff** — as Hospital Admin, onboard a new doctor by address (e.g. a free Hardhat
  account) and add a new patient by address. Both appear as new sidebar tabs you can act as.
- **Real encrypted file** — with a Pinata JWT set, the doctor clicks **Encrypt & upload file to
  IPFS**, copies the shown decrypt key; the patient pastes that key on the record and clicks
  **Download** to recover the original file, decrypted in the browser.

## Design notes

| Concern | Approach |
|---|---|
| **Privacy** | Records are encrypted client-side with AES-GCM before upload; only the encrypted blob is pinned to IPFS and only the CID goes on-chain. The original filename + type are sealed inside the encrypted envelope. A mock-CID path is also available for offline demos. |
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
  src/lib/chain.ts           Contract wiring, demo accounts, identity model
  src/lib/directory.ts       Runtime directory of doctors/patients (add-by-address)
  src/lib/ipfs.ts            AES-GCM encrypt/decrypt + Pinata IPFS upload
  src/panels/                Admin / Doctor / Patient / Audit panels
artifacts-hh/                Hardhat-compiled artifacts (gitignored)
artifacts/                   Legacy Remix artifacts (kept for reference only)
hardhat.config.ts            Solidity 0.8.20, optimizer on, localhost net
```
