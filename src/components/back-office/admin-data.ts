import { cache } from "react";
import { listAdminJobs } from "@/lib/jobs/jobs";
import { listInbox } from "@/lib/support/support";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The admin console's reads (T24, T26), with the signed-in admin's own session: admin_jobs() and
// admin_ticket_inbox() answer admins only. React's cache shares one read per request, so the dashboard's
// tiles and its lists ask the database once each. Call them only inside <RoleGate roles={["admin"]}>.
// Source: node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md ("Reusing data with React.cache")

export const getAdminJobs = cache(async () => listAdminJobs(await createSupabaseServerClient({ writeCookies: false })));

export const getAdminInbox = cache(async () => listInbox(await createSupabaseServerClient({ writeCookies: false })));
