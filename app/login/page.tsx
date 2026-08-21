import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Building2,
  ShieldCheck,
} from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasAdminRole } from "@/lib/auth";
import { createServerSupabaseClient } from "@/src/utils/supabase/server";

export const metadata: Metadata = {
  title: "Login Administrator | BTI Operations",
  description:
    "Halaman autentikasi administrator dashboard operasional BTI.",
  robots: {
    index: false,
    follow: false,
  },
};

interface LoginPageProps {
  searchParams: Promise<{
    redirect?: string | string[];
  }>;
}

function getSafeRedirectPath(
  value: string | string[] | undefined,
) {
  const redirectValue = Array.isArray(value)
    ? value[0]
    : value;

  if (
    redirectValue &&
    redirectValue.startsWith("/admin") &&
    !redirectValue.startsWith("//")
  ) {
    return redirectValue;
  }

  return "/admin";
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps) {
  const params = await searchParams;
  const redirectTo = getSafeRedirectPath(
    params.redirect,
  );

  const supabase =
    await createServerSupabaseClient();

  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (claims && hasAdminRole(claims)) {
    redirect("/admin");
  }

  if (claims && !hasAdminRole(claims)) {
    redirect("/unauthorized");
  }

  return (
    <main className="flex min-h-screen bg-background">
      <section className="hidden w-[42%] flex-col justify-between border-r border-border bg-zinc-950 p-10 text-zinc-100 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900">
            <Building2
              className="size-5"
              aria-hidden="true"
            />
          </div>

          <div>
            <p className="text-sm font-semibold">
              BTI Operations
            </p>
            <p className="text-xs text-zinc-400">
              CV Bengkel Teknologi Indonesia
            </p>
          </div>
        </div>

        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Internal operations
          </p>

          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight">
            Satu ruang kerja untuk operasional teknisi
            lapangan.
          </h1>

          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Kelola presensi, QR dinamis, tiket
            penugasan, dan pemetaan lokasi dalam
            dashboard terpusat.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <ShieldCheck
            className="size-4"
            aria-hidden="true"
          />
          Protected by Supabase Auth
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <Card className="w-full max-w-md">
          <CardHeader className="border-b border-border">
            <div className="mb-2 flex size-10 items-center justify-center rounded-md border border-border bg-muted lg:hidden">
              <Building2
                className="size-5 text-foreground"
                aria-hidden="true"
              />
            </div>

            <CardTitle>
              Masuk sebagai administrator
            </CardTitle>

            <CardDescription className="leading-6">
              Gunakan akun Supabase Auth internal yang
              memiliki role administrator.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            <LoginForm redirectTo={redirectTo} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}