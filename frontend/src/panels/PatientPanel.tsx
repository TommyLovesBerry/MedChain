import { useEffect, useState } from "react";
import { Signer } from "ethers";
import { contracts, RoleName, ROLES } from "../lib/chain";

type Props = {
  role: RoleName;
  refreshKey: number;
  onChange: () => void;
  mmSigner?: Signer;
  mmAddress?: string;
};

const KNOWN_DOCTORS: RoleName[] = ["DoctorBob", "DoctorDave"];

export default function PatientPanel({ role, refreshKey, onChange, mmSigner, mmAddress }: Props) {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [records, setRecords] = useState<{ id: number; cid: string; provider: string; ts: number; superseded: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [role, refreshKey]);

  async function load() {
    setErr(null);
    const c = contracts(role, mmSigner, mmAddress);
    try {
      const reg = await c.patientRegistry.isPatient(c.me);
      setIsRegistered(reg);
      const perms: Record<string, boolean> = {};
      for (const d of KNOWN_DOCTORS) {
        perms[d] = await c.accessControl.checkAccess(c.me, ROLES[d].address);
      }
      setPermissions(perms);
      if (reg) {
        const ids: bigint[] = await c.recordManager.getRecordIdsForPatient(c.me);
        const list = await Promise.all(ids.map(async (id) => {
          const r = await c.recordManager.getRecord(id);
          return { id: Number(id), cid: r.cid, provider: r.provider, ts: Number(r.timestamp), superseded: r.superseded };
        }));
        setRecords(list);
      } else {
        setRecords([]);
      }
    } catch (e: any) {
      setErr(e.shortMessage ?? e.message);
    }
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try { await fn(); onChange(); } catch (e: any) { setErr(e.shortMessage ?? e.message); }
    finally { setBusy(false); }
  }

  const c = contracts(role, mmSigner, mmAddress);

  return (
    <div className="panel">
      <section className="card">
        <h3>1 · Identity</h3>
        {isRegistered === null ? <p>Loading…</p> : isRegistered ? (
          <p className="ok">✓ Registered as patient on-chain.</p>
        ) : (
          <>
            <p className="warn">Not registered yet.</p>
            <button disabled={busy} onClick={() => withBusy(async () => {
              const tx = await c.patientRegistry.registerPatient(`pubkey_${role}_demo`);
              await tx.wait();
            })}>Register as patient</button>
          </>
        )}
      </section>

      <section className="card">
        <h3>2 · Access control</h3>
        <p className="hint">Grant or revoke per-provider access. Every action is audited.</p>
        <table className="perms">
          <thead><tr><th>Provider</th><th>Address</th><th>Access</th><th></th></tr></thead>
          <tbody>
            {KNOWN_DOCTORS.map((d) => (
              <tr key={d}>
                <td>{d}</td>
                <td><code>{ROLES[d].address.slice(0, 10)}…</code></td>
                <td>{permissions[d] ? <span className="ok">granted</span> : <span className="muted">none</span>}</td>
                <td>
                  {permissions[d] ? (
                    <button disabled={busy || !isRegistered} onClick={() => withBusy(async () => {
                      const tx = await c.accessControl.revokeAccess(ROLES[d].address); await tx.wait();
                    })}>Revoke</button>
                  ) : (
                    <button disabled={busy || !isRegistered} onClick={() => withBusy(async () => {
                      const tx = await c.accessControl.grantAccess(ROLES[d].address); await tx.wait();
                    })}>Grant</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>3 · My records</h3>
        {records.length === 0 ? (
          <p className="muted">No records uploaded for you yet.</p>
        ) : (
          <table className="records">
            <thead><tr><th>#</th><th>CID</th><th>Uploaded by</th><th>When</th><th>Status</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td><code>{r.cid}</code></td>
                  <td><code>{r.provider.slice(0,10)}…</code></td>
                  <td>{new Date(r.ts * 1000).toLocaleString()}</td>
                  <td>{r.superseded ? <span className="muted">superseded</span> : <span className="ok">current</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {err && <div className="err">⚠ {err}</div>}
    </div>
  );
}
