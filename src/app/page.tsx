// Home = the register (server component guards the session)
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import RegisterTable from "./RegisterTable";
import TopBar from "./TopBar";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="shell">
      <TopBar username={session.username} role={session.role} />
      <main className="main">
        <RegisterTable isAdmin={session.role === "ADMIN"} />
      </main>
    </div>
  );
}