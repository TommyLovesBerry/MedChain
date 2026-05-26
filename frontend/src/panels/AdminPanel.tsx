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
const CANDIDATES: RoleName[] = ["DoctorBob", "DoctorDave"];

export default function AdminPanel({ role, refreshKey, onChange, mmSigner, mmAddress }: Props) {
  const [rows, setRows] = useState<{ r: RoleName; registered: boolean; active: boolean; name: string }[]>([]);
  const [nameDraft, setNameDraft] = useState<Record<string, string>>({ DoctorBob: "Dr Bob Smith", DoctorDave: "Dr Dave Jones" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [refreshKey]);

  async function load() {
    setErr(null);
    const c = contracts(role, mmSigner, mmAddress);
    try {
      const next = [];
      for (const r of CANDIDATES) {
        const addr = ROLES[r].address;
        const active = await c.providerRegistry.isActiveProvider(addr);
        let name = "";
        let registered = false;
        try {
          const p = await c.providerRegistry.getProvider(addr);
          registered = true;
          name = p.name;
        } catch { /* not registered */ }
        next.push({ r, registered, active, name });
      }
      setRows(next);
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
        <h3>Provider directory</h3>
        <p className="hint">Hospital admin onboards and revokes clinicians. Each action is audited on-chain.</p>
        <table className="records">
          <thead><tr><th>Candidate</th><th>Address</th><th>Status</th><th>Name on chain</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ r, registered, active, name }) => (
              <tr key={r}>
                <td>{r}</td>
                <td><code>{ROLES[r].address.slice(0,10)}…</code></td>
                <td>
                  {!registered && <span className="muted">unregistered</span>}
                  {registered && active && <span className="ok">active</span>}
                  {registered && !active && <span className="warn">revoked</span>}
                </td>
                <td>
                  {active ? name : (
                    <input
                      placeholder="Name"
                      value={nameDraft[r] ?? name ?? ""}
                      onChange={(e) => setNameDraft({ ...nameDraft, [r]: e.target.value })}
                    />
                  )}
                </td>
                <td>
                  {active ? (
                    <button disabled={busy} onClick={() => withBusy(async () => {
                      const tx = await c.providerRegistry.revokeProvider(ROLES[r].address);
                      await tx.wait();
                    })}>Revoke</button>
                  ) : (
                    <button disabled={busy || !(nameDraft[r] ?? name)} onClick={() => withBusy(async () => {
                      const tx = await c.providerRegistry.registerProvider(ROLES[r].address, nameDraft[r] ?? name);
                      await tx.wait();
                    })}>{registered ? "Re-onboard" : "Onboard"}</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>Compliance — global audit log</h3>
        <AdminAuditLog refreshKey={refreshKey} role={role} mmSigner={mmSigner} mmAddress={mmAddress} />
      </section>

      {err && <div className="err">⚠ {err}</div>}
    </div>
  );
}

function AdminAuditLog({ refreshKey, role, mmSigner, mmAddress }: { refreshKey: number; role: RoleName; mmSigner?: Signer; mmAddress?: string }) {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    (async () => {
      const c = contracts(role, mmSigner, mmAddress);
      const n = await c.auditLog.getLogCount();
      setCount(Number(n));
    })();
  }, [refreshKey, role, mmSigner, mmAddress]);
  return (
    <p className="hint">
      Total events logged across the system: <b>{count}</b>. Admin cannot read patient record contents — only event metadata.
    </p>
  );
}
