import { useEffect, useState } from "react";
import { Signer } from "ethers";
import { contracts, Identity } from "../lib/chain";
import { addDoctor, addPatient, getDoctors, getPatients, Member, normalizeAddress } from "../lib/directory";

type Props = {
  who: Identity;
  refreshKey: number;
  onChange: () => void;
  mmSigner?: Signer;
  mmAddress?: string;
};

type Row = { m: Member; registered: boolean; active: boolean; name: string };

export default function AdminPanel({ who, refreshKey, onChange, mmSigner, mmAddress }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [patients, setPatients] = useState<Member[]>([]);
  const [nameDraft, setNameDraft] = useState<Record<string, string>>({});
  const [newDoc, setNewDoc] = useState({ address: "", name: "" });
  const [newPat, setNewPat] = useState({ address: "", label: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [refreshKey]);

  async function load() {
    setErr(null);
    const c = contracts(who, mmSigner, mmAddress);
    setPatients(getPatients());
    try {
      const next: Row[] = [];
      for (const m of getDoctors()) {
        const active = await c.providerRegistry.isActiveProvider(m.address);
        let name = "";
        let registered = false;
        try {
          const p = await c.providerRegistry.getProvider(m.address);
          registered = true;
          name = p.name;
        } catch { /* not registered */ }
        next.push({ m, registered, active, name });
      }
      setRows(next);
    } catch (e: any) { setErr(e.shortMessage ?? e.message); }
  }

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true); setErr(null);
    try { await fn(); onChange(); } catch (e: any) { setErr(e.shortMessage ?? e.message); }
    finally { setBusy(false); }
  }

  const c = contracts(who, mmSigner, mmAddress);

  return (
    <div className="panel">
      <section className="card">
        <h3>Provider directory</h3>
        <p className="hint">Hospital admin onboards and revokes clinicians. Each action is audited on-chain.</p>
        <table className="records">
          <thead><tr><th>Provider</th><th>Address</th><th>Status</th><th>Name on chain</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ m, registered, active, name }) => (
              <tr key={m.address}>
                <td>{m.label}</td>
                <td><code>{m.address.slice(0,10)}…</code></td>
                <td>
                  {!registered && <span className="muted">unregistered</span>}
                  {registered && active && <span className="ok">active</span>}
                  {registered && !active && <span className="warn">revoked</span>}
                </td>
                <td>
                  {active ? name : (
                    <input
                      placeholder="Name"
                      value={nameDraft[m.address] ?? name ?? ""}
                      onChange={(e) => setNameDraft({ ...nameDraft, [m.address]: e.target.value })}
                    />
                  )}
                </td>
                <td>
                  {active ? (
                    <button disabled={busy} onClick={() => withBusy(async () => {
                      const tx = await c.providerRegistry.revokeProvider(m.address);
                      await tx.wait();
                    })}>Revoke</button>
                  ) : (
                    <button disabled={busy || !(nameDraft[m.address] ?? name)} onClick={() => withBusy(async () => {
                      const tx = await c.providerRegistry.registerProvider(m.address, nameDraft[m.address] ?? name);
                      await tx.wait();
                    })}>{registered ? "Re-onboard" : "Onboard"}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Onboard a new provider by address</h4>
        <div className="upload-row">
          <input
            placeholder="0x… provider address"
            value={newDoc.address}
            onChange={(e) => setNewDoc({ ...newDoc, address: e.target.value })}
          />
          <input
            placeholder="Provider name (e.g. Dr Eve Adams)"
            value={newDoc.name}
            onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
          />
          <button
            disabled={busy || !newDoc.address.trim() || !newDoc.name.trim()}
            onClick={() => withBusy(async () => {
              const address = normalizeAddress(newDoc.address);
              const tx = await c.providerRegistry.registerProvider(address, newDoc.name.trim());
              await tx.wait();
              addDoctor(address, newDoc.name.trim());
              setNewDoc({ address: "", name: "" });
            })}
          >Onboard</button>
        </div>
      </section>

      <section className="card">
        <h3>Patient directory</h3>
        <p className="hint">
          Patients self-register from their own wallet. Add a patient here so providers can see and
          request access to them; the patient then registers &amp; grants access via their wallet (MetaMask).
        </p>
        <table className="records">
          <thead><tr><th>Patient</th><th>Address</th></tr></thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.address}>
                <td>{p.label}</td>
                <td><code>{p.address.slice(0,10)}…</code></td>
              </tr>
            ))}
          </tbody>
        </table>

        <h4>Add a patient by address</h4>
        <div className="upload-row">
          <input
            placeholder="0x… patient address"
            value={newPat.address}
            onChange={(e) => setNewPat({ ...newPat, address: e.target.value })}
          />
          <input
            placeholder="Label (e.g. Patient Eve)"
            value={newPat.label}
            onChange={(e) => setNewPat({ ...newPat, label: e.target.value })}
          />
          <button
            disabled={busy || !newPat.address.trim()}
            onClick={() => withBusy(async () => {
              addPatient(normalizeAddress(newPat.address), newPat.label.trim());
              setNewPat({ address: "", label: "" });
            })}
          >Add patient</button>
        </div>
      </section>

      <section className="card">
        <h3>Compliance — global audit log</h3>
        <AdminAuditLog refreshKey={refreshKey} who={who} mmSigner={mmSigner} mmAddress={mmAddress} />
      </section>

      {err && <div className="err">⚠ {err}</div>}
    </div>
  );
}

function AdminAuditLog({ refreshKey, who, mmSigner, mmAddress }: { refreshKey: number; who: Identity; mmSigner?: Signer; mmAddress?: string }) {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    (async () => {
      const c = contracts(who, mmSigner, mmAddress);
      const n = await c.auditLog.getLogCount();
      setCount(Number(n));
    })();
  }, [refreshKey, who.key, mmSigner, mmAddress]);
  return (
    <p className="hint">
      Total events logged across the system: <b>{count}</b>. Admin cannot read patient record contents — only event metadata.
    </p>
  );
}
