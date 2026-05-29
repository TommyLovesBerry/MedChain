import { useEffect, useMemo, useState } from "react";
import { ROLES, Identity, addresses, pkForAddress } from "./lib/chain";
import { getDoctors, getPatients } from "./lib/directory";
import { connectMetaMask, hasMetaMask, onAccountsChanged, onChainChanged } from "./lib/metamask";
import type { Signer } from "ethers";
import PatientPanel from "./panels/PatientPanel";
import DoctorPanel from "./panels/DoctorPanel";
import AdminPanel from "./panels/AdminPanel";
import AuditPanel from "./panels/AuditPanel";

const ADMIN: Identity = {
  key: ROLES.HospitalAdmin.address,
  label: "HospitalAdmin",
  address: ROLES.HospitalAdmin.address,
  pk: ROLES.HospitalAdmin.pk,
  kind: "admin",
};

function buildGroups(): { label: string; members: Identity[] }[] {
  const mk = (kind: Identity["kind"]) => (m: { address: string; label: string }): Identity => ({
    key: m.address,
    label: m.label,
    address: m.address,
    pk: pkForAddress(m.address),
    kind,
  });
  return [
    { label: "Hospital admin", members: [ADMIN] },
    { label: "Patients", members: getPatients().map(mk("patient")) },
    { label: "Doctors", members: getDoctors().map(mk("doctor")) },
  ];
}

export default function App() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  // Rebuild the directory-driven sidebar whenever something changes on-chain/in storage.
  const groups = useMemo(() => buildGroups(), [refreshKey]);
  const allMembers = useMemo(() => groups.flatMap((g) => g.members), [groups]);

  const [selectedKey, setSelectedKey] = useState<string>(ROLES.PatientAlice.address);
  const who = allMembers.find((m) => m.key === selectedKey) ?? ADMIN;

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
    const props = { who, refreshKey, onChange: refresh, mmSigner, mmAddress };
    if (who.kind === "admin") return <AdminPanel {...props} />;
    if (who.kind === "doctor") return <DoctorPanel {...props} />;
    return <PatientPanel {...props} />;
  })();

  const activeAddress = useMm ? mmAddress! : who.address;
  const needsMetaMask = !useMm && !who.pk;

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
        {groups.map((g) => (
          <div key={g.label} className="role-group">
            <div className="role-group-label">{g.label}</div>
            {g.members.map((m) => (
              <button
                key={m.key}
                className={`role-btn ${who.key === m.key ? "active" : ""}`}
                onClick={() => setSelectedKey(m.key)}
                title={!m.pk ? "Added by address — connect this account in MetaMask to sign as it" : undefined}
              >
                <span className="role-name">{m.label}{!m.pk ? " 🦊" : ""}</span>
                <span className="role-addr">{m.address.slice(0, 6)}…{m.address.slice(-4)}</span>
              </button>
            ))}
          </div>
        ))}
        <p className="hint small">🦊 = added by address; connect that account in MetaMask to sign as it.</p>

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
            {who.label}{" "}
            <span className="addr-pill">
              {useMm ? "🦊 " : ""}{activeAddress.slice(0, 6)}…{activeAddress.slice(-4)}
            </span>
          </h2>
          {useMm && (
            <p className="hint">
              Transactions will be signed by your MetaMask account.
              Panel view shows what <b>{who.label}</b> would do — check that your connected MetaMask address matches the role you want to act as.
            </p>
          )}
          {needsMetaMask && (
            <p className="warn">
              <b>{who.label}</b> was added by address and has no demo key. Connect this account in
              MetaMask (or onboard a built-in demo account instead) to sign transactions as it.
            </p>
          )}
        </div>
        {panel}
        {who.kind !== "admin" && (
          <AuditPanel who={who} refreshKey={refreshKey} mmSigner={mmSigner} mmAddress={mmAddress} />
        )}
      </main>
    </div>
  );
}
