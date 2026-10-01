export type Technician = {
  id: string | number;
  nama_lengkap: string;
  nik: string | null;
};

export type Attendance = {
  id_absen: string | number;
  id_teknisi: string | number;
  waktu_log: string | null;
  tipe_log: string | null;
  latitude_aktual: number | null;
  longitude_aktual: number | null;
  is_valid: boolean | null;
};

export type AttendanceAudit = {
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

export type Period = {
  start: string;
  end: string;
  label: string;
  key: string;
  mode: FilterMode;
};

export type FilterMode = "hari" | "minggu" | "bulan";

const DAY = 86_400_000;
const WIB = 7 * 3_600_000;

export function dateKey(
  value: string | Date = new Date(),
): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "";
  }

  return new Date(date.getTime() + WIB)
    .toISOString()
    .slice(0, 10);
}

export function formatTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) {
    return "—";
  }

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

export function shiftMonth(
  month: string,
  offset: number,
): string {
  const [year, number] = month.split("-").map(Number);

  return new Date(
    Date.UTC(year, number - 1 + offset, 1),
  )
    .toISOString()
    .slice(0, 7);
}

export function getPeriod(
  mode: FilterMode,
  month: string,
  now = new Date(),
  weekAnchor = dateKey(now),
): Period {
  if (mode === "bulan") {
    if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) {
      throw new Error("Bulan tidak valid.");
    }

    const [year, number] = month.split("-").map(Number);

    const start = new Date(
      Date.UTC(year, number - 1, 1) - WIB,
    ).toISOString();

    const end = new Date(
      Date.UTC(year, number, 1) - WIB,
    ).toISOString();

    const label = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      month: "long",
      year: "numeric",
    }).format(new Date(start));

    return {
      start,
      end,
      label,
      key: month,
      mode,
    };
  }

  const today = dateKey(now);
  if (mode === "minggu") {
    const anchor = parseDay(weekAnchor);
    const weekday = new Date(anchor + WIB).getUTCDay();
    const monday = anchor - ((weekday + 6) % 7) * DAY;
    const saturday = dateKey(new Date(monday + 5 * DAY));
    const first = dateKey(new Date(monday));
    return {
      start: new Date(monday).toISOString(),
      end: new Date(monday + 6 * DAY).toISOString(),
      label: `${formatDay(first)} – ${formatDay(saturday)}`,
      key: `${first}_${saturday}`,
      mode,
    };
  }
  const startMs = parseDay(today);
  return {
    start: new Date(startMs).toISOString(),
    end: new Date(startMs + DAY).toISOString(),
    label: `Hari ini (${formatDay(today)})`,
    key: today,
    mode,
  };
}

export type ReportHoliday = { day: string; name: string; updated_at: string };

export function parseDay(day: string): number {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(day)) {
    throw new Error("Tanggal tidak valid.");
  }
  const ms = Date.parse(`${day}T00:00:00+07:00`);
  if (!Number.isFinite(ms) || dateKey(new Date(ms)) !== day) {
    throw new Error("Tanggal tidak valid.");
  }
  return ms;
}

export function formatDay(day: string, short = false): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "numeric",
    month: short ? "short" : "long", year: short ? undefined : "numeric",
  }).format(new Date(parseDay(day)));
}

export function periodDays(period: Period): string[] {
  const start = Date.parse(period.start), end = Date.parse(period.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 32 * DAY) {
    throw new Error("Periode laporan tidak valid.");
  }
  const result: string[] = [];
  for (let ms = start; ms < end; ms += DAY) result.push(dateKey(new Date(ms)));
  return result;
}

export function shiftWeek(day: string, offset: number): string {
  return dateKey(new Date(parseDay(day) + offset * 7 * DAY));
}

type PageResult<T> = {
  data: T[] | null;
  count: number | null;
  error: {
    message: string;
    code?: string;
    details?: string | null;
    hint?: string | null;
  } | null;
};

// Mengambil seluruh data secara bertahap.
// Offset mengikuti jumlah baris aktual yang diterima.
// Ini juga menangani batas server di bawah 500 baris.
export async function readAll<T>(
  request: (
    from: number,
    to: number,
  ) => PromiseLike<PageResult<T>>,
  signal?: AbortSignal,
): Promise<T[]> {
  const rows: T[] = [];
  let expected: number | null = null;

  for (;;) {
    signal?.throwIfAborted();
    const result = await request(
      rows.length,
      rows.length + 499,
    );

    signal?.throwIfAborted();
    if (result.error) {
      console.error(
        "Query presensi gagal:",
        result.error,
      );

      throw new Error(
        result.error.message ||
          result.error.code ||
          "Query gagal.",
      );
    }

    if (result.count === null) {
      throw new Error(
        "Jumlah data tidak tersedia.",
      );
    }

    if (
      expected !== null &&
      result.count !== expected
    ) {
      throw new Error(
        "Data berubah saat dimuat. Silakan coba kembali.",
      );
    }

    expected = result.count;
    const batch = result.data ?? [];

    if (
      !batch.length &&
      rows.length < expected
    ) {
      throw new Error(
        "Data belum lengkap. Silakan muat ulang.",
      );
    }

    rows.push(...batch);

    if (rows.length >= expected) {
      return rows;
    }
  }
}

export function dailyRecap(logs: Attendance[]) {
  const groups = new Map<
    string,
    {
      technicianId: string;
      day: string;
      logs: number;
      valid: number;
      masuk: number | null;
      pulang: number | null;
    }
  >();

  for (const log of logs) {
    const day = log.waktu_log
      ? dateKey(log.waktu_log)
      : "";

    if (!day) {
      continue;
    }

    const technicianId = String(log.id_teknisi);
    const key = JSON.stringify([
      technicianId,
      day,
    ]);

    const group = groups.get(key) ?? {
      technicianId,
      day,
      logs: 0,
      valid: 0,
      masuk: null,
      pulang: null,
    };

    group.logs++;

    if (log.is_valid === true) {
      group.valid++;

      const time = Date.parse(log.waktu_log!);
      const kind = log.tipe_log
        ?.trim()
        .toUpperCase();

      if (kind === "MASUK") {
        group.masuk = Math.min(
          group.masuk ?? time,
          time,
        );
      }

      if (kind === "PULANG") {
        group.pulang = Math.max(
          group.pulang ?? time,
          time,
        );
      }
    }

    groups.set(key, group);
  }

  return [...groups.values()]
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.technicianId.localeCompare(
          b.technicianId,
        ),
    )
    .map((group) => {
      const complete =
        group.masuk !== null &&
        group.pulang !== null &&
        group.pulang >= group.masuk;

      return {
        ...group,
        complete,
        hours: complete
          ? (group.pulang! - group.masuk!) /
            3_600_000
          : null,
      };
    });
}

export { createAttendanceWorkbook, downloadAttendanceReport } from "./presensi-workbook";
