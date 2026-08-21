"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  CircleCheckBig,
  Clock3,
  RefreshCw,
  UserCheck,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { PageHeader } from "@/components/admin/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/src/utils/supabase";

const WIB_TIME_ZONE = "Asia/Jakarta";

type TechnicianRelation =
  | {
      nama_lengkap: string;
    }
  | {
      nama_lengkap: string;
    }[]
  | null;

type DashboardStats = {
  teknisi: number;
  hadirHariIni: number;
  tiketAktif: number;
  tiketSelesai: number;
};

type RecentTicket = {
  id_tugas: string | number;
  nama_klien: string;
  status: string | null;
  created_at: string | null;
  teknisi: TechnicianRelation;
};

type RecentAttendance = {
  id_absen: string | number;
  tipe_log: string | null;
  waktu_log: string | null;
  is_valid: boolean | null;
  teknisi: TechnicianRelation;
};

type TicketStatusPresentation = {
  label: string;
  variant:
    | "success"
    | "warning"
    | "info"
    | "neutral";
};

const initialStats: DashboardStats = {
  teknisi: 0,
  hadirHariIni: 0,
  tiketAktif: 0,
  tiketSelesai: 0,
};

function getWibDayRange(): {
  start: string;
  end: string;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const getPart = (
    type: Intl.DateTimeFormatPartTypes,
  ) =>
    parts.find((part) => part.type === type)?.value ??
    "";

  const localDate = [
    getPart("year"),
    getPart("month"),
    getPart("day"),
  ].join("-");

  return {
    start: new Date(
      `${localDate}T00:00:00.000+07:00`,
    ).toISOString(),
    end: new Date(
      `${localDate}T23:59:59.999+07:00`,
    ).toISOString(),
  };
}

function getTechnicianName(
  relation: TechnicianRelation,
): string {
  if (Array.isArray(relation)) {
    return (
      relation[0]?.nama_lengkap ??
      "Teknisi tidak tersedia"
    );
  }

  return (
    relation?.nama_lengkap ??
    "Teknisi tidak tersedia"
  );
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return initials || "TK";
}

function formatWibDateTime(
  isoDate: string | null,
): string {
  if (!isoDate) {
    return "-";
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTicketStatusPresentation(
  status: string | null,
): TicketStatusPresentation {
  switch (status) {
    case "Success":
      return {
        label: "Selesai",
        variant: "success",
      };

    case "On Process":
      return {
        label: "Diproses",
        variant: "info",
      };

    case "Pending":
      return {
        label: "Menunggu",
        variant: "warning",
      };

    default:
      return {
        label: status || "Tidak diketahui",
        variant: "neutral",
      };
  }
}

export default function AdminDashboardPage() {
  const [stats, setStats] =
    useState<DashboardStats>(initialStats);

  const [recentTickets, setRecentTickets] =
    useState<RecentTicket[]>([]);

  const [recentAttendance, setRecentAttendance] =
    useState<RecentAttendance[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const fetchDashboardData =
    useCallback(async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const { start, end } = getWibDayRange();

        const [
          techniciansResult,
          activeTicketsResult,
          completedTicketsResult,
          attendanceCountResult,
          recentTicketsResult,
          recentAttendanceResult,
        ] = await Promise.all([
          supabase
            .from("teknisi")
            .select("*", {
              count: "exact",
              head: true,
            }),

          supabase
            .from("tiket_tugas")
            .select("*", {
              count: "exact",
              head: true,
            })
            .in("status", [
              "Pending",
              "On Process",
            ]),

          supabase
            .from("tiket_tugas")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("status", "Success"),

          supabase
            .from("log_presensi")
            .select("*", {
              count: "exact",
              head: true,
            })
            .gte("waktu_log", start)
            .lte("waktu_log", end),

          supabase
            .from("tiket_tugas")
            .select(
              [
                "id_tugas",
                "nama_klien",
                "status",
                "created_at",
                "teknisi(nama_lengkap)",
              ].join(","),
            )
            .order("created_at", {
              ascending: false,
            })
            .limit(5),

          supabase
            .from("log_presensi")
            .select(
              [
                "id_absen",
                "tipe_log",
                "waktu_log",
                "is_valid",
                "teknisi(nama_lengkap)",
              ].join(","),
            )
            .order("waktu_log", {
              ascending: false,
            })
            .limit(5),
        ]);

        const queryResults = [
          techniciansResult,
          activeTicketsResult,
          completedTicketsResult,
          attendanceCountResult,
          recentTicketsResult,
          recentAttendanceResult,
        ];

        const queryErrors = queryResults.flatMap(
          (result) =>
            result.error
              ? [result.error.message]
              : [],
        );

        if (queryErrors.length > 0) {
          console.error(
            "Dashboard query errors:",
            queryErrors,
          );

          setErrorMessage(
            "Sebagian data dashboard gagal dimuat. Data yang tersedia tetap ditampilkan.",
          );
        }

        setStats({
          teknisi:
            techniciansResult.count ?? 0,
          tiketAktif:
            activeTicketsResult.count ?? 0,
          tiketSelesai:
            completedTicketsResult.count ?? 0,
          hadirHariIni:
            attendanceCountResult.count ?? 0,
        });

        setRecentTickets(
          (recentTicketsResult.data ??
            []) as unknown as RecentTicket[],
        );

        setRecentAttendance(
          (recentAttendanceResult.data ??
            []) as unknown as RecentAttendance[],
        );
      } catch (error) {
        console.error(
          "Gagal memuat dashboard:",
          error,
        );

        setErrorMessage(
          "Dashboard tidak dapat terhubung ke server. Periksa koneksi lalu coba kembali.",
        );
      } finally {
        setIsLoading(false);
      }
    }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Ringkasan operasional"
        description="Pantau aktivitas teknisi, presensi, dan penyelesaian tiket lapangan dalam satu tampilan."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void fetchDashboardData()
            }
            disabled={isLoading}
          >
            <RefreshCw
              className={
                isLoading
                  ? "animate-spin"
                  : undefined
              }
              aria-hidden="true"
            />
            Segarkan
          </Button>
        }
      />

      {errorMessage ? (
        <div
          role="alert"
          className={[
            "flex flex-col gap-3 rounded-lg",
            "border border-destructive/20",
            "bg-destructive/5 px-4 py-3",
            "sm:flex-row sm:items-center",
          ].join(" ")}
        >
          <CircleAlert
            className="size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />

          <p className="flex-1 text-sm text-destructive">
            {errorMessage}
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              void fetchDashboardData()
            }
          >
            Coba lagi
          </Button>
        </div>
      ) : null}

      <section
        aria-label="Statistik utama"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          title="Total teknisi"
          value={stats.teknisi}
          description="Teknisi lapangan yang terdaftar."
          icon={UsersRound}
          href="/admin/teknisi"
          tone="default"
          isLoading={isLoading}
        />

        <StatCard
          title="Presensi hari ini"
          value={stats.hadirHariIni}
          description="Aktivitas masuk dan pulang hari ini."
          icon={UserCheck}
          href="/admin/presensi"
          tone="success"
          isLoading={isLoading}
        />

        <StatCard
          title="Tiket aktif"
          value={stats.tiketAktif}
          description="Tiket menunggu atau sedang diproses."
          icon={Clock3}
          href="/admin/penugasan"
          tone="warning"
          isLoading={isLoading}
        />

        <StatCard
          title="Tiket selesai"
          value={stats.tiketSelesai}
          description="Total penugasan yang telah diselesaikan."
          icon={CircleCheckBig}
          href="/admin/penugasan"
          tone="info"
          isLoading={isLoading}
        />
      </section>

      <section
        aria-label="Aktivitas terbaru"
        className="grid grid-cols-1 gap-4 xl:grid-cols-5"
      >
        <Card className="min-w-0 xl:col-span-3">
          <CardHeader>
            <CardTitle>
              Penugasan terbaru
            </CardTitle>

            <CardDescription>
              Lima tiket terakhir yang diterbitkan.
            </CardDescription>

            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <Link href="/admin/penugasan">
                  Lihat semua
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="border-y border-border bg-muted/30">
                    <th className="h-9 px-4 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Klien
                    </th>
                    <th className="h-9 px-4 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Teknisi
                    </th>
                    <th className="h-9 px-4 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Dibuat
                    </th>
                    <th className="h-9 px-4 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {isLoading ? (
                    Array.from({
                      length: 5,
                    }).map((_, index) => (
                      <tr
                        key={index}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="h-13 px-4">
                          <Skeleton className="h-4 w-28" />
                        </td>
                        <td className="h-13 px-4">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="h-13 px-4">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="h-13 px-4">
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </td>
                      </tr>
                    ))
                  ) : recentTickets.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="h-28 px-4 text-center text-sm text-muted-foreground"
                      >
                        Belum ada tiket penugasan.
                      </td>
                    </tr>
                  ) : (
                    recentTickets.map((ticket) => {
                      const status =
                        getTicketStatusPresentation(
                          ticket.status,
                        );

                      return (
                        <tr
                          key={ticket.id_tugas}
                          className="border-b border-border transition-colors last:border-b-0 hover:bg-muted/20"
                        >
                          <td className="h-13 max-w-48 px-4">
                            <p className="truncate text-sm font-medium text-foreground">
                              {ticket.nama_klien}
                            </p>
                          </td>

                          <td className="h-13 max-w-44 px-4">
                            <p className="truncate text-xs text-muted-foreground">
                              {getTechnicianName(
                                ticket.teknisi,
                              )}
                            </p>
                          </td>

                          <td className="h-13 whitespace-nowrap px-4 text-xs text-muted-foreground">
                            {formatWibDateTime(
                              ticket.created_at,
                            )}
                          </td>

                          <td className="h-13 px-4">
                            <Badge
                              variant={status.variant}
                            >
                              {status.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-2">
          <CardHeader>
            <CardTitle>
              Presensi terbaru
            </CardTitle>

            <CardDescription>
              Aktivitas teknisi paling baru.
            </CardDescription>

            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <Link href="/admin/presensi">
                  Lihat semua
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>

          <CardContent className="px-0 pb-0">
            <div className="divide-y divide-border">
              {isLoading ? (
                Array.from({
                  length: 5,
                }).map((_, index) => (
                  <div
                    key={index}
                    className="flex h-14 items-center gap-3 px-4"
                  >
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                ))
              ) : recentAttendance.length === 0 ? (
                <div className="flex h-28 items-center justify-center px-4 text-sm text-muted-foreground">
                  Belum ada aktivitas presensi.
                </div>
              ) : (
                recentAttendance.map((attendance) => {
                  const technicianName =
                    getTechnicianName(
                      attendance.teknisi,
                    );

                  return (
                    <div
                      key={attendance.id_absen}
                      className="flex min-h-14 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/20"
                    >
                      <Avatar className="size-8">
                        <AvatarFallback>
                          {getInitials(
                            technicianName,
                          )}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {technicianName}
                        </p>

                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {attendance.tipe_log ||
                            "Presensi"}{" "}
                          ·{" "}
                          {formatWibDateTime(
                            attendance.waktu_log,
                          )}
                        </p>
                      </div>

                      <Badge
                        variant={
                          attendance.is_valid === true
                            ? "success"
                            : attendance.is_valid ===
                                false
                              ? "destructive"
                              : "neutral"
                        }
                      >
                        {attendance.is_valid === true
                          ? "Valid"
                          : attendance.is_valid ===
                              false
                            ? "Tidak valid"
                            : "Diproses"}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}