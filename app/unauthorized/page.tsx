"use client";

import {
  LoaderCircle,
  LogOut,
  ShieldAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ThemeToggle } from "@/components/admin/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/src/utils/supabase";

export default function UnauthorizedPage() {
  const router = useRouter();

  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const handleBackToLogin = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      const { error } =
        await supabase.auth.signOut({
          scope: "local",
        });

      if (error) {
        console.error(
          "Gagal mengakhiri sesi:",
          error,
        );

        toast.error(
          "Gagal mengakhiri sesi.",
          {
            description:
              "Silakan coba kembali beberapa saat lagi.",
          },
        );

        setIsLoggingOut(false);
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error(
        "Terjadi kesalahan saat keluar:",
        error,
      );

      toast.error(
        "Tidak dapat kembali ke halaman masuk.",
        {
          description:
            "Periksa koneksi internet Anda.",
        },
      );

      setIsLoggingOut(false);
    }
  };

  return (
    <main className="relative flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md border-border shadow-none">
        <CardHeader className="items-center text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/10">
            <ShieldAlert
              className="size-7 text-destructive"
              aria-hidden="true"
            />
          </div>

          <Badge
            variant="destructive"
            className="mt-2"
          >
            Akses ditolak
          </Badge>

          <CardTitle className="text-xl">
            Anda tidak memiliki izin
          </CardTitle>

          <CardDescription className="max-w-sm leading-relaxed">
            Akun yang digunakan tidak memiliki
            hak akses untuk membuka Dashboard
            Admin BTI.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm font-medium text-foreground">
              Apa yang dapat dilakukan?
            </p>

            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Keluar dari sesi saat ini, kemudian
              masuk menggunakan akun administrator
              yang telah terdaftar dan memiliki izin.
            </p>
          </div>

          <Button
            type="button"
            className="w-full"
            onClick={() =>
              void handleBackToLogin()
            }
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <LoaderCircle
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <LogOut aria-hidden="true" />
            )}

            {isLoggingOut
              ? "Mengakhiri sesi..."
              : "Keluar dan kembali ke login"}
          </Button>

          <p className="text-center text-[11px] text-muted-foreground">
            CV Bengkel Teknologi Indonesia
          </p>
        </CardContent>
      </Card>
    </main>
  );
}