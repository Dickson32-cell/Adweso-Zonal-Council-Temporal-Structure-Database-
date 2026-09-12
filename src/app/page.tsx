// Home = the register (server component guards the session)
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFullUser } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import RegisterTable from "./RegisterTable";
import TopBar from "./TopBar";

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const me = await getFullUser(session);
  if (!me || !me.active) redirect("/login");

  const perms = permsFor(me.role, me.adminLevel);

  return (
    <div className="shell">
      <TopBar username={me.username} role={me.role} canReviewPasswords={perms.canReviewPasswords} />
      <main className="main">
        <RegisterTable
          isAdmin={me.role === "ADMIN"}
          canDelete={perms.canDeleteRecords}
          canEditDirect={perms.canEditRecords}
          canCreate={perms.canCreateRecords}
          canPay={perms.canRecordPayments}
        />
      </main>
    </div>
  );
}