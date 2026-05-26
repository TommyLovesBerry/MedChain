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
const KNOWN_PATIENTS: RoleName[] = ["PatientAlice", "PatientCarol"];

export default function DoctorPanel({ role, refreshKey, onChange, mmSigner, mmAddress }: Props) {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [providerName, setProviderName] = useState<string>("");
  const [accessFor, setAccessFor] = useState<Record<string, boolean>>({});
  const [recordsByPatient, setRecordsByPatient] = useState<Record<string, any[]>>({});
  const [cidDraft, setCidDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [role, refreshKey]);

  async function load() {
    setErr(null);
    const c = contracts(role, mmSigner, mmAddress);
    try {
      const active = await c.providerRegistry.isActiveProvider(c.me);
      setIsActive(active);
      if (active) {
        const p = await c.providerRegistry.getProvider(c.me);
        setProviderName(p.name);
      }
      const map: Record<string, boolean> = {};
      const records: Record<string, any[]> = {};
      for (const pr of KNOWN_PATIENTS) {
        const addr = ROLES[pr].address;
        const has = await c.accessControl.checkAccess(addr, c.me);
        map[pr] = has;
        if (has) {
          const ids: bigint[] = await c.recordManager.getRecordIdsForPatient(addr);
          records[pr] = await Promise.all(ids.map(async (id) => {
            const r = await c.recordManager.getRecord(id);
            return { id: Number(id), cid: r.cid, ts: Number(r.timestamp), superseded: r.superseded, prev: Number(r.previousVersion) };
          }));
        }
      }
      setAccessFor(map);
      setRecordsByPatient(records);
    } catch (e: any) { setErr(e.shortMessage ?? e.message); }
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
        <h3>Provider status</h3>
        {isActive === null ? <p>Loading…</p> : isActive ? (
          <p className="ok">✓ Active provider — registered as <b>{providerName}</b>.</p>
        ) : (
          <p className="warn">Not registered as a provider. Ask the Hospital Admin to onboard you.</p>
        )}
      </section>

      {KNOWN_PATIENTS.map((pr) => (
        <section className="card" key={pr}>
          <h3>{pr} <span className="addr-pill">{ROLES[pr].address.slice(0,6)}…{ROLES[pr].address.slice(-4)}</span></h3>
          {!accessFor[pr] ? (
            <p className="muted">No access. Patient must grant you permission first.</p>
          ) : (
            <>
              <div className="upload-row">
                <input
                  placeholder="QmCid…   (mock IPFS hash)"
                  value={cidDraft[pr] ?? ""}
                  onChange={(e) => setCidDraft({ ...cidDraft, [pr]: e.target.value })}
                />
                <button
                  disabled={busy || !isActive || !(cidDraft[pr] || "").trim()}
                  onClick={() => withBusy(async () => {
                    const tx = await c.recordManager.uploadRecord(ROLES[pr].address, cidDraft[pr].trim());
                    await tx.wait();
                    setCidDraft({ ...cidDraft, [pr]: "" });
                  })}
                >Upload new record</button>
              </div>
              {(recordsByPatient[pr] ?? []).length === 0 ? (
                <p className="muted">No records yet.</p>
              ) : (
                <table className="records">
                  <thead><tr><th>#</th><th>CID</th><th>Prev</th><th>When</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {recordsByPatient[pr].map((r) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td><code>{r.cid}</code></td>
                        <td>{r.prev > 0 ? `#${r.prev}` : "—"}</td>
                        <td>{new Date(r.ts * 1000).toLocaleString()}</td>
                        <td>{r.superseded ? <span className="muted">superseded</span> : <span className="ok">current</span>}</td>
                        <td>
                          {!r.superseded && (
                            <button
                              disabled={busy}
                              onClick={() => withBusy(async () => {
                                const newCid = prompt(`New CID superseding record #${r.id}:`);
                                if (!newCid) return;
                                const tx = await c.recordManager.updateRecord(r.id, newCid);
                                await tx.wait();
                              })}
                            >Update</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>
      ))}

      {err && <div className="err">⚠ {err}</div>}
    </div>
  );
}
