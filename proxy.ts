import type { NextRequest } from "next/server";

import { updateSupabaseSession } from "@/src/utils/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/login",
    "/unauthorized",
  ],
};