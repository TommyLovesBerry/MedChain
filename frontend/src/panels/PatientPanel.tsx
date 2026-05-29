import { useEffect, useState } from "react";
import { Signer } from "ethers";
import { contracts, Identity } from "../lib/chain";
import { getDoctors, Member } from "../lib/directory";
import { downloadAndDecrypt } from "../lib/ipfs";

type Props = {
  who: Identity;
  refreshKey: number;
  onChange: () => void;
  mmSigner?: Signer;
  mmAddress?: string;
};

export default function PatientPanel({ who, refreshKey, onChange, mmSigner, mmAddress }: Props) {
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [doctors, setDoctors] = useState<Member[]>([]);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [records, setRecords] = useState<{ id: number; cid: string; provider: string; ts: number; superseded: boolean }[]>([]);
  const [keyDraft, setKeyDraft] = useState<Record<number, string>>({});
  const [decryptStatus, setDecryptStatus] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [who.key, refreshKey]);

  async function load() {
    setErr(null);
    const c = contracts(who, mmSigner, mmAddress);
    const docs = getDoctors();
    setDoctors(docs);
    try {
      const reg = await c.patientRegistry.isPatient(c.me);
      setIsRegistered(reg);
      const perms: Record<string, boolean> = {};
      for (const d of docs) {
        perms[d.address] = await c.accessControl.checkAccess(c.me, d.address);
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

  async function onDownload(id: number, cid: string) {
    const keyB64 = (keyDraft[id] ?? "").trim();
    if (!keyB64) {
      setDecryptStatus((m) => ({ ...m, [id]: "Paste the decrypt key first." }));
      return;
    }
    setDecryptStatus((m) => ({ ...m, [id]: "Fetching & decrypting…" }));
    try {
      const { data, name, type, ext } = await downloadAndDecrypt(cid, keyB64);
      const url = URL.createObjectURL(new Blob([data as BlobPart], { type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name && name.trim() ? name : `medchain-record-${id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDecryptStatus((m) => ({ ...m, [id]: "✓ Decrypted & downloaded." }));
    } catch (e: any) {
      setDecryptStatus((m) => ({ ...m, [id]: `⚠ ${e.shortMessage ?? e.message}` }));
    }
  }

  const c = contracts(who, mmSigner, mmAddress);

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
              const tx = await c.patientRegistry.registerPatient(`pubkey_${who.label}_demo`);
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
            {doctors.map((d) => (
              <tr key={d.address}>
                <td>{d.label}</td>
                <td><code>{d.address.slice(0, 10)}…</code></td>
                <td>{permissions[d.address] ? <span className="ok">granted</span> : <span className="muted">none</span>}</td>
                <td>
                  {permissions[d.address] ? (
                    <button disabled={busy || !isRegistered} onClick={() => withBusy(async () => {
                      const tx = await c.accessControl.revokeAccess(d.address); await tx.wait();
                    })}>Revoke</button>
                  ) : (
                    <button disabled={busy || !isRegistered} onClick={() => withBusy(async () => {
                      const tx = await c.accessControl.grantAccess(d.address); await tx.wait();
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
          <>
            <p className="hint">
              Records are AES-encrypted before upload. Paste the decrypt key your provider gave
              you, then download &amp; decrypt the file in your browser.
            </p>
            <table className="records">
              <thead><tr><th>#</th><th>CID</th><th>Uploaded by</th><th>When</th><th>Status</th><th>Decrypt &amp; download</th></tr></thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td><code>{r.cid}</code></td>
                    <td><code>{r.provider.slice(0,10)}…</code></td>
                    <td>{new Date(r.ts * 1000).toLocaleString()}</td>
                    <td>{r.superseded ? <span className="muted">superseded</span> : <span className="ok">current</span>}</td>
                    <td>
                      <div className="upload-row">
                        <input
                          placeholder="paste decrypt key (base64)"
                          value={keyDraft[r.id] ?? ""}
                          onChange={(e) => setKeyDraft({ ...keyDraft, [r.id]: e.target.value })}
                        />
                        <button
                          disabled={!(keyDraft[r.id] || "").trim()}
                          onClick={() => onDownload(r.id, r.cid)}
                        >Download</button>
                      </div>
                      {decryptStatus[r.id] && <div className="muted" style={{ marginTop: 4 }}>{decryptStatus[r.id]}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {err && <div className="err">⚠ {err}</div>}
    </div>
  );
}
