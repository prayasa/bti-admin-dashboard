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
    };
  }

  const today = dateKey(now);
  const endMs =
    Date.parse(`${today}T00:00:00+07:00`) + DAY;

  const startMs =
    endMs - (mode === "minggu" ? 7 : 1) * DAY;

  const start = new Date(startMs).toISOString();
  const end = new Date(endMs).toISOString();
  const first = dateKey(start);

  return {
    start,
    end,
    label:
      mode === "hari"
        ? `Hari ini (${today})`
        : `${first} sampai ${today}`,
    key: `${first}_${today}`,
  };
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
): Promise<T[]> {
  const rows: T[] = [];
  let expected: number | null = null;

  for (;;) {
    const result = await request(
      rows.length,
      rows.length + 499,
    );

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

export async function createAttendanceWorkbook(
  input: {
    technicians: Technician[];
    logs: Attendance[];
    audits: AttendanceAudit[];
    period: Period;
    scope: string;
  },
) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "BTI Admin";
  workbook.created = new Date();

  const {
    technicians,
    logs,
    audits,
    period,
    scope,
  } = input;

  const people = new Map(
    technicians.map((person) => [
      String(person.id),
      person,
    ]),
  );

  // Tetap sertakan pemilik log apabila akun teknisinya
  // sudah tidak ada di daftar teknisi.
  const referencedIds = [
    ...logs.map((row) =>
      String(row.id_teknisi),
    ),
    ...audits.map((row) =>
      String(row.technician_id),
    ),
  ];

  for (const id of referencedIds) {
    if (!people.has(id)) {
      people.set(id, {
        id,
        nama_lengkap: `Teknisi ${id}`,
        nik: null,
      });
    }
  }

  const days = dailyRecap(logs);

  // Excel menyimpan tanggal sebagai angka serial.
  // Ditambahkan offset WIB agar waktu tampil konsisten.
  const serial = (
    value: string | number | null,
  ) => {
    if (value === null) {
      return null;
    }

    const ms =
      typeof value === "number"
        ? value
        : Date.parse(value);

    return Number.isFinite(ms)
      ? (ms + WIB) / DAY + 25569
      : null;
  };

  type Cell = string | number | null;

  const sheet = (
    name: string,
    headers: string[],
    rows: Cell[][],
    dateColumns: number[] = [],
  ) => {
    const ws = workbook.addWorksheet(name);

    ws.addRow(["Laporan Presensi BTI"]);

    ws.addRow([
      "Periode",
      period.label,
      "Zona waktu",
      "WIB (UTC+7)",
    ]);

    ws.addRow([
      "Cakupan",
      scope,
      "Diekspor",
      formatTime(new Date().toISOString()),
    ]);

    ws.addRow([
      "Catatan",
      "Durasi: masuk valid pertama sampai pulang valid terakhir pada hari WIB yang sama. Bukan perhitungan gaji/lembur. Hari tanpa log tidak dinilai sebagai absen.",
    ]);

    ws.addRow([]);
    ws.addRow(headers);

    rows.forEach((row) => ws.addRow(row));

    ws.views = [
      {
        state: "frozen",
        ySplit: 6,
      },
    ];

    ws.autoFilter = {
      from: {
        row: 6,
        column: 1,
      },
      to: {
        row: Math.max(6, ws.rowCount),
        column: headers.length,
      },
    };

    ws.getRow(1).font = {
      bold: true,
      size: 16,
    };

    ws.getRow(6).eachCell((cell) => {
      cell.font = {
        bold: true,
        color: {
          argb: "FFFFFFFF",
        },
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: "FF17365D",
        },
      };
    });

    headers.forEach((header, index) => {
      ws.getColumn(index + 1).width =
        /Nama|Alasan/.test(header)
          ? 36
          : 24;
    });

    for (
      let row = 7;
      row <= ws.rowCount;
      row++
    ) {
      dateColumns.forEach((column) => {
        ws.getCell(row, column).numFmt =
          "dd/mm/yyyy hh:mm:ss";
      });
    }

    return ws;
  };

  const summaries = [...people.values()].map(
    (person) => {
      const id = String(person.id);

      const own = logs.filter(
        (log) =>
          String(log.id_teknisi) === id,
      );

      const ownDays = days.filter(
        (day) => day.technicianId === id,
      );

      const valid = own.filter(
        (log) => log.is_valid === true,
      );

      return [
        id,
        person.nik ?? "",
        person.nama_lengkap,
        own.length,
        valid.length,
        own.filter(
          (log) => log.is_valid === false,
        ).length,
        own.filter(
          (log) => log.is_valid === null,
        ).length,
        valid.filter(
          (log) =>
            log.tipe_log
              ?.trim()
              .toUpperCase() === "MASUK",
        ).length,
        valid.filter(
          (log) =>
            log.tipe_log
              ?.trim()
              .toUpperCase() === "PULANG",
        ).length,
        ownDays.filter(
          (day) => day.masuk !== null,
        ).length,
        ownDays.filter(
          (day) => day.complete,
        ).length,
        ownDays.reduce(
          (total, day) =>
            total + (day.hours ?? 0),
          0,
        ),
        audits.filter(
          (audit) =>
            String(audit.technician_id) === id,
        ).length,
      ];
    },
  );

  const summary = sheet(
    "Rekap Teknisi",
    [
      "ID Teknisi",
      "NIK",
      "Nama",
      "Total log",
      "Log valid",
      "Log tidak valid",
      "Validasi belum diketahui",
      "Masuk valid",
      "Pulang valid",
      "Hari masuk valid",
      "Hari lengkap",
      "Durasi tercatat (jam)",
      "Percobaan ditolak",
    ],
    summaries,
  );

  summary.getColumn(12).numFmt = "0.00";

  const daily = sheet(
    "Rekap Harian",
    [
      "Tanggal WIB",
      "ID Teknisi",
      "NIK",
      "Nama",
      "Masuk valid pertama",
      "Pulang valid terakhir",
      "Total log",
      "Log valid",
      "Status",
      "Durasi tercatat (jam)",
    ],
    days.map((day) => {
      const person = people.get(
        day.technicianId,
      )!;

      return [
        day.day,
        day.technicianId,
        person.nik ?? "",
        person.nama_lengkap,
        serial(day.masuk),
        serial(day.pulang),
        day.logs,
        day.valid,
        day.complete
          ? "Lengkap"
          : "Tidak lengkap",
        day.hours,
      ];
    }),
    [5, 6],
  );

  daily.getColumn(10).numFmt = "0.00";

  sheet(
    "Detail Presensi",
    [
      "ID Presensi",
      "ID Teknisi",
      "NIK",
      "Nama",
      "Waktu WIB",
      "Jenis",
      "Validasi",
      "Latitude",
      "Longitude",
    ],
    logs.map((log) => {
      const person = people.get(
        String(log.id_teknisi),
      )!;

      return [
        String(log.id_absen),
        String(log.id_teknisi),
        person.nik ?? "",
        person.nama_lengkap,
        serial(log.waktu_log),
        log.tipe_log ?? "",
        log.is_valid === true
          ? "Valid"
          : log.is_valid === false
            ? "Tidak valid"
            : "Belum diketahui",
        log.latitude_aktual,
        log.longitude_aktual,
      ];
    }),
    [5],
  );

  sheet(
    "Percobaan Ditolak",
    [
      "ID Audit",
      "ID Teknisi",
      "Nama",
      "Waktu WIB",
      "Jenis",
      "Hasil",
      "Alasan",
      "Latitude",
      "Longitude",
      "Akurasi (m)",
      "Usia lokasi (ms)",
      "Jarak (m)",
      "Mock location",
    ],
    audits.map((audit) => [
      String(audit.id_audit),
      String(audit.technician_id),
      people.get(
        String(audit.technician_id),
      )!.nama_lengkap,
      serial(audit.created_at),
      audit.attendance_type ?? "",
      audit.result,
      audit.reason ?? "",
      audit.latitude,
      audit.longitude,
      audit.accuracy_meters,
      audit.location_age_ms,
      audit.distance_meters,
      audit.is_mock === null
        ? "Belum diketahui"
        : audit.is_mock
          ? "Ya"
          : "Tidak",
    ]),
    [4],
  );

  return workbook;
}

export async function downloadAttendanceReport(
  input: Parameters<
    typeof createAttendanceWorkbook
  >[0],
) {
  const workbook =
    await createAttendanceWorkbook(input);

  const buffer =
    await workbook.xlsx.writeBuffer();

  const bytes = new Uint8Array(buffer);

  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;

  anchor.download =
    `Rekap_Presensi_${input.period.key}_` +
    `${
      input.scope === "Semua teknisi"
        ? "semua"
        : "teknisi"
    }.xlsx`;

  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(
    () => URL.revokeObjectURL(url),
    60_000,
  );
}