import { useEffect, useState } from "react";
import { ROLES, RoleName, addresses } from "./lib/chain";
import { connectMetaMask, hasMetaMask, onAccountsChanged, onChainChanged } from "./lib/metamask";
import type { Signer } from "ethers";
import PatientPanel from "./panels/PatientPanel";
import DoctorPanel from "./panels/DoctorPanel";
import AdminPanel from "./panels/AdminPanel";
import AuditPanel from "./panels/AuditPanel";

const ROLE_GROUPS: { label: string; roles: RoleName[] }[] = [
  { label: "Hospital admin", roles: ["HospitalAdmin"] },
  { label: "Patients",       roles: ["PatientAlice", "PatientCarol"] },
  { label: "Doctors",        roles: ["DoctorBob", "DoctorDave"] },
];

export default function App() {
  const [role, setRole] = useState<RoleName>("PatientAlice");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  // MetaMask state
  const [mmSigner, setMmSigner] = useState<Signer | undefined>();
  const [mmAddress, setMmAddress] = useState<string | undefined>();
  const [mmErr, setMmErr] = useState<string | null>(null);
  const useMm = !!mmSigner;

  useEffect(() => {
    const offA = onAccountsChanged(async (addr) => {
      if (!addr) { setMmSigner(undefined); setMmAddress(undefined); return; }
      try {
        const s = await connectMetaMask();
        setMmSigner(s); setMmAddress(await s.getAddress()); refresh();
      } catch (e: any) { setMmErr(e.message); }
    });
    const offC = onChainChanged(() => window.location.reload());
    return () => { offA(); offC(); };
  }, []);

  async function connect() {
    setMmErr(null);
    try {
      const s = await connectMetaMask();
      setMmSigner(s);
      setMmAddress(await s.getAddress());
      refresh();
    } catch (e: any) { setMmErr(e.shortMessage ?? e.message); }
  }

  function disconnect() {
    setMmSigner(undefined); setMmAddress(undefined); refresh();
  }

  const panel = (() => {
    const props = { role, refreshKey, onChange: refresh, mmSigner, mmAddress };
    if (role === "HospitalAdmin") return <AdminPanel {...props} />;
    if (role.startsWith("Doctor")) return <DoctorPanel {...props} />;
    return <PatientPanel {...props} />;
  })();

  const activeAddress = useMm ? mmAddress! : ROLES[role].address;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>MedChain</h1>
        <p className="tag">Group 104 · IFB452</p>

        <h3>Wallet</h3>
        {!useMm ? (
          <>
            <button className="wallet-btn" onClick={connect} disabled={!hasMetaMask()}>
              {hasMetaMask() ? "🦊 Connect MetaMask" : "MetaMask not installed"}
            </button>
            <p className="hint small">Or use a demo account below — no wallet popup, instant signing.</p>
          </>
        ) : (
          <>
            <div className="mm-connected">
              <div className="mm-label">🦊 MetaMask connected</div>
              <code className="mm-addr">{mmAddress}</code>
              <button className="link-btn" onClick={disconnect}>Disconnect</button>
            </div>
            <p className="hint small">Every write will trigger a MetaMask popup. Switch accounts in MetaMask to act as different roles.</p>
          </>
        )}
        {mmErr && <p className="err small">⚠ {mmErr}</p>}

        <h3>{useMm ? "View as" : "Sign in as"}</h3>
        {ROLE_GROUPS.map((g) => (
          <div key={g.label} className="role-group">
            <div className="role-group-label">{g.label}</div>
            {g.roles.map((r) => (
              <button
                key={r}
                className={`role-btn ${role === r ? "active" : ""}`}
                onClick={() => setRole(r)}
              >
                <span className="role-name">{r}</span>
                <span className="role-addr">{ROLES[r].address.slice(0, 6)}…{ROLES[r].address.slice(-4)}</span>
              </button>
            ))}
          </div>
        ))}

        <details className="addresses">
          <summary>Deployed contracts</summary>
          <ul>
            <li><b>AuditLog</b><br/><code>{addresses.AuditLog}</code></li>
            <li><b>PatientRegistry</b><br/><code>{addresses.PatientRegistry}</code></li>
            <li><b>ProviderRegistry</b><br/><code>{addresses.ProviderRegistry}</code></li>
            <li><b>AccessControl</b><br/><code>{addresses.AccessControl}</code></li>
            <li><b>RecordManager</b><br/><code>{addresses.RecordManager}</code></li>
          </ul>
        </details>
      </aside>

      <main className="main">
        <div className="header">
          <h2>
            {role}{" "}
            <span className="addr-pill">
              {useMm ? "🦊 " : ""}{activeAddress.slice(0, 6)}…{activeAddress.slice(-4)}
            </span>
          </h2>
          {useMm && (
            <p className="hint">
              Transactions will be signed by your MetaMask account.
              Panel view shows what <b>{role}</b> would do — check that your connected MetaMask address matches the role you want to act as.
            </p>
          )}
        </div>
        {panel}
        {role !== "HospitalAdmin" && (
          <AuditPanel role={role} refreshKey={refreshKey} mmSigner={mmSigner} mmAddress={mmAddress} />
        )}
      </main>
    </div>
  );
}
