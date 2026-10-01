export type AttendanceNotice = {
  id_absen: string | number;
  id_teknisi: string | number;
  waktu_log: string;
  tipe_log: string;
  is_valid: boolean;
  nama_lengkap?: string;
};

export function attendanceType(value: string): "Masuk" | "Pulang" | null {
  const type = value.trim().toUpperCase();
  return type === "MASUK" ? "Masuk" : type === "PULANG" ? "Pulang" : null;
}

export function attendanceTime(value: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit",
    second: "2-digit", hourCycle: "h23",
  }).format(new Date(value)) + " WIB";
}

export function attendanceTodayStart(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00+07:00`).toISOString();
}

// Records existing before the QR page opened stay in the list without a popup.
// The same record received through polling and realtime only produces one popup.
export function collectAttendanceNotices(
  rows: AttendanceNotice[], seen: Set<string>, openedAt: number,
): AttendanceNotice[] {
  const fresh: AttendanceNotice[] = [];
  for (const row of [...rows].reverse()) {
    const id = String(row.id_absen);
    if (seen.has(id)) continue;
    seen.add(id);
    if (row.is_valid === true && attendanceType(row.tipe_log)
      && Date.parse(row.waktu_log) >= openedAt) fresh.push(row);
  }
  return fresh;
}
