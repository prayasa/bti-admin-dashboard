"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { TechnicianList } from "@/components/presensi/technician-list";
import { DeleteAttendanceDialog } from "@/components/presensi/delete-attendance-dialog";
import { DeleteAllAttendanceDialog } from "@/components/presensi/delete-all-attendance-dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { supabase } from "@/src/utils/supabase";

import {
  dailyRecap,
  dateKey,
  downloadAttendanceReport,
  formatTime,
  getPeriod,
  readAll,
  shiftMonth,
  type Attendance,
  type AttendanceAudit,
  type FilterMode,
  type Period,
  type Technician,
} from "@/lib/presensi-report";

const PAGE_SIZE = 25;

const selectClass =
  "h-9 rounded-md border bg-background px-3 text-sm";

type LoadedData = {
  technicians: Technician[];
  logs: Attendance[];
  audits: AttendanceAudit[];
};

async function loadData(
  period: Period,
  signal: AbortSignal,
): Promise<LoadedData> {
  const [technicians, logs, audits] =
    await Promise.all([
      readAll<Technician>((from, to) =>
        supabase
          .from("teknisi")
          .select("id,nama_lengkap,nik", {
            count: "exact",
          })
          .order("id")
          .range(from, to)
          .abortSignal(signal),
      ),

      readAll<Attendance>((from, to) =>
        supabase
          .from("log_presensi")
          .select(
            "id_absen,id_teknisi,waktu_log,tipe_log,latitude_aktual,longitude_aktual,is_valid",
            {
              count: "exact",
            },
          )
          .gte("waktu_log", period.start)
          .lt("waktu_log", period.end)
          .order("waktu_log", {
            ascending: false,
          })
          .order("id_absen")
          .range(from, to)
          .abortSignal(signal),
      ),

      readAll<AttendanceAudit>((from, to) =>
        supabase
          .from("presensi_audit")
          .select(
            "id_audit,technician_id,attendance_type,latitude,longitude,accuracy_meters,location_age_ms,distance_meters,is_mock,result,reason,created_at",
            {
              count: "exact",
            },
          )
          .eq("result", "REJECTED")
          .gte("created_at", period.start)
          .lt("created_at", period.end)
          .order("created_at", {
            ascending: false,
          })
          .order("id_audit")
          .range(from, to)
          .abortSignal(signal),
      ),
    ]);

  technicians.sort((a, b) =>
    a.nama_lengkap.localeCompare(
      b.nama_lengkap,
      "id",
    ),
  );

  return {
    technicians,
    logs,
    audits,
  };
}

function message(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error &&
    "message" in error
  ) {
    return String(error.message);
  }

  return "Terjadi kesalahan. Silakan coba kembali.";
}

function mapLink(
  latitude: number | null,
  longitude: number | null,
) {
  if (
    latitude === null ||
    longitude === null
  ) {
    return "—";
  }

  return (
    <a
      className="text-primary underline"
      target="_blank"
      rel="noopener noreferrer"
      href={`https://www.google.com/maps?q=${latitude},${longitude}`}
    >
      {latitude.toFixed(5)},{" "}
      {longitude.toFixed(5)}
    </a>
  );
}

export default function AdminPresensiPage() {
  const [mode, setMode] =
    useState<FilterMode>("bulan");

  const [month, setMonth] = useState(() =>
    dateKey().slice(0, 7),
  );

  const [today, setToday] = useState(() =>
    dateKey(),
  );

  const [data, setData] = useState<LoadedData>({
    technicians: [],
    logs: [],
    audits: [],
  });

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [scope, setScope] = useState("semua");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  const [exporting, setExporting] =
    useState(false);

  const [deleting, setDeleting] =
    useState(false);

  const [deleteTarget, setDeleteTarget] =
    useState<Attendance | null>(null);

  const [deleteAllOpen, setDeleteAllOpen] =
    useState(false);

  const exportController =
    useRef<AbortController | null>(null);

  const exportBusy = useRef(false);
  const deleteBusy = useRef(false);

  const period = useMemo(
    () =>
      getPeriod(
        mode,
        month,
        new Date(`${today}T12:00:00+07:00`),
      ),
    [mode, month, today],
  );

  const refresh = useCallback(() => {
    setReload((value) => value + 1);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setToday(dateKey());
    }, 60_000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError("");

    void loadData(period, controller.signal)
      .then((result) => {
        if (!active) {
          return;
        }

        setData(result);

        setSelectedId((current) => {
          const stillExists =
            result.technicians.some(
              (person) =>
                String(person.id) === current,
            );

          if (stillExists) {
            return current;
          }

          return result.technicians[0]
            ? String(
                result.technicians[0].id,
              )
            : null;
        });
      })
      .catch((cause: unknown) => {
        if (!active) {
          return;
        }

        console.error(
          "Gagal memuat histori presensi:",
          cause,
        );

        setData({
          technicians: [],
          logs: [],
          audits: [],
        });

        setError(message(cause));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [period, reload]);

  useEffect(() => {
    let timer:
      | ReturnType<typeof setTimeout>
      | undefined;

    const schedule = () => {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(refresh, 500);
    };

    const channel = supabase
      .channel("admin-presensi-history")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "log_presensi",
        },
        schedule,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "presensi_audit",
        },
        schedule,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teknisi",
        },
        schedule,
      )
      .subscribe();

    return () => {
      if (timer) {
        clearTimeout(timer);
      }

      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  useEffect(() => {
    return () => {
      exportController.current?.abort();
    };
  }, []);

  useEffect(() => {
    setPage(1);
    setAuditPage(1);
  }, [selectedId, period]);

  const selected = data.technicians.find(
    (person) =>
      String(person.id) === selectedId,
  );

  const logs = useMemo(
    () =>
      data.logs.filter(
        (log) =>
          String(log.id_teknisi) ===
          selectedId,
      ),
    [data.logs, selectedId],
  );

  const audits = useMemo(
    () =>
      data.audits.filter(
        (audit) =>
          String(audit.technician_id) ===
          selectedId,
      ),
    [data.audits, selectedId],
  );

  const days = useMemo(
    () => dailyRecap(logs),
    [logs],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(logs.length / PAGE_SIZE),
  );

  const totalAuditPages = Math.max(
    1,
    Math.ceil(audits.length / PAGE_SIZE),
  );

  const currentPage = Math.min(
    page,
    totalPages,
  );

  const currentAuditPage = Math.min(
    auditPage,
    totalAuditPages,
  );

  const visibleLogs = logs.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const visibleAudits = audits.slice(
    (currentAuditPage - 1) * PAGE_SIZE,
    currentAuditPage * PAGE_SIZE,
  );

  const technicians = data.technicians
    .filter((person) =>
      `${person.nama_lengkap} ${person.nik ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .map((person) => ({
      ...person,
      id: String(person.id),
    }));

  function changeMonth(offset: number) {
    setMonth((current) =>
      shiftMonth(current, offset),
    );

    setMode("bulan");
  }

  async function exportExcel() {
    if (
      exportBusy.current ||
      loading ||
      deleting ||
      (scope === "dipilih" && !selectedId)
    ) {
      return;
    }

    exportBusy.current = true;
    setExporting(true);

    const controller = new AbortController();
    exportController.current = controller;

    const chosenId = selectedId;
    const chosenScope = scope;
    const chosenPeriod = period;

    try {
      // Ekspor mengambil ulang seluruh periode.
      // Halaman tabel tidak membatasi isi Excel.
      const fresh = await loadData(
        chosenPeriod,
        controller.signal,
      );

      if (controller.signal.aborted) {
        return;
      }

      const person = fresh.technicians.find(
        (item) =>
          String(item.id) === chosenId,
      );

      await downloadAttendanceReport({
        technicians:
          chosenScope === "semua"
            ? fresh.technicians
            : fresh.technicians.filter(
                (item) =>
                  String(item.id) ===
                  chosenId,
              ),

        logs:
          chosenScope === "semua"
            ? fresh.logs
            : fresh.logs.filter(
                (item) =>
                  String(item.id_teknisi) ===
                  chosenId,
              ),

        audits:
          chosenScope === "semua"
            ? fresh.audits
            : fresh.audits.filter(
                (item) =>
                  String(
                    item.technician_id,
                  ) === chosenId,
              ),

        period: chosenPeriod,

        scope:
          chosenScope === "semua"
            ? "Semua teknisi"
            : person?.nama_lengkap ??
              `Teknisi ${chosenId}`,
      });

      if (!controller.signal.aborted) {
        toast.success(
          "Rekap Excel berhasil diekspor.",
        );
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        console.error(
          "Ekspor presensi gagal:",
          cause,
        );

        toast.error(
          `Ekspor gagal: ${message(cause)}`,
        );
      }
    } finally {
      exportBusy.current = false;
      exportController.current = null;
      setExporting(false);
    }
  }

  async function deleteAttendance() {
    if (
      !deleteTarget ||
      deleteBusy.current ||
      exportBusy.current
    ) {
      return false;
    }

    deleteBusy.current = true;
    setDeleting(true);

    try {
      const result = await supabase.rpc(
        "admin_delete_attendance",
        {
          p_attendance_id: String(
            deleteTarget.id_absen,
          ),
        },
      );

      if (result.error) {
        throw result.error;
      }

      if (
        !result.data?.accepted ||
        !result.data?.success
      ) {
        throw new Error(
          result.data?.message ||
            "Penghapusan ditolak.",
        );
      }

      toast.success(
        result.data.message ||
          "Presensi dihapus.",
      );

      refresh();
      return true;
    } catch (cause) {
      toast.error(message(cause));
      return false;
    } finally {
      deleteBusy.current = false;
      setDeleting(false);
    }
  }

  async function deleteAll(
    confirmation: string,
  ) {
    if (
      deleteBusy.current ||
      exportBusy.current
    ) {
      return false;
    }

    deleteBusy.current = true;
    setDeleting(true);

    try {
      const result = await supabase.rpc(
        "admin_delete_all_attendance",
        {
          p_confirmation: confirmation,
        },
      );

      if (result.error) {
        throw result.error;
      }

      if (
        !result.data?.accepted ||
        !result.data?.success
      ) {
        throw new Error(
          result.data?.message ||
            "Penghapusan ditolak.",
        );
      }

      toast.success(
        `${result.data.deleted_count ?? 0} log presensi dihapus.`,
      );

      setDeleteTarget(null);
      refresh();

      return true;
    } catch (cause) {
      toast.error(message(cause));
      return false;
    } finally {
      deleteBusy.current = false;
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presensi & histori"
        description="Lihat histori per bulan dan unduh rekap Excel dalam waktu WIB."
        actions={
          <>
            <Button
              variant="outline"
              onClick={refresh}
              disabled={
                loading ||
                deleting ||
                exporting
              }
            >
              <RefreshCw
                className={
                  loading
                    ? "animate-spin"
                    : ""
                }
                
              />
              Muat ulang
            </Button>

            <Button
              variant="destructive"
              disabled={
                loading ||
                deleting ||
                exporting
              }
              onClick={() =>
                setDeleteAllOpen(true)
              }
            >
              <Trash2 />
              Hapus semua presensi
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            Periode histori
          </CardTitle>

          <CardDescription>
            Filter periode membatasi tampilan
            dan ekspor. Hapus semua tetap
            menghapus seluruh tanggal.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              Periode
              <select
                aria-label="Periode"
                className={`${selectClass} block`}
                value={mode}
                disabled={
                  exporting || deleting
                }
                onChange={(event) =>
                  setMode(
                    event.target
                      .value as FilterMode,
                  )
                }
              >
                <option value="bulan">
                  Bulanan / histori
                </option>
                <option value="hari">
                  Hari ini
                </option>
                <option value="minggu">
                  7 hari terakhir
                </option>
              </select>
            </label>

            <Button
              variant="outline"
              size="icon"
              aria-label="Bulan sebelumnya"
              disabled={
                exporting ||
                deleting ||
                month <= "1000-01"
              }
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft />
            </Button>

            <label className="space-y-1 text-sm">
              Bulan histori
              <Input
                className="w-44"
                type="month"
                min="1000-01"
                max={today.slice(0, 7)}
                value={month}
                disabled={
                  exporting || deleting
                }
                onChange={(event) => {
                  const value =
                    event.target.value;

                  if (
                    /^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(
                      value,
                    ) &&
                    value <=
                      today.slice(0, 7)
                  ) {
                    setMonth(value);
                    setMode("bulan");
                  }
                }}
              />
            </label>

            <Button
              variant="outline"
              size="icon"
              aria-label="Bulan berikutnya"
              disabled={
                exporting ||
                deleting ||
                month >= today.slice(0, 7)
              }
              onClick={() => changeMonth(1)}
            >
              <ChevronRight />
            </Button>

            <Badge variant="secondary">
              {period.label} · WIB
            </Badge>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="space-y-1 text-sm">
              Cakupan Excel
              <select
                className={`${selectClass} block`}
                value={scope}
                disabled={
                  exporting || deleting
                }
                onChange={(event) =>
                  setScope(
                    event.target.value,
                  )
                }
              >
                <option value="semua">
                  Semua teknisi
                </option>
                <option value="dipilih">
                  Teknisi yang dipilih
                </option>
              </select>
            </label>

            <Button
              onClick={() =>
                void exportExcel()
              }
              disabled={
                loading ||
                exporting ||
                deleting ||
                !!error ||
                (scope === "dipilih" &&
                  !selectedId)
              }
            >
              <Download />
              {exporting
                ? "Menyiapkan Excel..."
                : "Ekspor Excel (.xlsx)"}
            </Button>
          </div>

          {loading && (
            <p
              className="text-sm text-muted-foreground"
              role="status"
            >
              Memuat seluruh data periode...
            </p>
          )}

          {error && (
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              {error} Klik Muat ulang untuk
              mencoba kembali.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid items-start gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-3">
          <Input
            aria-label="Cari teknisi"
            placeholder="Cari nama atau NIK..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

          <TechnicianList
            technicians={technicians}
            selectedId={selectedId}
            isLoading={loading}
            onSelect={setSelectedId}
          />
        </div>

        <div
          className="min-w-0 space-y-6"
          aria-busy={loading}
        >
          <Card>
            <CardHeader>
              <CardTitle>
                {selected?.nama_lengkap ??
                  "Pilih teknisi"}
              </CardTitle>

              <CardDescription>
                {period.label} · NIK:{" "}
                {selected?.nik ?? "—"}
              </CardDescription>
            </CardHeader>

            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Total log", logs.length],
                [
                  "Log valid",
                  logs.filter(
                    (log) =>
                      log.is_valid === true,
                  ).length,
                ],
                [
                  "Hari lengkap",
                  days.filter(
                    (day) => day.complete,
                  ).length,
                ],
                [
                  "Percobaan ditolak",
                  audits.length,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border p-3"
                >
                  <p className="text-sm text-muted-foreground">
                    {label}
                  </p>
                  <p className="text-2xl font-semibold">
                    {loading ? "—" : value}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Log presensi
              </CardTitle>

              <CardDescription>
                Masuk dan pulang dalam periode
                terpilih. 25 baris per halaman.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">
                        Waktu WIB
                      </th>
                      <th className="p-2">
                        Jenis
                      </th>
                      <th className="p-2">
                        Validasi
                      </th>
                      <th className="p-2">
                        Lokasi
                      </th>
                      <th className="p-2">
                        Aksi
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {!loading &&
                      visibleLogs.map(
                        (log) => (
                          <tr
                            className="border-b"
                            key={String(
                              log.id_absen,
                            )}
                          >
                            <td className="whitespace-nowrap p-2">
                              {formatTime(
                                log.waktu_log,
                              )}
                            </td>

                            <td className="p-2">
                              {log.tipe_log ??
                                "—"}
                            </td>

                            <td className="p-2">
                              <Badge
                                variant={
                                  log.is_valid ===
                                  true
                                    ? "success"
                                    : log.is_valid ===
                                        false
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {log.is_valid ===
                                true
                                  ? "Valid"
                                  : log.is_valid ===
                                      false
                                    ? "Tidak valid"
                                    : "Belum diketahui"}
                              </Badge>
                            </td>

                            <td className="whitespace-nowrap p-2">
                              {mapLink(
                                log.latitude_aktual,
                                log.longitude_aktual,
                              )}
                            </td>

                            <td className="p-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Hapus presensi"
                                disabled={
                                  deleting ||
                                  exporting
                                }
                                onClick={() =>
                                  setDeleteTarget(
                                    log,
                                  )
                                }
                              >
                                <Trash2 className="text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ),
                      )}

                    {(!visibleLogs.length ||
                      loading) && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-6 text-center text-muted-foreground"
                        >
                          {loading
                            ? "Memuat..."
                            : "Tidak ada log pada periode ini."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                <span>
                  Halaman {currentPage}/
                  {totalPages} · {logs.length}{" "}
                  log
                </span>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      loading ||
                      currentPage <= 1
                    }
                    onClick={() =>
                      setPage(currentPage - 1)
                    }
                  >
                    Sebelumnya
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      loading ||
                      currentPage >= totalPages
                    }
                    onClick={() =>
                      setPage(currentPage + 1)
                    }
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Percobaan presensi ditolak
              </CardTitle>

              <CardDescription>
                Audit tetap tersimpan setelah
                log presensi dihapus.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2">
                        Waktu WIB
                      </th>
                      <th className="p-2">
                        Jenis
                      </th>
                      <th className="p-2">
                        Alasan
                      </th>
                      <th className="p-2">
                        Lokasi
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {!loading &&
                      visibleAudits.map(
                        (audit) => (
                          <tr
                            className="border-b"
                            key={String(
                              audit.id_audit,
                            )}
                          >
                            <td className="whitespace-nowrap p-2">
                              {formatTime(
                                audit.created_at,
                              )}
                            </td>

                            <td className="p-2">
                              {audit.attendance_type ??
                                "—"}
                            </td>

                            <td className="p-2">
                              {audit.reason ??
                                "—"}
                            </td>

                            <td className="whitespace-nowrap p-2">
                              {mapLink(
                                audit.latitude,
                                audit.longitude,
                              )}
                            </td>
                          </tr>
                        ),
                      )}

                    {(!visibleAudits.length ||
                      loading) && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-6 text-center text-muted-foreground"
                        >
                          {loading
                            ? "Memuat..."
                            : "Tidak ada percobaan ditolak pada periode ini."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 text-sm">
                <span>
                  Halaman {currentAuditPage}/
                  {totalAuditPages} ·{" "}
                  {audits.length} audit
                </span>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      loading ||
                      currentAuditPage <= 1
                    }
                    onClick={() =>
                      setAuditPage(
                        currentAuditPage - 1,
                      )
                    }
                  >
                    Sebelumnya
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      loading ||
                      currentAuditPage >=
                        totalAuditPages
                    }
                    onClick={() =>
                      setAuditPage(
                        currentAuditPage + 1,
                      )
                    }
                  >
                    Berikutnya
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <DeleteAttendanceDialog
        open={!!deleteTarget}
        technicianName={
          selected?.nama_lengkap ?? "Teknisi"
        }
        attendanceTime={formatTime(
          deleteTarget?.waktu_log ?? null,
        )}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        onConfirm={deleteAttendance}
      />

      <DeleteAllAttendanceDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        onConfirm={deleteAll}
      />
    </div>
  );
}
