import { useEffect, useState } from "react";
import { Signer } from "ethers";
import { contracts, Identity } from "../lib/chain";
import { getPatients, Member } from "../lib/directory";
import { encryptAndUpload } from "../lib/ipfs";

type Props = {
  who: Identity;
  refreshKey: number;
  onChange: () => void;
  mmSigner?: Signer;
  mmAddress?: string;
};

export default function DoctorPanel({ who, refreshKey, onChange, mmSigner, mmAddress }: Props) {
  const [isActive, setIsActive] = useState<boolean | null>(null);
  const [providerName, setProviderName] = useState<string>("");
  const [patients, setPatients] = useState<Member[]>([]);
  const [accessFor, setAccessFor] = useState<Record<string, boolean>>({});
  const [recordsByPatient, setRecordsByPatient] = useState<Record<string, any[]>>({});
  const [cidDraft, setCidDraft] = useState<Record<string, string>>({});
  const [keyByCid, setKeyByCid] = useState<Record<string, string>>({});
  const [uploadStatus, setUploadStatus] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [who.key, refreshKey]);

  async function load() {
    setErr(null);
    const c = contracts(who, mmSigner, mmAddress);
    const pts = getPatients();
    setPatients(pts);
    try {
      const active = await c.providerRegistry.isActiveProvider(c.me);
      setIsActive(active);
      if (active) {
        const p = await c.providerRegistry.getProvider(c.me);
        setProviderName(p.name);
      }
      const map: Record<string, boolean> = {};
      const records: Record<string, any[]> = {};
      for (const pr of pts) {
        const has = await c.accessControl.checkAccess(pr.address, c.me);
        map[pr.address] = has;
        if (has) {
          const ids: bigint[] = await c.recordManager.getRecordIdsForPatient(pr.address);
          records[pr.address] = await Promise.all(ids.map(async (id) => {
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

  async function onSelectFile(pr: Member, file: File) {
    await withBusy(async () => {
      setUploadStatus({ ...uploadStatus, [pr.address]: `Encrypting & uploading "${file.name}"…` });
      const { cid, keyB64 } = await encryptAndUpload(file);
      const tx = await c.recordManager.uploadRecord(pr.address, cid);
      await tx.wait();
      setKeyByCid((m) => ({ ...m, [cid]: keyB64 }));
    });
    setUploadStatus((m) => ({ ...m, [pr.address]: "" }));
  }

  const c = contracts(who, mmSigner, mmAddress);

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

      {patients.map((pr) => (
        <section className="card" key={pr.address}>
          <h3>{pr.label} <span className="addr-pill">{pr.address.slice(0,6)}…{pr.address.slice(-4)}</span></h3>
          {!accessFor[pr.address] ? (
            <p className="muted">No access. Patient must grant you permission first.</p>
          ) : (
            <>
              <div className="upload-row">
                <label className="file-upload">
                  <input
                    type="file"
                    disabled={busy || !isActive}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = ""; // allow re-selecting the same file
                      if (f) void onSelectFile(pr, f);
                    }}
                  />
                  Encrypt &amp; upload file to IPFS
                </label>
              </div>
              {uploadStatus[pr.address] && <p className="muted">{uploadStatus[pr.address]}</p>}

              <div className="upload-row">
                <input
                  placeholder="QmCid…   (paste an existing IPFS hash)"
                  value={cidDraft[pr.address] ?? ""}
                  onChange={(e) => setCidDraft({ ...cidDraft, [pr.address]: e.target.value })}
                />
                <button
                  disabled={busy || !isActive || !(cidDraft[pr.address] || "").trim()}
                  onClick={() => withBusy(async () => {
                    const tx = await c.recordManager.uploadRecord(pr.address, cidDraft[pr.address].trim());
                    await tx.wait();
                    setCidDraft({ ...cidDraft, [pr.address]: "" });
                  })}
                >Upload new record</button>
              </div>
              {(recordsByPatient[pr.address] ?? []).length === 0 ? (
                <p className="muted">No records yet.</p>
              ) : (
                <table className="records">
                  <thead><tr><th>#</th><th>CID</th><th>Prev</th><th>When</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {recordsByPatient[pr.address].map((r) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>
                          <code>{r.cid}</code>
                          {keyByCid[r.cid] && (
                            <div className="muted" style={{ marginTop: 4 }}>
                              decrypt key: <code>{keyByCid[r.cid]}</code> (save this — needed to decrypt)
                            </div>
                          )}
                        </td>
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
