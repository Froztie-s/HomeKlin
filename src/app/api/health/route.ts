import { connection } from "next/server";
import { checkHealth } from "@/lib/health";

// Uptime monitor target. 200 when the app and Supabase are up, 503 otherwise.
export async function GET() {
  // Always run per request: without this, a missing env var means no fetch, and the
  // handler would be prerendered once at build time.
  // Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md
  await connection();

  const report = await checkHealth({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });

  return Response.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
