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
  CalendarDays, CalendarOff, CheckCircle2, ClipboardList, Users,
  Search, X, ArrowUpRight, AlertCircle, LoaderCircle, FileSpreadsheet,
} from "lucide-react";

import { toast } from "sonner";

import { DeleteAttendanceDialog } from "@/components/presensi/delete-attendance-dialog";
import { ReportHolidays } from "@/components/presensi/report-holidays";
import { DeleteAllAttendanceDialog } from "@/components/presensi/delete-all-attendance-dialog";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildReport } from "@/lib/presensi-workbook";

import { Input } from "@/components/ui/input";
import { supabase } from "@/src/utils/supabase";

import {
  dateKey,
  downloadAttendanceReport,
  formatTime,
  formatDay,
  getPeriod,
  readAll,
  shiftMonth,
  shiftWeek,
  parseDay,
  periodDays,
  type Attendance,
  type AttendanceAudit,
  type FilterMode,
  type Period,
  type ReportHoliday,
  type Technician,
} from "@/lib/presensi-report";

const PAGE_SIZE = 25;

const selectClass =
  "h-9 rounded-md border bg-background px-3 text-sm";

type LoadedData = {
  technicians: Technician[];
  logs: Attendance[];
  audits: AttendanceAudit[];
  holidays: ReportHoliday[];
};

async function loadData(
  period: Period,
  signal: AbortSignal,
): Promise<LoadedData> {
  const [technicians, logs, audits, holidays] =
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
        signal,
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
        signal,
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
        signal,
      ),
      readAll<ReportHoliday>((from, to) =>
        supabase
          .from("bti_report_holidays")
          .select("day,name,updated_at", { count: "exact" })
          .gte("day", periodDays(period)[0])
          .lte("day", periodDays(period).at(-1)!)
          .order("day")
          .range(from, to)
          .abortSignal(signal),
        signal,
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
    holidays,
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
      Lihat peta
    </a>
  );
}

export default function AdminPresensiPage() {
  const [mode, setMode] =
    useState<FilterMode>("minggu");

  const [weekAnchor, setWeekAnchor] = useState(() => dateKey());
  const [holidayBusy, setHolidayBusy] = useState(false);
  const [holidayDirty, setHolidayDirty] = useState(false);
  const [workEnd, setWorkEnd] = useState("17:00");
  const [clock, setClock] = useState(() => new Date());
  const [view, setView] = useState<"ringkasan" | "log" | "audit">("ringkasan");
  const [summaryPage, setSummaryPage] = useState(1);
  const [summaryFilter, setSummaryFilter] = useState("semua");
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

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
    holidays: [],
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
        weekAnchor,
      ),
    [mode, month, today, weekAnchor],
  );

  const refresh = useCallback(() => {
    setReload((value) => value + 1);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setToday(dateKey());
      setClock(new Date());
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

          return null;
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
          holidays: [],
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
          selectedId === null || String(log.id_teknisi) === selectedId,
      ),
    [data.logs, selectedId],
  );

  const audits = useMemo(
    () =>
      data.audits.filter(
        (audit) =>
          selectedId === null || String(audit.technician_id) === selectedId,
      ),
    [data.audits, selectedId],
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

  function changeMonth(offset: number) {
    setMonth((current) =>
      shiftMonth(current, offset),
    );

    setMode("bulan");
    setHolidayDirty(false);
  }

  async function exportExcel() {
    if (
      exportBusy.current ||
      loading ||
      deleting ||
      holidayBusy ||
      holidayDirty ||
      !!error ||
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
    const chosenWorkEnd = workEnd;

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
        holidays: fresh.holidays,
        workEnd: chosenWorkEnd,

        scope:
          chosenScope === "semua"
            ? "Semua teknisi"
            : person?.nama_lengkap ??
              `Teknisi ${chosenId}`,
      });

      if (!controller.signal.aborted) {
        setExportOpen(false);
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

  const busy = loading || exporting || deleting || holidayBusy;
  const report = useMemo(() => buildReport({
    technicians: data.technicians, logs: data.logs, audits: data.audits,
    holidays: data.holidays, period, scope: "Semua teknisi", workEnd, now: clock,
  }), [data, period, workEnd, clock]);
  const people = useMemo(() => new Map(report.summaries.map((row) => [String(row.person.id), row.person])), [report]);
  const scopedSummaries = report.summaries.filter((row) => !selectedId || String(row.person.id) === selectedId);
  const filteredSummaries = scopedSummaries.filter((row) => {
    const match = `${row.person.nama_lengkap} ${row.person.nik ?? ""}`.toLocaleLowerCase("id").includes(search.toLocaleLowerCase("id"));
    return match && (summaryFilter === "semua" || summaryFilter === "hadir" && row.attendance > 0 || summaryFilter === "belum" && row.attendance === 0 || summaryFilter === "sebagian" && row.partial > 0);
  });
  const summaryPages = Math.max(1, Math.ceil(filteredSummaries.length / PAGE_SIZE));
  const activeSummaryPage = Math.min(summaryPage, summaryPages);
  const visibleSummaries = filteredSummaries.slice((activeSummaryPage - 1) * PAGE_SIZE, activeSummaryPage * PAGE_SIZE);
  const dailyRows = report.daily.filter((row) => String(row.person.id) === selectedId);
  const totals = {
    attendance: scopedSummaries.reduce((sum, row) => sum + row.attendance, 0),
    partial: scopedSummaries.reduce((sum, row) => sum + row.partial, 0),
    holidays: report.schedule.filter((day) => day.holiday).length,
  };
  const previousDisabled = busy || mode === "hari" || (mode === "bulan" ? month <= "1000-01" : shiftWeek(dateKey(period.start), -1) < "1000-01-08");
  const nextDisabled = busy || mode === "hari" || (mode === "bulan" ? month >= today.slice(0, 7) : shiftWeek(dateKey(period.start), 1) > today);

  function changePeriod(offset: number) {
    if (mode === "bulan") changeMonth(offset);
    if (mode === "minggu") setWeekAnchor(shiftWeek(dateKey(period.start), offset));
  }
  function returnCurrent() {
    setMonth(today.slice(0, 7));
    setWeekAnchor(today);
  }
  function chooseTechnician(id: string | null) {
    setSelectedId(id);
    if (id === null) setScope("semua");
    setSummaryPage(1);
    setPage(1);
    setAuditPage(1);
  }
  const statusLabels: Record<string, string> = {
    H: "Hadir", P: "Belum lengkap", TC: "Tidak tercatat", L: "Libur",
    LH: "Hadir · libur", LP: "Belum lengkap · libur", "V?": "Perlu ditinjau", PR: "Hari berjalan", "—": "Belum berlangsung",
  };
  function attendanceStatus(code: string) {
    const colors = code === "H" || code === "LH" ? "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900" : code === "P" || code === "LP" || code === "V?" ? "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900" : "bg-muted/70 text-muted-foreground ring-border";
    return <span className={`inline-flex max-w-full rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${colors}`}>{statusLabels[code] ?? code}</span>;
  }
  function pager(current: number, count: number, length: number, onChange: (page: number) => void) {
    return <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-sm">
      <span className="text-muted-foreground">{length === 0 ? "0 data" : `${(current - 1) * PAGE_SIZE + 1}–${Math.min(current * PAGE_SIZE, length)} dari ${length} data`}</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={loading || current <= 1} onClick={() => onChange(current - 1)} aria-label="Halaman sebelumnya"><ChevronLeft className="size-4" /></Button>
        <span className="min-w-16 text-center tabular-nums">{current} / {count}</span>
        <Button variant="outline" size="sm" disabled={loading || current >= count} onClick={() => onChange(current + 1)} aria-label="Halaman berikutnya"><ChevronRight className="size-4" /></Button>
      </div>
    </div>;
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-blue-600 dark:text-blue-400"><CalendarDays className="size-4" /> Kehadiran tim</div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Presensi & Histori</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pantau kehadiran, lihat riwayat, dan siapkan laporan kantor.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={refresh}><RefreshCw className={loading ? "animate-spin" : ""} />Muat ulang</Button>
          <Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={busy || !!error} onClick={() => setExportOpen(true)}><Download />Ekspor laporan</Button>
        </div>
      </div>

      <section className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5" aria-label="Filter periode kehadiran">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex rounded-xl bg-muted/70 p-1" role="group" aria-label="Jenis periode">
            {([['hari', 'Hari ini'], ['minggu', 'Mingguan'], ['bulan', 'Bulanan']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} disabled={busy} onClick={() => { setMode(value); setSummaryPage(1); }} className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 ${mode === value ? "bg-background text-blue-600 shadow-sm dark:text-blue-400" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mode !== "hari" && <>
              <Button variant="outline" size="icon" disabled={previousDisabled} onClick={() => changePeriod(-1)} aria-label="Periode sebelumnya"><ChevronLeft /></Button>
              {mode === "minggu" ? <Input aria-label="Pilih tanggal dalam minggu" title="Pilih tanggal; periode otomatis Senin–Sabtu" type="date" className="w-40" min="1000-01-08" max={today} value={weekAnchor} disabled={busy} onChange={(event) => {
                const value = event.target.value;
                try { parseDay(value); if (value >= "1000-01-08" && value <= today) { setWeekAnchor(value); setSummaryPage(1); } } catch { /* Tanggal masih diketik. */ }
              }} /> : <Input aria-label="Pilih bulan histori" type="month" className="w-44" min="1000-01" max={today.slice(0, 7)} value={month} disabled={busy} onChange={(event) => {
                const value = event.target.value;
                if (/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(value) && value <= today.slice(0, 7)) { setMonth(value); setSummaryPage(1); }
              }} />}
              <Button variant="outline" size="icon" disabled={nextDisabled} onClick={() => changePeriod(1)} aria-label="Periode berikutnya"><ChevronRight /></Button>
              <Button variant="ghost" size="sm" disabled={busy} onClick={returnCurrent}>{mode === "minggu" ? "Minggu ini" : "Bulan ini"}</Button>
            </>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950/50"><CalendarDays className="size-5" /></div><div><p className="font-semibold">{period.label}</p><p className="text-xs text-muted-foreground">{mode === "minggu" ? "Periode kerja Senin–Sabtu" : mode === "bulan" ? "Histori satu bulan" : "Presensi hari ini"} · WIB</p></div></div>
          <Button variant="outline" size="sm" disabled={busy || !!error} onClick={() => setHolidayOpen(true)}><CalendarOff className="size-4" />Atur hari libur{data.holidays.length > 0 && <span className="ml-1 rounded bg-blue-50 px-1.5 text-blue-700 dark:bg-blue-950 dark:text-blue-300">{data.holidays.length}</span>}</Button>
        </div>
      </section>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><span className="flex items-center gap-2"><AlertCircle className="size-5 shrink-0" />{error}</span><Button variant="outline" size="sm" onClick={refresh} disabled={busy}>Coba lagi</Button></div>}
      {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Memuat kehadiran...</p>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: selectedId ? "Teknisi dipilih" : "Teknisi dalam periode", value: scopedSummaries.length, detail: selected?.nama_lengkap ?? "Semua teknisi", icon: Users },
          { label: "Total kehadiran", value: totals.attendance, detail: "Hari dengan presensi valid", icon: CheckCircle2 },
          { label: "Perlu dilengkapi", value: totals.partial, detail: "Masuk / pulang belum lengkap", icon: ClipboardList },
          { label: "Hari libur", value: totals.holidays, detail: "Dalam periode terpilih", icon: CalendarOff },
        ].map(({label, value, detail, icon: Icon}) => <div key={label} className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-sm text-muted-foreground">{label}</p><Icon className="size-5 text-blue-500" /></div><p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{loading ? "—" : value}</p><p className="mt-1 truncate text-xs text-muted-foreground" title={detail}>{detail}</p></div>)}
      </div>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-label="Data kehadiran" aria-busy={loading}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 pt-4 sm:px-5">
          <div className="flex flex-wrap gap-4" role="group" aria-label="Tampilan data">
            {([['ringkasan', 'Ringkasan kehadiran'], ['log', 'Log presensi'], ['audit', 'Percobaan ditolak']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${view === value ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-muted-foreground hover:text-foreground"}`}>{label}</button>)}
          </div>
          <span className="pb-3 text-xs text-muted-foreground">{selected ? selected.nama_lengkap : "Semua teknisi"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 bg-muted/20 p-4 sm:px-5">
          {view === "ringkasan" && <div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Cari nama atau NIK" className="pl-9" placeholder="Cari nama atau NIK..." value={search} onChange={(event) => { setSearch(event.target.value); setSummaryPage(1); }} /></div>}
          <label className="text-sm"><span className="sr-only">Pilih teknisi</span><select className={selectClass} aria-label="Pilih teknisi" value={selectedId ?? "semua"} disabled={busy} onChange={(event) => chooseTechnician(event.target.value === "semua" ? null : event.target.value)}><option value="semua">Semua teknisi</option>{report.summaries.map((row) => <option key={String(row.person.id)} value={String(row.person.id)}>{row.person.nama_lengkap}</option>)}</select></label>
          {view === "ringkasan" && <select className={selectClass} aria-label="Status kehadiran dalam periode" value={summaryFilter} onChange={(event) => { setSummaryFilter(event.target.value); setSummaryPage(1); }}><option value="semua">Semua status</option><option value="hadir">Ada kehadiran</option><option value="sebagian">Perlu dilengkapi</option><option value="belum">Belum ada kehadiran</option></select>}
          {(selectedId || search || summaryFilter !== "semua") && <Button variant="ghost" size="sm" onClick={() => { chooseTechnician(null); setSearch(""); setSummaryFilter("semua"); }}><X className="size-4" />Reset filter</Button>}
        </div>

        {view === "ringkasan" && <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-xs font-medium text-muted-foreground"><tr><th className="min-w-52 px-5 py-3">Teknisi</th>{mode === "minggu" && report.schedule.map((day) => <th key={day.day} className="min-w-28 px-3 py-3 text-center"><span className="block text-foreground">{new Intl.DateTimeFormat("id-ID", {timeZone:"Asia/Jakarta",weekday:"short"}).format(new Date(parseDay(day.day)))}</span><span>{formatDay(day.day, true)}</span></th>)}<th className="min-w-24 px-4 py-3 text-center">Total kehadiran</th><th className="min-w-28 px-4 py-3 text-center">Perlu dilengkapi</th><th className="px-4 py-3"><span className="sr-only">Detail</span></th></tr></thead>
              <tbody className="divide-y divide-border/70">
                {!loading && visibleSummaries.map((row) => <tr key={String(row.person.id)} className="transition-colors hover:bg-muted/25"><td className="px-5 py-4"><button type="button" className="text-left font-medium text-foreground hover:text-blue-600" onClick={() => chooseTechnician(String(row.person.id))}>{row.person.nama_lengkap}</button><p className="mt-0.5 text-xs text-muted-foreground">NIK {row.person.nik ?? "—"}</p></td>{mode === "minggu" && row.codes.map((code,index) => <td key={index} className="px-3 py-4 text-center">{attendanceStatus(code)}</td>)}<td className="px-4 py-4 text-center text-lg font-semibold text-blue-600 tabular-nums">{row.attendance}</td><td className="px-4 py-4 text-center tabular-nums">{row.partial}</td><td className="px-4 py-4"><Button variant="ghost" size="sm" onClick={() => { chooseTechnician(String(row.person.id)); setView("log"); }}><ArrowUpRight className="size-4" /><span className="sr-only">Lihat log {row.person.nama_lengkap}</span></Button></td></tr>)}
                {!loading && !visibleSummaries.length && <tr><td colSpan={mode === "minggu" ? 10 : 4} className="px-5 py-12 text-center"><Users className="mx-auto mb-3 size-7 text-muted-foreground" /><p className="font-medium">Tidak ada teknisi yang sesuai</p><p className="mt-1 text-sm text-muted-foreground">Coba ubah pencarian atau reset filter.</p></td></tr>}
              </tbody>
            </table>
          </div>
          {pager(activeSummaryPage, summaryPages, filteredSummaries.length, setSummaryPage)}
          {selectedId && !loading && <div className="border-t p-5"><h3 className="mb-3 font-semibold">Rincian harian · {selected?.nama_lengkap ?? people.get(selectedId)?.nama_lengkap}</h3><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{dailyRows.map((day) => <div key={day.day} className="rounded-xl border bg-muted/10 p-3"><div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{formatDay(day.day, true)}</span>{attendanceStatus(day.code)}</div><p className="mt-2 text-xs text-muted-foreground">Masuk {day.masuk === null ? "—" : new Intl.DateTimeFormat("id-ID", {timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit"}).format(new Date(day.masuk))} · Pulang {day.pulang === null ? "—" : new Intl.DateTimeFormat("id-ID", {timeZone:"Asia/Jakarta",hour:"2-digit",minute:"2-digit"}).format(new Date(day.pulang))}</p>{day.holiday && <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">{day.reason}</p>}</div>)}</div></div>}
        </>}

        {view === "log" && <>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{['Teknisi', 'Waktu WIB', 'Jenis', 'Status', 'Lokasi', ''].map((label,index) => <th key={index} className="whitespace-nowrap px-5 py-3">{label || <span className="sr-only">Aksi</span>}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{!loading && visibleLogs.map((log) => <tr key={String(log.id_absen)} className="hover:bg-muted/25"><td className="min-w-40 px-5 py-4 font-medium">{people.get(String(log.id_teknisi))?.nama_lengkap ?? "Akun tidak tersedia"}</td><td className="whitespace-nowrap px-5 py-4">{formatTime(log.waktu_log)}</td><td className="px-5 py-4"><span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium">{log.tipe_log ?? "—"}</span></td><td className="px-5 py-4"><Badge variant={log.is_valid === true ? "success" : log.is_valid === false ? "destructive" : "secondary"}>{log.is_valid === true ? "Valid" : log.is_valid === false ? "Tidak valid" : "Perlu ditinjau"}</Badge></td><td className="px-5 py-4">{mapLink(log.latitude_aktual,log.longitude_aktual)}</td><td className="px-5 py-4"><Button variant="ghost" size="icon" disabled={busy} aria-label={`Hapus presensi ${people.get(String(log.id_teknisi))?.nama_lengkap ?? "teknisi"}`} onClick={() => setDeleteTarget(log)}><Trash2 className="size-4 text-muted-foreground" /></Button></td></tr>)}{!loading && !visibleLogs.length && <tr><td colSpan={6} className="px-5 py-12 text-center text-muted-foreground">Belum ada log presensi pada periode ini.</td></tr>}</tbody></table></div>
          {pager(currentPage, totalPages, logs.length, setPage)}
        </>}

        {view === "audit" && <>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-muted/40 text-xs text-muted-foreground"><tr>{['Teknisi','Waktu WIB','Jenis','Alasan penolakan','Lokasi'].map((label) => <th key={label} className="whitespace-nowrap px-5 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-border/70">{!loading && visibleAudits.map((audit) => <tr key={String(audit.id_audit)} className="hover:bg-muted/25"><td className="min-w-40 px-5 py-4 font-medium">{people.get(String(audit.technician_id))?.nama_lengkap ?? "Akun tidak tersedia"}</td><td className="whitespace-nowrap px-5 py-4">{formatTime(audit.created_at)}</td><td className="px-5 py-4">{audit.attendance_type ?? "—"}</td><td className="min-w-60 px-5 py-4">{audit.reason ?? "—"}</td><td className="px-5 py-4">{mapLink(audit.latitude,audit.longitude)}</td></tr>)}{!loading && !visibleAudits.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">Tidak ada percobaan presensi ditolak pada periode ini.</td></tr>}</tbody></table></div>
          {pager(currentAuditPage, totalAuditPages, audits.length, setAuditPage)}
        </>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{period.label} · WIB</span><Button variant="ghost" size="sm" className="text-muted-foreground" disabled={busy || !!error} onClick={() => setDeleteAllOpen(true)}><Trash2 className="size-4" />Hapus semua log</Button></div>

      <Dialog open={holidayOpen} onOpenChange={(open) => { if (!holidayBusy) { setHolidayOpen(open); if (!open) setHolidayDirty(false); } }}>
        <DialogContent showCloseButton={!holidayBusy} className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>Hari libur laporan</DialogTitle><DialogDescription>{period.label}. Tentukan tanggal libur untuk seluruh teknisi pada periode ini.</DialogDescription></DialogHeader>
          <ReportHolidays key={period.key} period={period} holidays={data.holidays} disabled={loading || exporting || deleting || !!error} onSaved={refresh} onBusy={setHolidayBusy} onDirty={setHolidayDirty} />
          <DialogFooter><Button variant="outline" disabled={holidayBusy} onClick={() => { setHolidayOpen(false); setHolidayDirty(false); }}>{holidayDirty ? "Batalkan isian & tutup" : "Selesai"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={(open) => { if (!exporting) setExportOpen(open); }}>
        <DialogContent showCloseButton={!exporting} className="max-h-[90dvh] overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>Ekspor laporan kehadiran</DialogTitle><DialogDescription>Pilih cakupan laporan, lalu unduh file Excel.</DialogDescription></DialogHeader>
          <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-950/40"><FileSpreadsheet className="mb-2 size-6 text-blue-600" /><p className="font-semibold">{period.label}</p><p className="mt-1 text-sm text-muted-foreground">{mode === "minggu" ? "Senin–Sabtu" : mode === "bulan" ? "Histori bulanan" : "Laporan harian"} · Excel · Landscape</p></div>
          <label className="space-y-2 text-sm font-medium">Teknisi dalam laporan<select className={`${selectClass} block w-full`} value={scope} disabled={exporting} onChange={(event) => setScope(event.target.value)}><option value="semua">Semua teknisi</option><option value="dipilih" disabled={!selectedId}>{selectedId ? `Hanya ${selected?.nama_lengkap ?? people.get(selectedId)?.nama_lengkap ?? "teknisi dipilih"}` : "Pilih teknisi di halaman terlebih dahulu"}</option></select></label>
          <div className="space-y-2 rounded-xl border p-4 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Hari kerja</span><strong>{report.schedule.filter((day) => !day.holiday).length} hari</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Hari libur</span><strong>{totals.holidays} hari</strong></div><div className="flex justify-between"><span className="text-muted-foreground">Cakupan</span><strong>{scope === "semua" ? `${report.summaries.length} teknisi` : "1 teknisi"}</strong></div></div>
          <details className="rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-medium">Pengaturan tambahan</summary><label className="mt-3 block space-y-1 text-sm">Batas akhir hari kerja (WIB)<Input type="time" value={workEnd} disabled={exporting} onChange={(event) => { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(event.target.value)) setWorkEnd(event.target.value); }} /><span className="block text-xs text-muted-foreground">Menentukan kapan hari ini dianggap selesai pada laporan.</span></label></details>
          <DialogFooter><Button variant="outline" disabled={exporting} onClick={() => setExportOpen(false)}>Batal</Button><Button className="bg-blue-600 text-white hover:bg-blue-700" disabled={busy || !!error || holidayDirty || scope === "dipilih" && !selectedId} onClick={() => void exportExcel()}>{exporting ? <LoaderCircle className="animate-spin" /> : <Download />}{exporting ? "Menyiapkan laporan..." : "Unduh Excel"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteAttendanceDialog open={!!deleteTarget} technicianName={deleteTarget ? people.get(String(deleteTarget.id_teknisi))?.nama_lengkap ?? "Teknisi" : "Teknisi"} attendanceTime={formatTime(deleteTarget?.waktu_log ?? null)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} onConfirm={deleteAttendance} />
      <DeleteAllAttendanceDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen} onConfirm={deleteAll} />
    </div>
  );
}
