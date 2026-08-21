import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env";

export function createBrowserSupabaseClient() {
  return createBrowserClient(
    clientEnv.supabaseUrl,
    clientEnv.supabasePublicKey,
    {
      db: {
        schema: "public",
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      global: {
        headers: {
          "x-application-name": "bti-admin-dashboard",
        },
      },
    },
  );
}

export const supabase = createBrowserSupabaseClient();