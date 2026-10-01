"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bell, CheckCircle2, LoaderCircle, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/src/utils/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  attendanceTime, attendanceTodayStart, attendanceType, collectAttendanceNotices,
  type AttendanceNotice,
} from "@/lib/attendance-notifications";

const DESTINATION = "/admin/presensi";

export function AttendanceNotifications() {
  const router = useRouter();
  const [items, setItems] = useState<AttendanceNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [live, setLive] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    let active = true;
    let busy = false;
    let pending = false;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let seenDay = attendanceTodayStart();
    const openedAt = Date.now();
    const seen = new Set<string>();
    const controller = new AbortController();

    async function refresh() {
      if (!active) return;
      if (busy) { pending = true; return; }
      busy = true;
      try {
        const start = attendanceTodayStart();
        if (start !== seenDay) { seen.clear(); seenDay = start; }
        const { data, error: queryError } = await supabase
          .from("log_presensi")
          .select("id_absen,id_teknisi,waktu_log,tipe_log,is_valid")
          .eq("is_valid", true)
          .gte("waktu_log", start)
          .lte("waktu_log", new Date().toISOString())
          .order("waktu_log", { ascending: false })
          .order("id_absen", { ascending: false })
          .limit(100)
          .abortSignal(controller.signal);
        if (queryError) throw queryError;
        if (!active) return;
        const rows = ((data ?? []) as AttendanceNotice[])
          .filter((row) => attendanceType(row.tipe_log));
        const technicianIds = [...new Set(rows.map((row) => row.id_teknisi))];
        const names = new Map<string, string>();
        if (technicianIds.length) {
          const result = await supabase.from("teknisi")
            .select("id,nama_lengkap").in("id", technicianIds)
            .abortSignal(controller.signal);
          if (result.error) throw result.error;
          for (const technician of result.data ?? []) {
            names.set(String(technician.id), technician.nama_lengkap?.trim() || "Teknisi tanpa nama");
          }
        }
        if (!active) return;
        const notices = rows.map((row) => ({ ...row,
          nama_lengkap: names.get(String(row.id_teknisi)) ?? "Teknisi tidak tersedia",
        }));
        const fresh = collectAttendanceNotices(notices, seen, openedAt);
        // Keep memory bounded when the screen is displayed all day.
        if (seen.size > 1000) {
          const current = new Set(notices.map((row) => String(row.id_absen)));
          for (const id of seen) if (!current.has(id)) seen.delete(id);
        }
        setItems(notices.slice(0, 8));
        setError(false);
        for (const notice of fresh) {
          const label = attendanceType(notice.tipe_log)!;
          const title = `${notice.nama_lengkap} · Presensi ${label.toLowerCase()}`;
          setAnnouncement(`${title}, ${attendanceTime(notice.waktu_log)}`);
          toast.success(title, {
            id: `qr-attendance-${notice.id_absen}`,
            description: attendanceTime(notice.waktu_log),
            duration: 7000,
            action: { label: "Lihat kehadiran", onClick: () => router.push(DESTINATION) },
          });
        }
      } catch {
        if (active) setError(true);
      } finally {
        busy = false;
        if (active) {
          setLoading(false);
          if (pending) { pending = false; void refresh(); }
        }
      }
    }

    function schedule() {
      if (!active) return;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { void refresh(); }, 250);
    }

    const channel = supabase.channel("admin-qr-attendance-notifications")
      .on("postgres_changes", { event: "*", schema: "public", table: "log_presensi" }, schedule)
      .subscribe((status) => {
        if (!active) return;
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") schedule();
      });

    void refresh();
    const interval = setInterval(() => { void refresh(); }, 10_000);
    window.addEventListener("focus", schedule);
    window.addEventListener("online", schedule);
    const onVisible = () => { if (document.visibilityState === "visible") schedule(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      active = false;
      controller.abort();
      clearInterval(interval);
      if (debounce) clearTimeout(debounce);
      window.removeEventListener("focus", schedule);
      window.removeEventListener("online", schedule);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-2 leading-snug"><Bell className="size-4" aria-hidden="true" />Presensi terbaru</CardTitle>
          <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={`size-1.5 rounded-full ${error ? "bg-amber-500" : live ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
            {error ? "Gangguan koneksi" : live ? "Realtime" : "Auto 10 detik"}
          </span>
        </div>
        <CardDescription>Presensi masuk dan pulang yang diterima hari ini (WIB).</CardDescription>
        <Button asChild size="sm" variant="outline" className="w-fit">
          <Link href={DESTINATION}>Lihat kehadiran<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
        </Button>
      </CardHeader>
      <CardContent>
        <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
        {error && <p role="alert" className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">Pembaruan presensi gagal. Sistem akan mencoba lagi otomatis. Data yang tampil mungkin belum terbaru.</p>}
        {loading ? (
          <p className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" aria-hidden="true" />Memuat presensi…</p>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-center">
            <CheckCircle2 className="mx-auto mb-2 size-5 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">{error ? "Data belum tersedia" : "Belum ada presensi hari ini"}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Notifikasi akan muncul saat teknisi melakukan presensi masuk atau pulang.</p>
          </div>
        ) : (
          <ul aria-label="Presensi terbaru hari ini" tabIndex={0} className="max-h-80 space-y-0 divide-y divide-border overflow-y-auto overscroll-contain pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" style={{ scrollbarGutter: "stable" }}>
            {items.map((item) => {
              const type = attendanceType(item.tipe_log)!;
              const Icon = type === "Masuk" ? LogIn : LogOut;
              return (
                <li key={item.id_absen} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${type === "Masuk" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}><Icon className="size-4" aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium">{item.nama_lengkap}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>Presensi {type.toLowerCase()}</span><span aria-hidden="true">·</span>
                      <time dateTime={item.waktu_log} className="tabular-nums">{attendanceTime(item.waktu_log)}</time>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="icon-sm">
                    <Link href={DESTINATION} aria-label={`Lihat kehadiran ${item.nama_lengkap}`}><ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
