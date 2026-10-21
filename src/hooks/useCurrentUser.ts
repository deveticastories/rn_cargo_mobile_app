import { useMemo } from "react";
import { useAppSelector } from "@/store/hooks";
import { nameFromEmail } from "@/utils/format";

/**
 * The login response only carries id/email/role, so the display name comes
 * from the matching Team (employee) record when there is one.
 */
export function useCurrentUser() {
  const user = useAppSelector((s) => s.auth.user);
  const team = useAppSelector((s) => s.masters.team.items);
  return useMemo(() => {
    const employee = team.find((e) => user && (e._id === user.id || (e.email && String(e.email).toLowerCase() === user.email.toLowerCase())));
    const name = (employee?.name as string | undefined) || user?.name || nameFromEmail(user?.email) || "Admin";
    return { user, name, role: user?.role || "Admin", email: user?.email ?? "" };
  }, [user, team]);
}
