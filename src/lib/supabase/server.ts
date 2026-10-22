import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireSupabaseConfig } from "./config";

type ServerClientOptions = {
  /**
   * Server Actions may write cookies (signing in and out sets or clears the session). Server Components
   * may not: for them the session was already refreshed by the proxy (src/proxy.ts), so the client
   * only reads.
   */
  writeCookies: boolean;
};

// A Supabase client that acts as the signed-in visitor, from their session cookies, so row-level
// security applies to everything it reads. Create one per request; never share it between requests.
// Reading cookies makes the caller request-time: with Cache Components, call this only behind a
// <Suspense> boundary or in a Server Action.
// Sources: https://supabase.com/docs/guides/auth/server-side/creating-a-client and the createServerClient
// doc comment in node_modules/@supabase/ssr/dist/main/createServerClient.d.ts
export async function createSupabaseServerClient({ writeCookies }: ServerClientOptions) {
  const { url, publishableKey } = requireSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        if (!writeCookies) return;
        for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
      },
    },
  });
}
