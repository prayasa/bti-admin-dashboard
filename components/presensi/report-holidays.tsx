"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/src/utils/supabase";
import { formatDay, periodDays, type Period, type ReportHoliday } from "@/lib/presensi-report";

type Props = {
  period: Period;
  holidays: ReportHoliday[];
  disabled: boolean;
  onSaved: () => void;
  onBusy: (busy: boolean) => void;
  onDirty: (dirty: boolean) => void;
};

export function ReportHolidays({ period, holidays, disabled, onSaved, onBusy, onDirty }: Props) {
  const days = periodDays(period);
  const [day, setDay] = useState(days[0]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const stored = holidays.find((item) => item.day === day);
  const canSave = name.trim().length > 0 && name.trim() !== (stored?.name ?? "");

  useEffect(() => { onDirty(canSave); }, [canSave, onDirty]);

  function edit(nextDay: string, nextName: string) {
    setDay(nextDay);
    setName(nextName);
    const previous = holidays.find((item) => item.day === nextDay);
    onDirty(nextName.trim() !== (previous?.name ?? "") && nextName.trim() !== "");
  }

  async function save(remove: boolean, targetDay = day) {
    if (lock.current || disabled || (!remove && !canSave)) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    try {
      const query = remove
        ? supabase.from("bti_report_holidays").delete().eq("day", targetDay).select("day")
        : supabase.from("bti_report_holidays").upsert({ day: targetDay, name: name.trim() }, { onConflict: "day" }).select("day");
      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) throw new Error("Perubahan tidak tersimpan. Periksa akses admin lalu muat ulang.");
      if (targetDay === day) setName("");
      onDirty(false);
      toast.success(remove ? "Hari libur dihapus dari pengaturan laporan." : "Hari libur laporan tersimpan.");
      onSaved();
    } catch (error) {
      console.error("Pengaturan hari libur gagal:", error);
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan hari libur. Pastikan migration sudah dijalankan dan akun memiliki role admin.");
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-muted/20 p-4" aria-label="Hari libur laporan">
      <div>
        <h3 className="font-semibold">Hari libur manual</h3>
        <p className="text-sm text-muted-foreground">Berlaku untuk semua teknisi pada tanggal yang ditentukan. Minggu otomatis libur. Simpan perubahan sebelum ekspor; log presensi tetap tersimpan.</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          Tanggal dalam periode
          <select className="block h-9 rounded-md border bg-background px-3" value={day} disabled={disabled || busy} onChange={(event) => {
            const selected = event.target.value;
            edit(selected, holidays.find((item) => item.day === selected)?.name ?? "");
          }}>
            {days.map((value) => <option key={value} value={value}>{formatDay(value)}</option>)}
          </select>
        </label>
        <label className="min-w-60 flex-1 space-y-1 text-sm">
          Keterangan libur
          <Input value={name} maxLength={160} placeholder="Contoh: libur nasional / libur kantor" disabled={disabled || busy} onChange={(event) => edit(day, event.target.value)} />
        </label>
        <Button variant="outline" disabled={disabled || busy || !canSave} onClick={() => void save(false)}>{busy ? "Menyimpan..." : "Simpan hari libur"}</Button>
      </div>
      {canSave && <p className="text-sm text-amber-700 dark:text-amber-400">Keterangan belum disimpan. Simpan atau kosongkan isian sebelum ekspor.</p>}
      {holidays.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada hari libur manual pada periode ini.</p> : (
        <ul className="space-y-2">
          {holidays.map((holiday) => <li key={holiday.day} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-2 text-sm">
            <span><strong>{formatDay(holiday.day)}</strong> — {holiday.name}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" disabled={disabled || busy} onClick={() => edit(holiday.day, holiday.name)}>Ubah</Button>
              <Button size="sm" variant="ghost" disabled={disabled || busy || canSave} onClick={() => void save(true, holiday.day)}>Hapus pengaturan</Button>
            </div>
          </li>)}
        </ul>
      )}
    </section>
  );
}
