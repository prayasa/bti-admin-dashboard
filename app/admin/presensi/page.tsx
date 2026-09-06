"use client";

import {
  CircleAlert,
  MapPin,
  Radio,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { DeleteAttendanceDialog } from "@/components/presensi/delete-attendance-dialog";
import {
  TechnicianList,
  type TechnicianListItem,
} from "@/components/presensi/technician-list";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/src/utils/supabase";

const WIB_TIME_ZONE = "Asia/Jakarta";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type FilterMode =
  | "hari"
  | "minggu"
  | "bulan";

type TechnicianRow = {
  id: string | number;
  nama_lengkap: string;
  nik: string | null;
};

type TechnicianRelation =
  | {
      nama_lengkap: string;
    }
  | {
      nama_lengkap: string;
    }[]
  | null;

type AttendanceLog = {
  id_absen: string | number;
  id_teknisi: string | number;
  waktu_log: string | null;
  tipe_log: string | null;
  latitude_aktual: number | null;
  longitude_aktual: number | null;
  is_valid: boolean | null;
  teknisi: TechnicianRelation;
};

type AttendanceAudit = {
  id_audit: string | number;
  technician_id: string;
  attendance_type: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  location_age_ms: number | null;
  distance_meters: number | null;
  is_mock: boolean | null;
  result: string;
  reason: string | null;
  created_at: string | null;
};

type DeleteTarget = {
  id: string | number;
  technicianName: string;
  formattedTime: string;
};

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

  return `${new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)} WIB`;
}

function getWibDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getWibMonthKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: WIB_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function isLogInsideFilter(
  isoDate: string | null,
  filterMode: FilterMode,
): boolean {
  if (!isoDate) {
    return false;
  }

  const logDate = new Date(isoDate);

  if (Number.isNaN(logDate.getTime())) {
    return false;
  }

  const now = new Date();

  if (filterMode === "hari") {
    return (
      getWibDateKey(logDate) ===
      getWibDateKey(now)
    );
  }

  if (filterMode === "minggu") {
    const difference =
      now.getTime() - logDate.getTime();

    return (
      difference >= 0 &&
      difference <= 7 * DAY_IN_MS
    );
  }

  return (
    getWibMonthKey(logDate) ===
    getWibMonthKey(now)
  );
}

function hasCoordinates(
  latitude: number | null,
  longitude: number | null,
): boolean {
  if (
    latitude === null ||
    longitude === null
  ) {
    return false;
  }

  return (
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude)) &&
    !(latitude === 0 && longitude === 0)
  );
}

function formatMeters(
  value: number | null,
): string {
  if (
    value === null ||
    !Number.isFinite(Number(value))
  ) {
    return "-";
  }

  return `${Math.round(Number(value))} m`;
}

export default function AttendancePage() {
  const [technicians, setTechnicians] =
    useState<TechnicianListItem[]>([]);

  const [
    selectedTechnicianId,
    setSelectedTechnicianId,
  ] = useState<string | null>(null);

  const [attendanceLogs, setAttendanceLogs] =
    useState<AttendanceLog[]>([]);

  const [attendanceAudits, setAttendanceAudits] =
    useState<AttendanceAudit[]>([]);

  const [filterMode, setFilterMode] =
    useState<FilterMode>("minggu");

  const [isFetching, setIsFetching] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] =
    useState<DeleteTarget | null>(null);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsFetching(true);
      }

      setErrorMessage(null);

      try {
        const [
          techniciansResult,
          attendanceResult,
          auditsResult,
        ] = await Promise.all([
          supabase
            .from("teknisi")
            .select(
              "id, nama_lengkap, nik",
            )
            .order("nama_lengkap", {
              ascending: true,
            }),

          supabase
            .from("log_presensi")
            .select(
              [
                "id_absen",
                "id_teknisi",
                "waktu_log",
                "tipe_log",
                "latitude_aktual",
                "longitude_aktual",
                "is_valid",
                "teknisi(nama_lengkap)",
              ].join(","),
            )
            .order("waktu_log", {
              ascending: false,
            })
            .limit(1000),

          supabase
            .from("presensi_audit")
            .select(
              [
                "id_audit",
                "technician_id",
                "attendance_type",
                "latitude",
                "longitude",
                "accuracy_meters",
                "location_age_ms",
                "distance_meters",
                "is_mock",
                "result",
                "reason",
                "created_at",
              ].join(","),
            )
            .eq("result", "REJECTED")
            .order("created_at", {
              ascending: false,
            })
            .limit(1000),
        ]);

        const errors = [
          techniciansResult.error,
          attendanceResult.error,
          auditsResult.error,
        ].flatMap((error) =>
          error ? [error.message] : [],
        );

        if (errors.length > 0) {
          console.error(
            "Presensi query errors:",
            errors,
          );

          setErrorMessage(
            "Sebagian data presensi gagal dimuat. Coba segarkan halaman.",
          );
        }

        const normalizedTechnicians = (
          (techniciansResult.data ??
            []) as TechnicianRow[]
        ).map((technician) => ({
          id: String(technician.id),
          nama_lengkap:
            technician.nama_lengkap,
          nik: technician.nik,
        }));

        setTechnicians(
          normalizedTechnicians,
        );

        setSelectedTechnicianId(
          (currentId) => {
            const stillExists =
              normalizedTechnicians.some(
                (technician) =>
                  technician.id === currentId,
              );

            if (stillExists) {
              return currentId;
            }

            return (
              normalizedTechnicians[0]?.id ??
              null
            );
          },
        );

        setAttendanceLogs(
          (attendanceResult.data ??
            []) as unknown as AttendanceLog[],
        );

        setAttendanceAudits(
          (auditsResult.data ??
            []) as unknown as AttendanceAudit[],
        );
      } catch (error) {
        console.error(
          "Gagal memuat presensi:",
          error,
        );

        setErrorMessage(
          "Tidak dapat terhubung ke server presensi.",
        );
      } finally {
        if (showLoading) {
          setIsFetching(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void fetchData();

    const realtimeChannel = supabase
      .channel("admin-presensi-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "log_presensi",
        },
        () => {
          void fetchData(false);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presensi_audit",
        },
        () => {
          void fetchData(false);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(
        realtimeChannel,
      );
    };
  }, [fetchData]);

  const selectedTechnician =
    technicians.find(
      (technician) =>
        technician.id ===
        selectedTechnicianId,
    ) ?? null;

  const filteredLogs = useMemo(
    () =>
      attendanceLogs.filter(
        (log) =>
          String(log.id_teknisi) ===
            selectedTechnicianId &&
          isLogInsideFilter(
            log.waktu_log,
            filterMode,
          ),
      ),
    [
      attendanceLogs,
      filterMode,
      selectedTechnicianId,
    ],
  );

  const filteredRejectedAudits = useMemo(
    () =>
      attendanceAudits.filter(
        (audit) =>
          String(audit.technician_id) ===
            selectedTechnicianId &&
          isLogInsideFilter(
            audit.created_at,
            filterMode,
          ),
      ),
    [
      attendanceAudits,
      filterMode,
      selectedTechnicianId,
    ],
  );

  const attendanceSummary = useMemo(() => {
    const validLogs = filteredLogs.filter(
      (log) => log.is_valid === true,
    );

    const invalidLogs = filteredLogs.filter(
      (log) => log.is_valid === false,
    );

    const dailyTracker = new Map<
      string,
      {
        masuk: boolean;
        pulang: boolean;
      }
    >();

    validLogs.forEach((log) => {
      if (!log.waktu_log) {
        return;
      }

      const dateKey = getWibDateKey(
        new Date(log.waktu_log),
      );

      const current =
        dailyTracker.get(dateKey) ?? {
          masuk: false,
          pulang: false,
        };

      if (log.tipe_log === "MASUK") {
        current.masuk = true;
      }

      if (log.tipe_log === "PULANG") {
        current.pulang = true;
      }

      dailyTracker.set(dateKey, current);
    });

    const completeDays = Array.from(
      dailyTracker.values(),
    ).filter(
      (day) => day.masuk && day.pulang,
    ).length;

    return {
      official: filteredLogs.length,
      valid: validLogs.length,
      rejected:
        invalidLogs.length +
        filteredRejectedAudits.length,
      completeDays,
    };
  }, [filteredLogs, filteredRejectedAudits]);

  const handleDeleteAttendance =
    async (): Promise<boolean> => {
      if (!deleteTarget) {
        return false;
      }

      try {
        const { error } = await supabase
          .from("log_presensi")
          .delete()
          .eq(
            "id_absen",
            deleteTarget.id,
          );

        if (error) {
          console.error(
            "Gagal menghapus presensi:",
            error,
          );

          toast.error(
            "Presensi gagal dihapus.",
            {
              description:
                "Periksa koneksi atau izin database.",
            },
          );

          return false;
        }

        setAttendanceLogs((currentLogs) =>
          currentLogs.filter(
            (log) =>
              log.id_absen !==
              deleteTarget.id,
          ),
        );

        toast.success(
          "Presensi berhasil dihapus.",
        );

        return true;
      } catch (error) {
        console.error(
          "Gagal menghapus presensi:",
          error,
        );

        toast.error(
          "Terjadi kesalahan saat menghapus presensi.",
        );

        return false;
      }
    };

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Manajemen Presensi"
        description="Pantau riwayat masuk dan pulang teknisi, validasi geofence, serta percobaan presensi yang ditolak."
        actions={
          <>
            <Badge variant="success">
              <Radio aria-hidden="true" />
              Realtime aktif
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void fetchData()
              }
              disabled={isFetching}
            >
              <RefreshCw
                className={
                  isFetching
                    ? "animate-spin"
                    : undefined
                }
                aria-hidden="true"
              />
              Segarkan
            </Button>
          </>
        }
      />

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3"
        >
          <CircleAlert
            className="size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />

          <p className="text-sm text-destructive">
            {errorMessage}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <TechnicianList
          technicians={technicians}
          selectedId={
            selectedTechnicianId
          }
          isLoading={isFetching}
          onSelect={
            setSelectedTechnicianId
          }
        />

        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedTechnician
                  ? selectedTechnician.nama_lengkap
                  : "Detail presensi"}
              </CardTitle>

              <CardDescription>
                {selectedTechnician?.nik
                  ? `NIK ${selectedTechnician.nik}`
                  : "Pilih teknisi untuk melihat data."}
              </CardDescription>

              <CardAction>
                <Select
                  value={filterMode}
                  onValueChange={(value) =>
                    setFilterMode(
                      value as FilterMode,
                    )
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="hari">
                      Hari ini
                    </SelectItem>
                    <SelectItem value="minggu">
                      7 hari terakhir
                    </SelectItem>
                    <SelectItem value="bulan">
                      Bulan ini
                    </SelectItem>
                  </SelectContent>
                </Select>
              </CardAction>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border lg:grid-cols-4">
                {[
                  {
                    label: "Presensi resmi",
                    value:
                      attendanceSummary.official,
                  },
                  {
                    label: "Valid",
                    value:
                      attendanceSummary.valid,
                  },
                  {
                    label: "Percobaan ditolak",
                    value:
                      attendanceSummary.rejected,
                  },
                  {
                    label: "Hari lengkap",
                    value:
                      attendanceSummary.completeDays,
                  },
                ].map((summary, index) => (
                  <div
                    key={summary.label}
                    className={[
                      "px-4 py-3",
                      "border-border",
                      index % 2 === 0
                        ? "border-r"
                        : "",
                      index < 2
                        ? "border-b lg:border-b-0"
                        : "",
                      index === 1
                        ? "lg:border-r"
                        : "",
                    ].join(" ")}
                  >
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {summary.label}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
                      {isFetching
                        ? "-"
                        : summary.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_400px]">
            <Card className="min-w-0 gap-0 overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle>
                  Riwayat presensi
                </CardTitle>

                <CardDescription>
                  Data masuk, pulang, dan validasi
                  lokasi teknisi terpilih.
                </CardDescription>
              </CardHeader>

              <CardContent className="px-0 [&:last-child]:pb-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        Waktu
                      </TableHead>
                      <TableHead>
                        Tipe
                      </TableHead>
                      <TableHead>
                        Koordinat
                      </TableHead>
                      <TableHead>
                        Validasi
                      </TableHead>
                      <TableHead className="w-14 text-right">
                        Aksi
                      </TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isFetching ? (
                      Array.from({
                        length: 6,
                      }).map((_, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-14 rounded-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-4 w-36" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="h-5 w-20 rounded-full" />
                          </TableCell>
                          <TableCell>
                            <Skeleton className="ml-auto size-8" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : !selectedTechnician ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-32 text-center text-sm text-muted-foreground"
                        >
                          Pilih teknisi terlebih
                          dahulu.
                        </TableCell>
                      </TableRow>
                    ) : filteredLogs.length ===
                      0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="h-32 text-center text-sm text-muted-foreground"
                        >
                          Tidak ada presensi pada
                          rentang waktu ini.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => {
                        const technicianName =
                          getTechnicianName(
                            log.teknisi,
                          );

                        const formattedTime =
                          formatWibDateTime(
                            log.waktu_log,
                          );

                        const validCoordinates =
                          hasCoordinates(
                            log.latitude_aktual,
                            log.longitude_aktual,
                          );

                        return (
                          <TableRow
                            key={log.id_absen}
                          >
                            <TableCell className="whitespace-nowrap text-xs font-medium">
                              {formattedTime}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={
                                  log.tipe_log ===
                                  "MASUK"
                                    ? "success"
                                    : log.tipe_log ===
                                        "PULANG"
                                      ? "warning"
                                      : "neutral"
                                }
                              >
                                {log.tipe_log ||
                                  "Tidak diketahui"}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              {validCoordinates ? (
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                                  <MapPin
                                    className="size-3"
                                    aria-hidden="true"
                                  />
                                  {Number(
                                    log.latitude_aktual,
                                  ).toFixed(5)}
                                  ,{" "}
                                  {Number(
                                    log.longitude_aktual,
                                  ).toFixed(5)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  GPS tidak tersedia
                                </span>
                              )}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={
                                  log.is_valid ===
                                  true
                                    ? "success"
                                    : log.is_valid ===
                                        false
                                      ? "destructive"
                                      : "neutral"
                                }
                              >
                                {log.is_valid ===
                                true
                                  ? "Sesuai radius"
                                  : log.is_valid ===
                                      false
                                    ? "Di luar radius"
                                    : "Belum divalidasi"}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() =>
                                  setDeleteTarget({
                                    id: log.id_absen,
                                    technicianName,
                                    formattedTime,
                                  })
                                }
                                aria-label={`Hapus presensi ${technicianName}`}
                                title="Hapus presensi"
                              >
                                <Trash2
                                  aria-hidden="true"
                                />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="min-w-0 gap-0 overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle>
                  Percobaan ditolak
                </CardTitle>

                <CardDescription>
                  Audit presensi teknisi terpilih
                  yang tidak lolos validasi.
                </CardDescription>

                <CardAction>
                  <Badge
                    variant={
                      filteredRejectedAudits.length > 0
                        ? "destructive"
                        : "success"
                    }
                  >
                    {filteredRejectedAudits.length}
                  </Badge>
                </CardAction>
              </CardHeader>

              <CardContent className="px-0 [&:last-child]:pb-0">
                <div className="max-h-[560px] overflow-y-auto border-t border-border">
                  {isFetching ? (
                    Array.from({
                      length: 5,
                    }).map((_, index) => (
                      <div
                        key={index}
                        className="space-y-3 border-b border-border p-4 last:border-b-0"
                      >
                        <div className="flex justify-between gap-3">
                          <Skeleton className="h-5 w-16 rounded-full" />
                          <Skeleton className="h-3 w-28" />
                        </div>

                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />

                        <div className="grid grid-cols-2 gap-2">
                          <Skeleton className="h-11 w-full" />
                          <Skeleton className="h-11 w-full" />
                        </div>
                      </div>
                    ))
                  ) : !selectedTechnician ? (
                    <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 text-center">
                      <ShieldAlert
                        className="size-5 text-muted-foreground"
                        aria-hidden="true"
                      />

                      <p className="text-xs text-muted-foreground">
                        Pilih teknisi untuk melihat
                        percobaan presensi yang ditolak.
                      </p>
                    </div>
                  ) : filteredRejectedAudits.length ===
                    0 ? (
                    <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-6 text-center">
                      <ShieldAlert
                        className="size-5 text-success"
                        aria-hidden="true"
                      />

                      <p className="text-xs font-medium text-foreground">
                        Tidak ada penolakan
                      </p>

                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Tidak ada percobaan presensi
                        yang ditolak pada rentang waktu
                        ini.
                      </p>
                    </div>
                  ) : (
                    filteredRejectedAudits.map(
                      (audit) => {
                        const validCoordinates =
                          hasCoordinates(
                            audit.latitude,
                            audit.longitude,
                          );

                        return (
                          <article
                            key={audit.id_audit}
                            className="border-b border-border p-4 last:border-b-0"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <Badge
                                  variant={
                                    audit.attendance_type ===
                                    "MASUK"
                                      ? "success"
                                      : audit.attendance_type ===
                                          "PULANG"
                                        ? "warning"
                                        : "neutral"
                                  }
                                >
                                  {audit.attendance_type ||
                                    "Tidak diketahui"}
                                </Badge>

                                <Badge variant="destructive">
                                  Ditolak
                                </Badge>
                              </div>

                              <time
                                className="shrink-0 text-right text-[10px] leading-relaxed text-muted-foreground"
                                dateTime={
                                  audit.created_at ??
                                  undefined
                                }
                              >
                                {formatWibDateTime(
                                  audit.created_at,
                                )}
                              </time>
                            </div>

                            <div className="mt-3 flex items-start gap-2">
                              <ShieldAlert
                                className="mt-0.5 size-4 shrink-0 text-destructive"
                                aria-hidden="true"
                              />

                              <p className="text-xs leading-relaxed text-foreground">
                                {audit.reason ||
                                  "Permintaan ditolak oleh server."}
                              </p>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <div className="col-span-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Lokasi perangkat
                                </p>

                                {validCoordinates ? (
                                  <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] text-foreground">
                                    <MapPin
                                      className="size-3 text-muted-foreground"
                                      aria-hidden="true"
                                    />

                                    {Number(
                                      audit.latitude,
                                    ).toFixed(5)}
                                    ,{" "}
                                    {Number(
                                      audit.longitude,
                                    ).toFixed(5)}
                                  </p>
                                ) : (
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    GPS tidak tersedia
                                  </p>
                                )}
                              </div>

                              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Jarak kantor
                                </p>

                                <p className="mt-1 text-xs font-semibold tabular-nums text-foreground">
                                  {formatMeters(
                                    audit.distance_meters,
                                  )}
                                </p>
                              </div>

                              <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                  Akurasi GPS
                                </p>

                                <p className="mt-1 text-xs font-semibold tabular-nums text-foreground">
                                  {formatMeters(
                                    audit.accuracy_meters,
                                  )}
                                </p>
                              </div>
                            </div>

                            {audit.is_mock === true ? (
                              <Badge
                                variant="destructive"
                                className="mt-3"
                              >
                                Lokasi tiruan terdeteksi
                              </Badge>
                            ) : null}
                          </article>
                        );
                      },
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <DeleteAttendanceDialog
        open={Boolean(deleteTarget)}
        technicianName={
          deleteTarget?.technicianName ?? ""
        }
        attendanceTime={
          deleteTarget?.formattedTime ?? ""
        }
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={
          handleDeleteAttendance
        }
      />
    </div>
  );
}
