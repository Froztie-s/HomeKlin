import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth/dal";
import type { AppRole } from "@/lib/auth/roles";

type RoleGateProps = {
  /** The roles that may see the content. */
  roles: readonly AppRole[];
  children: ReactNode;
};

// Renders its content only for a signed-in user with one of `roles`; everyone else is redirected
// (requireRole). It reads the session, so it must sit inside a <Suspense> boundary: the page's shell
// (navigation, header) stays in the static, instantly loading part, and the content streams in after
// the check. It guards what a page renders; data reads still check access themselves (requireRole and
// row-level security), because a check in a layout does not re-run on every navigation.
export async function RoleGate({ roles, children }: RoleGateProps) {
  await requireRole(roles);
  return children;
}
