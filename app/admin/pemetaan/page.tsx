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
  type LiveTechnicianPoint,
  type MapAssignmentPoint,
  type TrackingRoutePath,
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
  id_teknisi: string;
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

interface LiveLocationDatabaseRow {
  technician_id: string;
  assignment_id: string;
  tracking_session_id: string;
  latitude: number | string;
  longitude: number | string;
  accuracy_meters: number | string;
  speed_mps: number | string | null;
  bearing_degrees: number | string | null;
  is_mock: boolean | null;
  recorded_at: string;
  received_at: string;
  updated_at: string;
}

interface TrackingSessionDatabaseRow {
  id_session: string;
  assignment_id: string;
  technician_id: string;
  status: string;
  started_at: string;
  last_location_at: string | null;
}

interface TrackingHistoryDatabaseRow {
  tracking_session_id: string;
  longitude: number | string;
  latitude: number | string;
  recorded_at: string;
}

interface MobileConfigDatabaseRow {
  tracking_stale_after_ms: number | string | null;
}

interface TrackingSessionView {
  sessionId: string;
  assignmentId: string;
  technicianName: string;
  clientName: string;
  startedAt: string;
  lastLocationAt: string | null;
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
  liveTechnicians: true,
};

const DEFAULT_TRACKING_STALE_AFTER_MS = 120_000;
const FALLBACK_REFRESH_INTERVAL_MS = 30_000;
const MAX_TRACKING_HISTORY_ROWS = 2_000;

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

function normalizePositiveNumber(
  value: number | string | null,
  fallback: number,
) {
  const normalized = Number(value);

  return Number.isFinite(normalized) && normalized > 0
    ? normalized
    : fallback;
}

function getLiveStatus(
  location: LiveTechnicianPoint | undefined,
) {
  if (!location) {
    return {
      label: "Menunggu GPS",
      className:
        "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300",
    };
  }

  if (location.isMock) {
    return {
      label: "Mock location",
      className:
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    };
  }

  if (location.isStale) {
    return {
      label: "Terlambat",
      className:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
    };
  }

  return {
    label: "Live",
    className:
      "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300",
  };
}

export default function SpatialMappingPage() {
  const [assignments, setAssignments] = useState<
    MapAssignmentPoint[]
  >([]);
  const [attendancePoints, setAttendancePoints] = useState<
    AttendanceMapPoint[]
  >([]);
  const [liveTechnicians, setLiveTechnicians] = useState<
    LiveTechnicianPoint[]
  >([]);
  const [trackingSessions, setTrackingSessions] = useState<
    TrackingSessionView[]
  >([]);
  const [trackingPaths, setTrackingPaths] = useState<
    TrackingRoutePath[]
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

      const [
        assignmentsResult,
        attendanceResult,
        liveLocationsResult,
        trackingSessionsResult,
        configResult,
      ] = await Promise.all([
        supabase
          .from("tiket_tugas")
          .select(
            `
              id_tugas,
              id_teknisi,
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
        supabase
          .from("technician_live_locations")
          .select(
            `
              technician_id,
              assignment_id,
              tracking_session_id,
              latitude,
              longitude,
              accuracy_meters,
              speed_mps,
              bearing_degrees,
              is_mock,
              recorded_at,
              received_at,
              updated_at
            `,
          )
          .order("received_at", { ascending: false }),
        supabase
          .from("assignment_tracking_sessions")
          .select(
            `
              id_session,
              assignment_id,
              technician_id,
              status,
              started_at,
              last_location_at
            `,
          )
          .eq("status", "ACTIVE")
          .order("started_at", { ascending: false }),
        supabase
          .from("bti_mobile_config")
          .select("tracking_stale_after_ms")
          .eq("id", 1)
          .limit(1),
      ]);

      let hasError = false;

      const baseErrors = [
        assignmentsResult.error,
        attendanceResult.error,
        liveLocationsResult.error,
        trackingSessionsResult.error,
        configResult.error,
      ].flatMap((error) => (error ? [error] : []));

      if (baseErrors.length > 0) {
        hasError = true;
        console.error(
          "Pemetaan query errors:",
          baseErrors.map((error) => error.message),
        );

        if (showLoading) {
          toast.error(
            "Sebagian data pemetaan gagal dimuat.",
            {
              description:
                "Periksa koneksi dan izin database, lalu coba kembali.",
            },
          );
        }
      }

      const assignmentRows =
        (assignmentsResult.data as
          | AssignmentDatabaseRow[]
          | null) ?? [];

      const assignmentById = new Map(
        assignmentRows.map((assignment) => [
          String(assignment.id_tugas),
          assignment,
        ]),
      );

      const normalizedAssignments = assignmentRows
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
            id: String(assignment.id_tugas),
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

      const attendanceRows =
        (attendanceResult.data as
          | AttendanceDatabaseRow[]
          | null) ?? [];

      const normalizedAttendance = attendanceRows
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
            id: String(attendance.id_absen),
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

      const configRows =
        (configResult.data as
          | MobileConfigDatabaseRow[]
          | null) ?? [];

      const staleAfterMs = normalizePositiveNumber(
        configRows[0]?.tracking_stale_after_ms ?? null,
        DEFAULT_TRACKING_STALE_AFTER_MS,
      );

      const liveRows =
        (liveLocationsResult.data as
          | LiveLocationDatabaseRow[]
          | null) ?? [];

      const normalizedLiveLocations = liveRows
        .map(
          (
            location,
          ): LiveTechnicianPoint | null => {
            const latitude = Number(location.latitude);
            const longitude = Number(location.longitude);
            const accuracyMeters = Number(
              location.accuracy_meters,
            );

            if (
              !Number.isFinite(latitude) ||
              !Number.isFinite(longitude) ||
              !Number.isFinite(accuracyMeters) ||
              accuracyMeters <= 0 ||
              (latitude === 0 && longitude === 0)
            ) {
              return null;
            }

            const assignment = assignmentById.get(
              String(location.assignment_id),
            );

            const receivedAt =
              location.received_at ||
              location.updated_at ||
              location.recorded_at;

            const receivedTime = new Date(
              receivedAt,
            ).getTime();

            const ageMs = Number.isNaN(receivedTime)
              ? Number.POSITIVE_INFINITY
              : Math.max(0, Date.now() - receivedTime);

            const speed = Number(location.speed_mps);
            const bearing = Number(
              location.bearing_degrees,
            );

            return {
              technicianId: String(
                location.technician_id,
              ),
              assignmentId: String(
                location.assignment_id,
              ),
              sessionId: String(
                location.tracking_session_id,
              ),
              technicianName: assignment
                ? getTechnicianName(assignment.teknisi)
                : "Teknisi tidak tersedia",
              clientName:
                assignment?.nama_klien ??
                "Tugas tidak tersedia",
              latitude,
              longitude,
              accuracyMeters,
              speedMps:
                location.speed_mps !== null &&
                Number.isFinite(speed)
                  ? Math.max(0, speed)
                  : null,
              bearingDegrees:
                location.bearing_degrees !== null &&
                Number.isFinite(bearing)
                  ? bearing
                  : null,
              isMock: Boolean(location.is_mock),
              isStale: ageMs > staleAfterMs,
              recordedAt: location.recorded_at,
              receivedAt,
            };
          },
        )
        .filter(
          (
            location,
          ): location is LiveTechnicianPoint =>
            location !== null,
        );

      const sessionRows =
        (trackingSessionsResult.data as
          | TrackingSessionDatabaseRow[]
          | null) ?? [];

      const normalizedSessions = sessionRows.map(
        (session): TrackingSessionView => {
          const assignment = assignmentById.get(
            String(session.assignment_id),
          );

          return {
            sessionId: String(session.id_session),
            assignmentId: String(
              session.assignment_id,
            ),
            technicianName: assignment
              ? getTechnicianName(assignment.teknisi)
              : "Teknisi tidak tersedia",
            clientName:
              assignment?.nama_klien ??
              "Tugas tidak tersedia",
            startedAt: session.started_at,
            lastLocationAt: session.last_location_at,
          };
        },
      );

      let historyRows: TrackingHistoryDatabaseRow[] = [];

      if (
        !trackingSessionsResult.error &&
        sessionRows.length > 0
      ) {
        const sessionIds = sessionRows.map((session) =>
          String(session.id_session),
        );

        const historyResult = await supabase
          .from("technician_location_history")
          .select(
            `
              tracking_session_id,
              longitude,
              latitude,
              recorded_at
            `,
          )
          .in("tracking_session_id", sessionIds)
          .order("recorded_at", { ascending: false })
          .limit(MAX_TRACKING_HISTORY_ROWS);

        if (historyResult.error) {
          hasError = true;
          console.error(
            "Gagal mengambil riwayat tracking:",
            historyResult.error,
          );
        } else {
          historyRows =
            (historyResult.data as
              | TrackingHistoryDatabaseRow[]
              | null) ?? [];
        }
      }

      const coordinatesBySession = new Map<
        string,
        Array<[number, number]>
      >();

      historyRows
        .slice()
        .reverse()
        .forEach((history) => {
          const latitude = Number(history.latitude);
          const longitude = Number(history.longitude);

          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            (latitude === 0 && longitude === 0)
          ) {
            return;
          }

          const sessionId = String(
            history.tracking_session_id,
          );

          const coordinates =
            coordinatesBySession.get(sessionId) ?? [];

          coordinates.push([longitude, latitude]);
          coordinatesBySession.set(
            sessionId,
            coordinates,
          );
        });

      normalizedLiveLocations.forEach((location) => {
        const coordinates =
          coordinatesBySession.get(location.sessionId) ?? [];

        const lastCoordinate =
          coordinates[coordinates.length - 1];

        if (
          !lastCoordinate ||
          lastCoordinate[0] !== location.longitude ||
          lastCoordinate[1] !== location.latitude
        ) {
          coordinates.push([
            location.longitude,
            location.latitude,
          ]);
        }

        coordinatesBySession.set(
          location.sessionId,
          coordinates,
        );
      });

      const normalizedPaths: TrackingRoutePath[] =
        Array.from(coordinatesBySession.entries())
          .filter(([, coordinates]) => coordinates.length >= 2)
          .map(([sessionId, coordinates]) => ({
            sessionId,
            coordinates,
          }));

      setAssignments(normalizedAssignments);
      setAttendancePoints(normalizedAttendance);
      setLiveTechnicians(normalizedLiveLocations);
      setTrackingSessions(normalizedSessions);
      setTrackingPaths(normalizedPaths);

      if (!hasError) {
        setLastUpdated(new Date());
      }

      setIsFetching(false);
    },
    [],
  );

  useEffect(() => {
    void fetchMapData();

    const fallbackRefreshInterval = window.setInterval(
      () => {
        void fetchMapData(false);
      },
      FALLBACK_REFRESH_INTERVAL_MS,
    );

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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "technician_live_locations",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assignment_tracking_sessions",
        },
        scheduleRefresh,
      )
      .subscribe((status) => {
        setRealtimeStatus(status as RealtimeStatus);
      });

    return () => {
      window.clearInterval(
        fallbackRefreshInterval,
      );

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

    const liveTracking = liveTechnicians.filter(
      (technician) =>
        !technician.isStale && !technician.isMock,
    ).length;

    const trackingWarnings = liveTechnicians.filter(
      (technician) =>
        technician.isStale || technician.isMock,
    ).length;

    return {
      activeAssignments,
      completedAssignments,
      validAttendance,
      liveTracking,
      trackingWarnings,
    };
  }, [
    assignments,
    attendancePoints,
    liveTechnicians,
  ]);

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
            Pantau penugasan, presensi, posisi terkini teknisi,
            dan jejak perjalanan secara realtime.
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
              liveTechnicians={liveTechnicians}
              trackingPaths={trackingPaths}
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
                      liveTechnicians:
                        liveTechnicians.length,
                    }}
                    onToggle={handleToggleLayer}
                  />
                </div>
              </div>

              <div className="border-b border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Pelacakan aktif
                    </h2>

                    <p className="mt-1 text-xs text-muted-foreground">
                      Posisi terakhir teknisi lapangan
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className="border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-300"
                    >
                      {summary.liveTracking} live
                    </Badge>

                    {summary.trackingWarnings > 0 ? (
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                      >
                        {summary.trackingWarnings} perhatian
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {isFetching ? (
                    Array.from({ length: 3 }).map((_, index) => (
                      <div
                        key={index}
                        className="rounded-md border border-border bg-background p-3"
                      >
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="mt-2 h-3 w-24" />
                      </div>
                    ))
                  ) : trackingSessions.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-5 text-center">
                      <MapPinned
                        className="mx-auto size-6 text-muted-foreground"
                        aria-hidden="true"
                      />

                      <p className="mt-2 text-sm font-medium text-foreground">
                        Tidak ada tracking aktif
                      </p>

                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Sesi akan muncul setelah teknisi memulai
                        pengerjaan.
                      </p>
                    </div>
                  ) : (
                    trackingSessions.map((session) => {
                      const location = liveTechnicians.find(
                        (item) =>
                          item.sessionId === session.sessionId,
                      );

                      const status = getLiveStatus(location);

                      return (
                        <div
                          key={session.sessionId}
                          className="rounded-md border border-border bg-background p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {session.technicianName}
                              </p>

                              <p className="mt-1 truncate text-xs text-muted-foreground">
                                {session.clientName}
                              </p>
                            </div>

                            <Badge
                              variant="outline"
                              className={status.className}
                            >
                              {status.label}
                            </Badge>
                          </div>

                          <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
                            {location
                              ? `Diterima ${formatTime(
                                  location.receivedAt,
                                )} WIB · ±${Math.round(
                                  location.accuracyMeters,
                                )} m`
                              : "Belum ada koordinat yang diterima"}
                          </p>
                        </div>
                      );
                    })
                  )}
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
