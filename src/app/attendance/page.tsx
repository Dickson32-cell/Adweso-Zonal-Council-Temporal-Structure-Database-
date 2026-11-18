// /attendance - server-gated wrapper: full administrator of the Adweso council only.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getFullUser, councilId } from "@/lib/db";
import { permsFor } from "@/lib/perms";
import TopBar from "@/app/TopBar";
import AttendanceSheet from "./Sheet";

export default async function AttendancePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const me = await getFullUser(session);
  if (!me || !me.active) redirect("/login");
  const perms = permsFor(me.role, me.adminLevel);
  const allowed = councilId() === "adweso" && me.role === "ADMIN" && perms.canManageUsers === true;

  return (
    <div className="shell">
      <TopBar username={me.username} role={me.role} canReviewPasswords={perms.canReviewPasswords} showMaster={false} />
      {allowed ? (
        <AttendanceSheet username={me.username} />
      ) : (
        <div className="main">
          <div className="card" style={{ textAlign: "center" }}>
            <h2>Administrators only</h2>
            <p className="sub">This sheet is for the full administrator of the Adweso zonal council. Ask the office administrator if you need your pay sheet.</p>
            <a className="btn btn-primary" href="/">Back to the register</a>
          </div>
        </div>
      )}
    </div>
  );
}
