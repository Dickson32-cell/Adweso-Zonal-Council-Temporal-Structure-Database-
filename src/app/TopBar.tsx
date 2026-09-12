"use client";
// TopBar — logo + brand + user + logout
import { useRouter } from "next/navigation";

export default function TopBar({ username, role }: { username: string; role: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <header className="topbar">
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.jpg" alt="Adweso Zonal Council logo" className="brand-logo" />
        <div>
          <div className="t1">Adweso Zonal Council</div>
          <div className="t2">Temporal Structures Fee Register</div>
        </div>
      </div>
      <div className="who">
        <b>{username}</b> · {role === "ADMIN" ? "Administrator" : "Staff"} &nbsp;{" "}
        {role === "ADMIN" && (
          <>
            <a href="/admin/users" className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "#3b5c8a" }}>
              Staff
            </a>{" "}
            <a href="/admin/edits" className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "#3b5c8a" }}>
              Edits
            </a>
          </>
        )}{" "}
        <button className="btn btn-ghost btn-sm" style={{ color: "#fff", borderColor: "#3b5c8a" }} onClick={logout}>
          Log out
        </button>
      </div>
    </header>
  );
}