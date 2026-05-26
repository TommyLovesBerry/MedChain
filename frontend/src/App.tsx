import { useState } from "react";
import { ROLES, RoleName, addresses } from "./lib/chain";
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

  const panel = (() => {
    if (role === "HospitalAdmin") return <AdminPanel role={role} refreshKey={refreshKey} onChange={refresh} />;
    if (role.startsWith("Doctor")) return <DoctorPanel role={role} refreshKey={refreshKey} onChange={refresh} />;
    return <PatientPanel role={role} refreshKey={refreshKey} onChange={refresh} />;
  })();

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>MedChain</h1>
        <p className="tag">Group 104 · IFB452</p>

        <h3>Sign in as</h3>
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
            <span className="addr-pill">{ROLES[role].address.slice(0, 6)}…{ROLES[role].address.slice(-4)}</span>
          </h2>
        </div>
        {panel}
        {role !== "HospitalAdmin" && (
          <AuditPanel role={role} refreshKey={refreshKey} />
        )}
      </main>
    </div>
  );
}
