import Link from "next/link";
import {
  ArrowRight,
  Building2,
  SearchX,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-xl">
        <div className="border-b border-border pb-6">
          <div className="flex size-11 items-center justify-center rounded-md border border-border bg-muted">
            <SearchX
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            404 · Page not found
          </p>

          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
            Halaman tidak tersedia
          </h1>

          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            URL yang Anda buka tidak ditemukan. Periksa kembali
            alamat halaman atau kembali ke dashboard operasional
            BTI.
          </p>
        </div>

        <div className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex size-9 items-center justify-center rounded-md border border-border">
              <Building2 className="size-4" aria-hidden="true" />
            </div>

            <div>
              <p className="font-medium text-foreground">
                BTI Operations
              </p>
              <p className="text-xs">
                CV Bengkel Teknologi Indonesia
              </p>
            </div>
          </div>

          <Button asChild>
            <Link href="/admin">
              Buka dashboard
              <ArrowRight
                className="size-4"
                aria-hidden="true"
              />
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}