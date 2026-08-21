"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Home,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AdminErrorProps {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}

export default function AdminError({
  error,
  reset,
}: AdminErrorProps) {
  useEffect(() => {
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <div className="page-container">
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        <Card
          className="w-full max-w-lg"
          role="alert"
          aria-labelledby="admin-error-title"
        >
          <CardHeader>
            <div className="mb-3 flex size-10 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10">
              <AlertTriangle
                className="size-5 text-destructive"
                aria-hidden="true"
              />
            </div>

            <CardTitle id="admin-error-title">
              Halaman tidak dapat ditampilkan
            </CardTitle>

            <CardDescription className="leading-6">
              Terjadi gangguan ketika dashboard memproses data.
              Coba muat ulang halaman. Jika masalah tetap terjadi,
              periksa koneksi Supabase dan konfigurasi environment.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error.digest ? (
              <div className="mb-5 rounded-md border border-border bg-muted/50 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Referensi kesalahan
                </p>

                <code className="mt-1 block break-all font-mono text-xs text-foreground">
                  {error.digest}
                </code>
              </div>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                onClick={reset}
                className="sm:flex-1"
              >
                <RefreshCw
                  className="size-4"
                  aria-hidden="true"
                />
                Coba lagi
              </Button>

              <Button
                variant="outline"
                className="sm:flex-1"
                asChild
              >
                <Link href="/admin">
                  <Home className="size-4" aria-hidden="true" />
                  Kembali ke dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}