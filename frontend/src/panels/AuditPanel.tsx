import { useEffect, useState } from "react";
import { contracts, RoleName, ROLES } from "../lib/chain";

type Props = { role: RoleName; refreshKey: number };

export default function AuditPanel({ role, refreshKey }: Props) {
  const [entries, setEntries] = useState<{ actor: string; counterparty: string; action: string; ts: number }[]>([]);

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [role, refreshKey]);

  async function load() {
    if (role === "HospitalAdmin") return;
    const c = contracts(role);
    try {
      const logs = await c.auditLog.getLogsForSubject(c.me);
      setEntries(logs.map((l: any) => ({
        actor: l.actor, counterparty: l.counterparty, action: l.action, ts: Number(l.timestamp),
      })).reverse());
    } catch {
      setEntries([]);
    }
  }

  const knownAddr: Record<string, string> = Object.fromEntries(
    Object.entries(ROLES).map(([k, v]) => [v.address.toLowerCase(), k])
  );
  const label = (a: string) => knownAddr[a.toLowerCase()] ?? `${a.slice(0,6)}…${a.slice(-4)}`;

  return (
    <section className="card audit">
      <h3>Audit trail for me</h3>
      {entries.length === 0 ? (
        <p className="muted">No events recorded yet.</p>
      ) : (
        <table className="records">
          <thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Counterparty</th></tr></thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i}>
                <td>{new Date(e.ts * 1000).toLocaleString()}</td>
                <td><span className={`action ${e.action}`}>{e.action}</span></td>
                <td>{label(e.actor)}</td>
                <td>{label(e.counterparty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
