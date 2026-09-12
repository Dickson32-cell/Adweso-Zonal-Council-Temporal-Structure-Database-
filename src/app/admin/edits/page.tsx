// Admin page — review pending edits with before/after comparison
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import TopBar from "@/app/TopBar";
import EditsAdmin from "./EditsAdmin";

export default async function AdminEditsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/");

  return (
    <div className="shell">
      <TopBar username={session.username} role={session.role} />
      <main className="main">
        <EditsAdmin />
      </main>
    </div>
  );
}