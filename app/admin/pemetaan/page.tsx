"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  MapLegend,
  type MapLayerKey,
  type MapLayerVisibility,
} from "@/components/pemetaan/map-legend";
import { MapSummary } from "@/components/pemetaan/map-summary";
import {
  OperationsMap,
  type AttendanceMapPoint,
  type MapAssignmentPoint,
} from "@/components/pemetaan/operations-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/src/utils/supabase";

interface TechnicianRelation {
  nama_lengkap: string;
}

interface AssignmentDatabaseRow {
  id_tugas: string;
  nama_klien: string;
  alamat_klien: string;
  latitude_klien: number | string | null;
  longitude_klien: number | string | null;
  status: string | null;
  teknisi: TechnicianRelation | TechnicianRelation[] | null;
}

interface AttendanceDatabaseRow {
  id_absen: string;
  latitude_aktual: number | string | null;
  longitude_aktual: number | string | null;
  is_valid: boolean | null;
  tipe_log: string | null;
  waktu_log: string;
  teknisi: TechnicianRelation | TechnicianRelation[] | null;
}

type RealtimeStatus =
  | "CONNECTING"
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED";

const initialVisibility: MapLayerVisibility = {
  office: true,
  attendance: true,
  activeAssignments: true,
  completedAssignments: true,
};

function getTechnicianName(
  relation: TechnicianRelation | TechnicianRelation[] | null,
) {
  if (Array.isArray(relation)) {
    return relation[0]?.nama_lengkap ?? "Teknisi tidak tersedia";
  }

  return relation?.nama_lengkap ?? "Teknisi tidak tersedia";
}

function getPontianakDayRange() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Pontianak",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  const date = `${year}-${month}-${day}`;
  const start = new Date(`${date}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Pontianak",
  }).format(new Date(value));
}

function formatLastUpdated(value: Date | null) {
  if (!value) {
    return "Belum diperbarui";
  }

  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Pontianak",
  }).format(value);
}

function normalizeLogType(type: string) {
  switch (type.toUpperCase()) {
    case "MASUK":
      return "Masuk";
    case "PULANG":
      return "Pulang";
    default:
      return type;
  }
}

export default function SpatialMappingPage() {
  const [assignments, setAssignments] = useState<
    MapAssignmentPoint[]
  >([]);
  const [attendancePoints, setAttendancePoints] = useState<
    AttendanceMapPoint[]
  >([]);
  const [visibility, setVisibility] =
    useState<MapLayerVisibility>(initialVisibility);
  const [isFetching, setIsFetching] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(
    null,
  );
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>("CONNECTING");

  const refreshTimerRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const fetchMapData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsFetching(true);
      }

      const dayRange = getPontianakDayRange();

      const [assignmentsResult, attendanceResult] =
        await Promise.all([
          supabase
            .from("tiket_tugas")
            .select(
              `
                id_tugas,
                nama_klien,
                alamat_klien,
                latitude_klien,
                longitude_klien,
                status,
                teknisi (nama_lengkap)
              `,
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("log_presensi")
            .select(
              `
                id_absen,
                latitude_aktual,
                longitude_aktual,
                is_valid,
                tipe_log,
                waktu_log,
                teknisi (nama_lengkap)
              `,
            )
            .gte("waktu_log", dayRange.start)
            .lt("waktu_log", dayRange.end)
            .not("latitude_aktual", "is", null)
            .not("longitude_aktual", "is", null)
            .neq("latitude_aktual", 0)
            .neq("longitude_aktual", 0)
            .order("waktu_log", { ascending: false }),
        ]);

      let hasError = false;

      if (assignmentsResult.error) {
        hasError = true;
        console.error(
          "Gagal mengambil titik penugasan:",
          assignmentsResult.error,
        );
        toast.error("Lokasi penugasan gagal dimuat.");
      } else {
        const rows =
          (assignmentsResult.data as
            | AssignmentDatabaseRow[]
            | null) ?? [];

        const normalizedAssignments = rows
          .map((assignment): MapAssignmentPoint | null => {
            const latitude = Number(
              assignment.latitude_klien,
            );
            const longitude = Number(
              assignment.longitude_klien,
            );

            if (
              !Number.isFinite(latitude) ||
              !Number.isFinite(longitude) ||
              (latitude === 0 && longitude === 0)
            ) {
              return null;
            }

            return {
              id: assignment.id_tugas,
              technicianName: getTechnicianName(
                assignment.teknisi,
              ),
              clientName: assignment.nama_klien,
              clientAddress: assignment.alamat_klien,
              latitude,
              longitude,
              status: assignment.status ?? "Pending",
            };
          })
          .filter(
            (
              assignment,
            ): assignment is MapAssignmentPoint =>
              assignment !== null,
          );

        setAssignments(normalizedAssignments);
      }

      if (attendanceResult.error) {
        hasError = true;
        console.error(
          "Gagal mengambil titik presensi:",
          attendanceResult.error,
        );
        toast.error("Lokasi presensi hari ini gagal dimuat.");
      } else {
        const rows =
          (attendanceResult.data as
            | AttendanceDatabaseRow[]
            | null) ?? [];

        const normalizedAttendance = rows
          .map((attendance): AttendanceMapPoint | null => {
            const latitude = Number(
              attendance.latitude_aktual,
            );
            const longitude = Number(
              attendance.longitude_aktual,
            );

            if (
              !Number.isFinite(latitude) ||
              !Number.isFinite(longitude) ||
              (latitude === 0 && longitude === 0)
            ) {
              return null;
            }

            return {
              id: attendance.id_absen,
              technicianName: getTechnicianName(
                attendance.teknisi,
              ),
              latitude,
              longitude,
              isValid: Boolean(attendance.is_valid),
              type: normalizeLogType(
                attendance.tipe_log ?? "Presensi",
              ),
              loggedAt: attendance.waktu_log,
            };
          })
          .filter(
            (
              attendance,
            ): attendance is AttendanceMapPoint =>
              attendance !== null,
          );

        setAttendancePoints(normalizedAttendance);
      }

      if (!hasError) {
        setLastUpdated(new Date());
      }

      setIsFetching(false);
    },
    [],
  );

  useEffect(() => {
    void fetchMapData();

    const scheduleRefresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = setTimeout(() => {
        void fetchMapData(false);
      }, 400);
    };

    const channel = supabase
      .channel("admin-spatial-monitoring")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tiket_tugas",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "log_presensi",
        },
        scheduleRefresh,
      )
      .subscribe((status) => {
        setRealtimeStatus(status as RealtimeStatus);
      });

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [fetchMapData]);

  const summary = useMemo(() => {
    const activeAssignments = assignments.filter(
      (assignment) => assignment.status !== "Success",
    ).length;

    const completedAssignments = assignments.filter(
      (assignment) => assignment.status === "Success",
    ).length;

    const validAttendance = attendancePoints.filter(
      (attendance) => attendance.isValid,
    ).length;

    return {
      activeAssignments,
      completedAssignments,
      validAttendance,
    };
  }, [assignments, attendancePoints]);

  const handleToggleLayer = (layer: MapLayerKey) => {
    setVisibility((current) => ({
      ...current,
      [layer]: !current[layer],
    }));
  };

  const isRealtimeConnected =
    realtimeStatus === "SUBSCRIBED";

  return (
    <div className="page-container space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <MapPinned className="size-4" aria-hidden="true" />
            Monitoring spasial
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Pemetaan dan geofencing
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Pantau titik penugasan dan posisi teknisi ketika
            melakukan presensi di wilayah operasional Pontianak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={
              isRealtimeConnected
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
            }
          >
            <span
              className={
                isRealtimeConnected
                  ? "size-1.5 rounded-full bg-emerald-500"
                  : "size-1.5 rounded-full bg-amber-500"
              }
              aria-hidden="true"
            />
            {isRealtimeConnected
              ? "Realtime terhubung"
              : "Menghubungkan realtime"}
          </Badge>

          <Button
            type="button"
            variant="outline"
            onClick={() => void fetchMapData()}
            disabled={isFetching}
          >
            <RefreshCw
              className={
                isFetching
                  ? "size-4 animate-spin"
                  : "size-4"
              }
              aria-hidden="true"
            />
            Perbarui
          </Button>
        </div>
      </div>

      <MapSummary
        totalAssignments={assignments.length}
        activeAssignments={summary.activeAssignments}
        completedAssignments={summary.completedAssignments}
        validAttendance={summary.validAttendance}
      />

      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Peta operasional</CardTitle>

              <CardDescription className="mt-1">
                Radius kantor digambar berdasarkan jarak geografis
                50 meter, bukan berdasarkan ukuran visual marker.
              </CardDescription>
            </div>

            <p className="text-xs tabular-nums text-muted-foreground">
              Terakhir diperbarui:{" "}
              {formatLastUpdated(lastUpdated)} WIB
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
            <OperationsMap
              assignments={assignments}
              attendancePoints={attendancePoints}
              visibility={visibility}
            />

            <aside className="border-t border-border bg-muted/20 xl:border-l xl:border-t-0">
              <div className="border-b border-border p-4">
                <h2 className="text-sm font-semibold text-foreground">
                  Layer peta
                </h2>

                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Aktifkan atau sembunyikan kategori titik pada
                  peta.
                </p>

                <div className="mt-4">
                  <MapLegend
                    visibility={visibility}
                    counts={{
                      attendance: attendancePoints.length,
                      activeAssignments:
                        summary.activeAssignments,
                      completedAssignments:
                        summary.completedAssignments,
                    }}
                    onToggle={handleToggleLayer}
                  />
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Aktivitas terbaru
                    </h2>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Presensi hari ini
                    </p>
                  </div>

                  <Activity
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {isFetching ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={index}
                        className="rounded-md border border-border bg-background p-3"
                      >
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="mt-2 h-3 w-24" />
                      </div>
                    ))
                  ) : attendancePoints.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-5 text-center">
                      <Clock3
                        className="mx-auto size-6 text-muted-foreground"
                        aria-hidden="true"
                      />

                      <p className="mt-2 text-sm font-medium text-foreground">
                        Belum ada presensi
                      </p>

                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Titik presensi hari ini akan muncul secara
                        otomatis.
                      </p>
                    </div>
                  ) : (
                    attendancePoints
                      .slice(0, 8)
                      .map((attendance) => (
                        <div
                          key={attendance.id}
                          className="rounded-md border border-border bg-background p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {attendance.technicianName}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                {attendance.type} ·{" "}
                                {formatTime(attendance.loggedAt)} WIB
                              </p>
                            </div>

                            {attendance.isValid ? (
                              <CheckCircle2
                                className="size-4 shrink-0 text-emerald-600"
                                aria-label="Presensi valid"
                              />
                            ) : (
                              <ShieldAlert
                                className="size-4 shrink-0 text-destructive"
                                aria-label="Di luar radius"
                              />
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>

                {isFetching ? (
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircle
                      className="size-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    Menyinkronkan data peta...
                  </div>
                ) : null}
              </div>
            </aside>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}