import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

import { hasAdminRole } from "@/lib/auth";
import { clientEnv } from "@/lib/env";

function copyResponseCookies(
  source: NextResponse,
  target: NextResponse,
) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  return target;
}

function createRedirectResponse(
  request: NextRequest,
  response: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone();

  url.pathname = pathname;
  url.search = "";

  return copyResponseCookies(
    response,
    NextResponse.redirect(url),
  );
}

export async function updateSupabaseSession(
  request: NextRequest,
) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    clientEnv.supabaseUrl,
    clientEnv.supabasePublicKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(name, value, options);
            },
          );

          Object.entries(headersToSet).forEach(
            ([name, value]) => {
              response.headers.set(name, value);
            },
          );
        },
      },
    },
  );

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const claims = claimsData?.claims;
  const isAuthenticated =
    !claimsError && Boolean(claims);
  const isAdmin =
    isAuthenticated && hasAdminRole(claims);

  const pathname = request.nextUrl.pathname;

  const isAdminRoute =
    pathname === "/admin" ||
    pathname.startsWith("/admin/");

  const isLoginRoute = pathname === "/login";
  const isUnauthorizedRoute =
    pathname === "/unauthorized";

  if (isAdminRoute && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    const intendedDestination = `${pathname}${request.nextUrl.search}`;

    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "redirect",
      intendedDestination,
    );

    return copyResponseCookies(
      response,
      NextResponse.redirect(loginUrl),
    );
  }

  if (isAdminRoute && !isAdmin) {
    return createRedirectResponse(
      request,
      response,
      "/unauthorized",
    );
  }

  if (isLoginRoute && isAdmin) {
    return createRedirectResponse(
      request,
      response,
      "/admin",
    );
  }

  if (
    isLoginRoute &&
    isAuthenticated &&
    !isAdmin
  ) {
    return createRedirectResponse(
      request,
      response,
      "/unauthorized",
    );
  }

  if (isUnauthorizedRoute && !isAuthenticated) {
    return createRedirectResponse(
      request,
      response,
      "/login",
    );
  }

  if (isUnauthorizedRoute && isAdmin) {
    return createRedirectResponse(
      request,
      response,
      "/admin",
    );
  }

  return response;
}