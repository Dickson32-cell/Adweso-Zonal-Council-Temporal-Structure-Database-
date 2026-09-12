// Admin page — manage staff accounts: approve registrations, deactivate, promote.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import TopBar from "@/app/TopBar";
import UserAdmin from "./UserAdmin";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  return (
    <div className="shell">
      <TopBar username={session.username} role={session.role} />
      <main className="main">
        <UserAdmin />
      </main>
    </div>
  );
}