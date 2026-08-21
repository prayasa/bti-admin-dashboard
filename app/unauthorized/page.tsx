"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LoaderCircle,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { MobileSidebar } from "@/components/admin/mobile-sidebar";
import { ThemeToggle } from "@/components/admin/theme-toggle";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/src/utils/supabase";

const routeTitles: Array<{
  path: string;
  title: string;
}> = [
  {
    path: "/admin/pemetaan",
    title: "Pemetaan dan Geofencing",
  },
  {
    path: "/admin/penugasan",
    title: "Tiket Penugasan",
  },
  {
    path: "/admin/presensi",
    title: "Riwayat Presensi",
  },
  {
    path: "/admin/teknisi",
    title: "Manajemen Teknisi",
  },
  {
    path: "/admin/qr",
    title: "QR Dinamis",
  },
  {
    path: "/admin",
    title: "Ringkasan Operasional",
  },
];

function getInitials(email: string) {
  const name = email.split("@")[0];

  return name
    .split(/[._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function AdminTopbar() {
  const pathname = usePathname();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const pageTitle = useMemo(() => {
    return (
      routeTitles.find(
        (route) =>
          pathname === route.path ||
          (route.path !== "/admin" &&
            pathname.startsWith(`${route.path}/`)),
      )?.title ?? "Dashboard Admin"
    );
  }, [pathname]);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (error || !user) {
        router.replace("/login");
        router.refresh();
        return;
      }

      setEmail(user.email ?? "Administrator BTI");
    };

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      toast.error("Gagal keluar dari dashboard.", {
        description: error.message,
      });
      setIsLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center border-b border-border bg-background/95 px-4 backdrop-blur-sm sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <MobileSidebar />

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {pageTitle}
          </p>

          <p className="hidden text-xs text-muted-foreground sm:block">
            CV Bengkel Teknologi Indonesia
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="hidden border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300 md:inline-flex"
        >
          <ShieldCheck
            className="size-3.5"
            aria-hidden="true"
          />
          Admin
        </Badge>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-9 gap-2 px-1.5 sm:px-2"
              aria-label="Buka menu akun administrator"
            >
              <Avatar className="size-7">
                <AvatarFallback className="bg-primary text-[10px] font-semibold text-primary-foreground">
                  {email ? getInitials(email) : "AD"}
                </AvatarFallback>
              </Avatar>

              <span className="hidden max-w-40 truncate text-xs font-medium sm:block">
                {email || "Memuat akun..."}
              </span>

              <ChevronDown
                className="hidden size-3.5 text-muted-foreground sm:block"
                aria-hidden="true"
              />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="end"
            className="w-64"
          >
            <DropdownMenuLabel>
              <span className="block text-xs font-normal text-muted-foreground">
                Masuk sebagai
              </span>

              <span className="mt-1 block truncate text-sm font-medium text-foreground">
                {email || "Administrator BTI"}
              </span>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              disabled={isLoggingOut}
              onSelect={(event) => {
                event.preventDefault();
                void handleLogout();
              }}
            >
              {isLoggingOut ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <LogOut
                  className="size-4"
                  aria-hidden="true"
                />
              )}

              {isLoggingOut
                ? "Mengakhiri sesi..."
                : "Keluar dari dashboard"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}