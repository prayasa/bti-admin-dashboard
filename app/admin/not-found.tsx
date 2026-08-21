import Link from "next/link";
import {
  ArrowLeft,
  LayoutDashboard,
  SearchX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminNotFound() {
  return (
    <div className="page-container">
      <div className="flex min-h-[calc(100vh-12rem)] items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <div className="mb-3 flex size-10 items-center justify-center rounded-md border border-border bg-muted">
              <SearchX
                className="size-5 text-muted-foreground"
                aria-hidden="true"
              />
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Error 404
            </p>

            <CardTitle>Halaman admin tidak ditemukan</CardTitle>

            <CardDescription className="leading-6">
              Alamat yang dibuka tidak terdaftar di dalam dashboard
              BTI atau halaman tersebut telah dipindahkan.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="sm:flex-1" asChild>
                <Link href="/admin">
                  <LayoutDashboard
                    className="size-4"
                    aria-hidden="true"
                  />
                  Dashboard utama
                </Link>
              </Button>

              <Button
                variant="outline"
                className="sm:flex-1"
                asChild
              >
                <Link href="/admin/penugasan">
                  <ArrowLeft
                    className="size-4"
                    aria-hidden="true"
                  />
                  Lihat penugasan
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}