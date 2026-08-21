import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { clientEnv } from "@/lib/env";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    clientEnv.supabaseUrl,
    clientEnv.supabasePublicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(name, value, options);
              },
            );
          } catch {
            /*
             * Server Components tidak dapat menulis cookie.
             * Pembaruan session ditangani oleh proxy.ts.
             */
          }
        },
      },
    },
  );
}