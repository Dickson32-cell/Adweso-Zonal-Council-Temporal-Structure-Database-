"use client";
// UserAdmin — the admin's staff management table + pending-approval badges.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type U = {
  id: string; username: string; fullName: string;
  role: string; active: boolean; createdAt: string;
};

export default function UserAdmin() {
  const [users, setUsers] = useState<U[]>([]);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(userId: string, action: string, label: string) {
    if (action === "reject" && !confirm("Reject and disable this registration?")) return;
    if (action === "deactivate" && !confirm("Deactivate this user? They will not be able to sign in.")) return;
    setBusyId(userId); setMsg(""); setErr("");
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    const data = await res.json();
    setBusyId("");
    if (!res.ok) { setErr(data.error || "Operation failed"); return; }
    setMsg(label);
    load();
  }

  const pending = users.filter((u) => !u.active);
  const active = users.filter((u) => u.active);

  return (
    <>
      <div className="card">
        <h2>Staff Accounts</h2>
        <p className="sub">
          Staff register themselves at <code>/register</code>; you approve them here before they can sign in and enter data.
        </p>

        {msg && <div className="ok-msg">{msg}</div>}
        {err && <div className="err">{err}</div>}

        {pending.length > 0 && (
          <div className="ok-msg" style={{ background: "var(--amber-soft)", borderColor: "#fde68a", color: "var(--amber)" }}>
            <b>{pending.length} registration{pending.length === 1 ? "" : "s"} awaiting approval</b>
          </div>
        )}

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Registered</th>
                <th className="no-print">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>Loading…</td></tr>}
              {pending.map((u) => (
                <tr key={u.id} style={{ background: "#fffbeb" }}>
                  <td className="serial">{u.username}</td>
                  <td>{u.fullName}</td>
                  <td>{u.role === "ADMIN" ? "Administrator" : "Staff"}</td>
                  <td><span className="badge unpaid">AWAITING APPROVAL</span></td>
                  <td>{new Date(u.createdAt).toLocaleString("en-GB")}</td>
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-green btn-sm" disabled={busyId === u.id}
                      onClick={() => act(u.id, "approve", `${u.username} approved — they can now sign in`)}>
                      Approve
                    </button>{" "}
                    <button className="btn btn-danger btn-sm" disabled={busyId === u.id}
                      onClick={() => act(u.id, "reject", `${u.username} rejected and disabled`)}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {active.map((u) => (
                <tr key={u.id}>
                  <td className="serial">{u.username}</td>
                  <td>{u.fullName}</td>
                  <td>{u.role === "ADMIN" ? "Administrator" : "Staff"}</td>
                  <td><span className="badge paid">{u.active ? "ACTIVE" : "DISABLED"}</span></td>
                  <td>{new Date(u.createdAt).toLocaleString("en-GB")}</td>
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    {u.username === "admin" ? (
                      <span style={{ color: "var(--muted)", fontSize: 12 }}>(primary admin)</span>
                    ) : (
                      <>
                        {u.role !== "ADMIN" && (
                          <button className="btn btn-ghost btn-sm" disabled={busyId === u.id}
                            onClick={() => act(u.id, "makeAdmin", `${u.username} promoted to administrator`)}>
                            Make Admin
                          </button>
                        )}
                        {u.active ? (
                          <button className="btn btn-ghost btn-sm" disabled={busyId === u.id}
                            onClick={() => act(u.id, "deactivate", `${u.username} deactivated`)}>
                            Deactivate
                          </button>
                        ) : (
                          <button className="btn btn-green btn-sm" disabled={busyId === u.id}
                            onClick={() => act(u.id, "reactivate", `${u.username} reactivated`)}>
                            Reactivate
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 14 }}>
          <Link href="/" className="btn btn-ghost">Back to Register</Link>
        </div>
      </div>
    </>
  );
}