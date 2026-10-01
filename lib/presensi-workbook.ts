import type { Worksheet, CellValue } from "exceljs";
import {
  dailyRecap, dateKey, formatDay, formatTime, parseDay, periodDays,
  type Attendance, type AttendanceAudit, type Period, type ReportHoliday, type Technician,
} from "./presensi-report";

const DAY = 86_400_000;
const WIB = 7 * 3_600_000;
// Palet biru slate: kontras jelas tanpa biru elektrik yang terlalu terang.
const NAVY = "FF334E68";
const ACCENT = "FF486581";
const TEXT = "FF243746";
const MUTED = "FF62788C";
const LINE = "FFE3E9EF";
const LIGHT = "FFF0F4F8";
const STRIPE = "FFF8FAFC";
const WHITE = "FFFFFFFF";

export type ReportInput = {
  technicians: Technician[];
  logs: Attendance[];
  audits: AttendanceAudit[];
  holidays: ReportHoliday[];
  period: Period;
  scope: string;
  workEnd?: string;
  now?: Date;
};

type Code = "H" | "P" | "TC" | "L" | "LH" | "LP" | "V?" | "PR" | "—";
function serial(value: string | number | null): number | null {
  if (value === null) return null;
  const ms = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? (ms + WIB) / DAY + 25569 : null;
}

function key(id: string, day: string) { return JSON.stringify([id, day]); }
function countCodes(codes: Code[], wanted: Code[]) { return codes.filter((value) => wanted.includes(value)).length; }

export function buildReport(input: ReportInput) {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("Waktu laporan tidak valid.");
  const workEnd = input.workEnd ?? "17:00";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(workEnd)) throw new Error("Jam akhir kerja tidak valid.");
  const dates = periodDays(input.period);
  const start = Date.parse(input.period.start), end = Date.parse(input.period.end);
  if (input.period.mode === "minggu" && (dates.length !== 6 || new Date(parseDay(dates[0]) + WIB).getUTCDay() !== 1)) {
    throw new Error("Laporan mingguan harus Senin–Sabtu.");
  }
  const logs = input.logs.filter((row) => row.waktu_log !== null && Date.parse(row.waktu_log) >= start && Date.parse(row.waktu_log) < end)
    .sort((a, b) => Date.parse(a.waktu_log!) - Date.parse(b.waktu_log!) || String(a.id_absen).localeCompare(String(b.id_absen)));
  const audits = input.audits.filter((row) => row.created_at !== null && Date.parse(row.created_at) >= start && Date.parse(row.created_at) < end)
    .sort((a, b) => Date.parse(a.created_at!) - Date.parse(b.created_at!) || String(a.id_audit).localeCompare(String(b.id_audit)));
  const people = new Map(input.technicians.map((person) => [String(person.id), person]));
  for (const id of [...logs.map((row) => String(row.id_teknisi)), ...audits.map((row) => String(row.technician_id))]) {
    if (!people.has(id)) people.set(id, { id, nama_lengkap: `Akun tidak tersedia (${id})`, nik: null });
  }
  const technicians = [...people.values()].sort((a, b) => (a.nama_lengkap ?? "").localeCompare(b.nama_lengkap ?? "", "id") || String(a.id).localeCompare(String(b.id)));
  const calendar = new Map(input.holidays.map((holiday) => [holiday.day, holiday.name]));
  const schedule = dates.map((day) => {
    const sunday = new Date(parseDay(day) + WIB).getUTCDay() === 0;
    const reason = calendar.get(day) ?? (sunday ? "Libur Minggu" : "Hari kerja");
    return { day, holiday: sunday || calendar.has(day), reason };
  });
  const recaps = dailyRecap(logs);
  const groups = new Map(recaps.map((row) => [key(row.technicianId, row.day), row]));
  const unknown = new Set(logs.filter((row) => row.is_valid === null).map((row) => key(String(row.id_teknisi), dateKey(row.waktu_log!))));
  const daily = technicians.flatMap((person) => schedule.map((calendarDay) => {
    const id = String(person.id), group = groups.get(key(id, calendarDay.day));
    const hasAttendance = group?.masuk !== null && group?.masuk !== undefined || group?.pulang !== null && group?.pulang !== undefined;
    const future = calendarDay.day > dateKey(now);
    const stillOpen = calendarDay.day === dateKey(now) && now.getTime() < Date.parse(`${calendarDay.day}T${workEnd}:00+07:00`);
    let code: Code;
    if (group?.complete) code = calendarDay.holiday ? "LH" : "H";
    else if (hasAttendance) code = calendarDay.holiday ? "LP" : "P";
    else if (unknown.has(key(id, calendarDay.day))) code = "V?";
    else if (future) code = "—";
    else if (calendarDay.holiday) code = "L";
    else if (stillOpen) code = "PR";
    else code = "TC";
    return {
      person, day: calendarDay.day, code, reason: calendarDay.reason, holiday: calendarDay.holiday,
      masuk: group?.masuk ?? null, pulang: group?.pulang ?? null,
      hours: group?.hours ?? null, logs: group?.logs ?? 0, valid: group?.valid ?? 0,
    };
  }));
  const dailyByPerson = new Map<string, typeof daily>();
  for (const row of daily) {
    const id = String(row.person.id);
    const own = dailyByPerson.get(id) ?? [];
    own.push(row);
    dailyByPerson.set(id, own);
  }
  const summaries = technicians.map((person) => {
    const own = dailyByPerson.get(String(person.id)) ?? [];
    const codes = own.map((row) => row.code);
    return {
      person, daily: own, codes,
      attendance: countCodes(codes, ["H", "P", "LH", "LP"]),
      complete: countCodes(codes, ["H", "LH"]), partial: countCodes(codes, ["P", "LP"]),
      missing: countCodes(codes, ["TC"]), holidays: own.filter((row) => row.holiday).length,
      unverified: countCodes(codes, ["V?"]), hours: own.reduce((total, row) => total + (row.hours ?? 0), 0),
    };
  });
  return { now, workEnd, logs, audits, people, schedule, daily, summaries };
}

export async function createAttendanceWorkbook(input: ReportInput) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const report = buildReport(input);
  workbook.creator = "CV. Bengkel Teknologi Indonesia";
  workbook.created = report.now;
  workbook.modified = report.now;
  workbook.calcProperties.fullCalcOnLoad = true;

  function merged(ws: Worksheet, row: number, from: number, to: number, text: CellValue, fill?: string) {
    ws.mergeCells(row, from, row, to);
    const cell = ws.getCell(row, from);
    cell.value = text;
    cell.font = { name: "Calibri", size: 10, color: { argb: TEXT } };
    cell.alignment = { vertical: "middle", wrapText: true };
    if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    return cell;
  }

  function base(name: string, title: string, headers: string[], widths: number[], headerRow = 7) {
    const ws = workbook.addWorksheet(name, {
      properties: { tabColor: { argb: name === "Rekap Mingguan" || name === "Rekap Teknisi" ? NAVY : ACCENT }, defaultRowHeight: 22 },
      pageSetup: {
        paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        horizontalCentered: true, margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 },
        printTitlesRow: `1:${headerRow}`,
      },
      headerFooter: { oddFooter: "&LBTI | Laporan presensi&CWIB (UTC+7)&RHalaman &P / &N" },
      views: [{ state: "frozen", ySplit: headerRow, xSplit: Math.min(3, headers.length), showGridLines: false }],
    });
    widths.forEach((width, index) => { ws.getColumn(index + 1).width = width; });
    // Identitas perusahaan pada bidang putih, dengan garis pemisah tipis.
    const company = merged(ws, 1, 1, headers.length, "CV BENGKEL TEKNOLOGI INDONESIA", WHITE);
    company.alignment = { horizontal: "center", vertical: "middle" };
    company.font = { name: "Calibri", size: 11, bold: true, color: { argb: NAVY } };
    company.border = { bottom: { style: "thin", color: { argb: LINE } } };
    ws.getRow(1).height = 30;
    const heading = merged(ws, 2, 1, headers.length, title);
    heading.font = { name: "Calibri", size: 16, bold: true, color: { argb: NAVY } };
    ws.getRow(2).height = 32;
    const context = merged(ws, 3, 1, headers.length, `Periode: ${input.period.label}   |   Cakupan: ${input.scope}`);
    context.font = { name: "Calibri", size: 10, color: { argb: TEXT } };
    ws.getRow(3).height = 24;
    const exported = merged(ws, 4, 1, headers.length, `Diekspor: ${formatTime(report.now.toISOString())}   |   Zona waktu: WIB`);
    exported.font = { name: "Calibri", size: 9, color: { argb: MUTED } };
    ws.getRow(4).height = 20;
    ws.getRow(5).height = 12;
    ws.getRow(headerRow).values = headers;
    ws.getRow(headerRow).height = name === "Rekap Mingguan" ? 42 : 36;
    ws.getRow(headerRow).eachCell((cell) => {
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { right: { style: "hair", color: { argb: "FF6B8297" } } };
    });
    return ws;
  }

  function body(ws: Worksheet, values: CellValue[], statusColumn?: number, code?: Code) {
    const row = ws.addRow(values);
    row.height = 26;
    row.eachCell({ includeEmpty: true }, (cell, index) => {
      cell.font = { name: "Calibri", size: 10, color: { argb: TEXT } };
      cell.alignment = { vertical: "middle", wrapText: true, indent: 1, horizontal: typeof cell.value === "number" ? "right" : "left" };
      cell.border = { bottom: { style: "hair", color: { argb: LINE } } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: row.number % 2 === 0 ? STRIPE : WHITE } };
      if (index === statusColumn && code) paintStatus(cell, code);
    });
    const lines = values.reduce<number>((maximum, value, index) => {
      if (typeof value !== "string") return maximum;
      const width = ws.getColumn(index + 1).width ?? 12;
      return Math.max(maximum, ...value.split("\n").map((part) => Math.ceil(part.length / Math.max(4, width))));
    }, 1);
    row.height = Math.max(26, lines * 14 + 8);
    return row;
  }

  function paintStatus(cell: ReturnType<Worksheet["getCell"]>, code: Code) {
    const present = code === "H" || code === "LH";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: present ? "FFE6EDF3" : (Number(cell.row) % 2 === 0 ? STRIPE : WHITE) } };
    cell.font = { name: "Calibri", size: 10, bold: present, color: { argb: code === "—" || code === "PR" ? MUTED : ACCENT } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }

  function finish(ws: Worksheet, headerRow: number, lastDataRow: number) {
    if (ws.rowCount === headerRow) {
      merged(ws, headerRow + 1, 1, ws.columnCount, ws.name === "Percobaan Ditolak" ? "Tidak ada percobaan presensi ditolak pada periode ini." : "Tidak ada data pada periode ini.");
      ws.getRow(headerRow + 1).height = 28;
    }
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: Math.max(headerRow, lastDataRow), column: ws.columnCount } };
    ws.pageSetup.printArea = `A1:${ws.getColumn(ws.columnCount).letter}${ws.rowCount}`;
  }

  const weekly = input.period.mode === "minggu";
  const matrixLabels: Record<Code, string> = {
    H: "Hadir", P: "Belum lengkap", TC: "Tidak tercatat", L: "Libur",
    LH: "Hadir (libur)", LP: "Belum lengkap (libur)", "V?": "Perlu ditinjau",
    PR: "Hari berjalan", "—": "Belum berlangsung",
  };
  const matrixHeaders = ["No.", "NIK", "Nama teknisi", ...report.schedule.map((day) => `${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "short" }).format(new Date(parseDay(day.day)))}\n${formatDay(day.day, true)}`), "Total\nKehadiran", "Presensi\nsebagian", "Tidak\ntercatat", "Hari\nlibur"];
  const summaryHeaders = weekly ? matrixHeaders : ["No.", "NIK", "Nama teknisi", "Total Kehadiran", "Presensi sebagian", "Tidak tercatat", "Hari libur"];
  const summary = base(weekly ? "Rekap Mingguan" : "Rekap Teknisi", weekly ? "REKAP PRESENSI MINGGUAN" : "REKAP PRESENSI", summaryHeaders,
    weekly ? [5, 16, 26, ...Array(6).fill(12), 13, 12, 12, 10] : [6, 18, 32, 20, 20, 20, 20], 11);

  const totalAttendance = report.summaries.reduce((total, row) => total + row.attendance, 0);
  const totalPartial = report.summaries.reduce((total, row) => total + row.partial, 0);
  const totalMissing = report.summaries.reduce((total, row) => total + row.missing, 0);
  const boxes = weekly ? [[1, 3], [4, 6], [7, 9], [10, 13]] : [[1, 2], [3, 4], [5, 6], [7, 7]];
  const kpis: [string, number][] = [["TEKNISI", report.summaries.length], ["TOTAL KEHADIRAN", totalAttendance], ["PERLU DILENGKAPI", totalPartial], ["HARI LIBUR", report.schedule.filter((row) => row.holiday).length]];
  boxes.forEach(([first, last], index) => {
    const label = merged(summary, 6, first, last, kpis[index][0], LIGHT);
    label.font = { name: "Calibri", size: 9, bold: true, color: { argb: MUTED } };
    label.alignment = { horizontal: "left", vertical: "middle", indent: 1, wrapText: true };
    const value = merged(summary, 7, first, last, kpis[index][1], LIGHT);
    value.font = { name: "Calibri", size: 18, bold: true, color: { argb: NAVY } };
    value.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  });
  summary.getRow(6).height = 24;
  summary.getRow(7).height = 30;
  summary.getRow(8).height = 10;
  const holidayLabel = report.schedule.filter((row) => row.holiday).map((row) => `${formatDay(row.day, true)}: ${row.reason}`).join("; ") || "Tidak ada hari libur pada periode ini.";
  const holidays = merged(summary, 9, 1, summaryHeaders.length, `Hari libur: ${holidayLabel}`);
  holidays.font = { name: "Calibri", size: 9, color: { argb: MUTED } };
  summary.getRow(9).height = Math.max(28, Math.ceil(holidayLabel.length / (weekly ? 150 : 100)) * 16);
  summary.getRow(10).height = 10;
  report.summaries.forEach((item, index) => {
    const row = body(summary, [index + 1, item.person.nik ?? "", item.person.nama_lengkap ?? "", ...(weekly ? item.codes.map((code) => matrixLabels[code]) : []), item.attendance, item.partial, item.missing, item.holidays]);
    row.getCell(2).numFmt = "@";
    if (weekly) item.codes.forEach((code, column) => paintStatus(row.getCell(column + 4), code));

  });
  if (!report.summaries.length) {
    merged(summary, 12, 1, summaryHeaders.length, "Tidak ada teknisi dalam cakupan laporan.");
    summary.getRow(12).height = 28;
  }
  const lastSummary = summary.rowCount;
  const totalRow = summary.rowCount + 1;
  merged(summary, totalRow, 1, weekly ? 9 : 3, "REKAP PERIODE");
  const firstNumeric = weekly ? 10 : 4;
  const totals = [totalAttendance, totalPartial, totalMissing];
  totals.forEach((result, index) => {
    const cell = summary.getCell(totalRow, firstNumeric + index);
    const letter = cell.col;
    const column = summary.getColumn(letter).letter;
    cell.value = report.summaries.length ? { formula: `SUM(${column}12:${column}${lastSummary})`, result } : 0;
    cell.numFmt = "0";
  });
  summary.getCell(totalRow, summaryHeaders.length).value = report.schedule.filter((row) => row.holiday).length;
  summary.getRow(totalRow).height = 28;
  summary.getRow(totalRow).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6EDF3" } };
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: NAVY } };
    cell.alignment = { horizontal: typeof cell.value === "string" ? "left" : "right", vertical: "middle", indent: 1 };
    cell.border = { top: { style: "thin", color: { argb: "FFBCCAD6" } } };
  });
  const noteRow = totalRow + 3;
  merged(summary, noteRow, 1, 3, "Disiapkan oleh");
  merged(summary, noteRow, summaryHeaders.length - 2, summaryHeaders.length, "Diperiksa oleh");
  summary.getRow(noteRow + 1).height = 42;
  merged(summary, noteRow + 2, 1, 3, "Nama / tanda tangan");
  merged(summary, noteRow + 2, summaryHeaders.length - 2, summaryHeaders.length, "Nama / tanda tangan");
  finish(summary, 11, report.summaries.length ? lastSummary : 11);

  const daily = base("Rekap Harian", "REKAP PRESENSI HARIAN", ["Tanggal", "NIK", "Nama teknisi", "Masuk WIB", "Pulang WIB", "Status", "Keterangan hari", "Log valid / total"], [14, 18, 30, 14, 14, 29, 38, 16]);
  report.daily.sort((a, b) => a.day.localeCompare(b.day) || (a.person.nama_lengkap ?? "").localeCompare(b.person.nama_lengkap ?? "", "id"));
  report.daily.forEach((item) => {
    const row = body(daily, [serial(parseDay(item.day)), item.person.nik ?? "", item.person.nama_lengkap ?? "", serial(item.masuk), serial(item.pulang), matrixLabels[item.code], item.reason, `${item.valid} / ${item.logs}`], 6, item.code);
    row.getCell(1).numFmt = "dd/mm/yyyy";
    row.getCell(2).numFmt = "@";
    row.getCell(4).numFmt = row.getCell(5).numFmt = "hh:mm:ss";
    row.height = Math.max(row.height ?? 26, 32);
  });
  finish(daily, 7, daily.rowCount);

  const details = base("Detail Presensi", "DETAIL LOG PRESENSI", ["Tanggal / waktu WIB", "NIK", "Nama teknisi", "Jenis", "Validasi", "Latitude", "Longitude", "ID Presensi", "ID Teknisi"], [24, 18, 32, 14, 22, 15, 15, 38, 38]);
  report.logs.forEach((log) => {
    const person = report.people.get(String(log.id_teknisi))!;
    const row = body(details, [serial(log.waktu_log), person.nik ?? "", person.nama_lengkap ?? "", log.tipe_log ?? "", log.is_valid === true ? "Valid" : log.is_valid === false ? "Tidak valid" : "Belum diketahui", log.latitude_aktual, log.longitude_aktual, String(log.id_absen), String(log.id_teknisi)]);
    row.getCell(1).numFmt = "dd/mm/yyyy hh:mm:ss";
    row.getCell(2).numFmt = "@";
    row.getCell(6).numFmt = row.getCell(7).numFmt = "0.000000";
    row.height = Math.max(row.height ?? 26, 30);
  });
  finish(details, 7, details.rowCount);

  const rejected = base("Percobaan Ditolak", "PENOLAKAN PRESENSI", ["Waktu WIB", "NIK", "Nama teknisi", "Jenis", "Hasil", "Alasan", "Latitude", "Longitude", "Akurasi (m)", "Usia lokasi (ms)", "Jarak (m)", "Lokasi palsu", "ID Audit"], [24, 18, 30, 14, 16, 45, 15, 15, 13, 15, 13, 14, 38]);
  report.audits.forEach((audit) => {
    const person = report.people.get(String(audit.technician_id))!;
    const row = body(rejected, [serial(audit.created_at), person.nik ?? "", person.nama_lengkap ?? "", audit.attendance_type ?? "", audit.result, audit.reason ?? "", audit.latitude, audit.longitude, audit.accuracy_meters, audit.location_age_ms, audit.distance_meters, audit.is_mock === null ? "Belum diketahui" : audit.is_mock ? "Ya" : "Tidak", String(audit.id_audit)]);
    row.getCell(1).numFmt = "dd/mm/yyyy hh:mm:ss";
    row.getCell(2).numFmt = "@";
    row.getCell(7).numFmt = row.getCell(8).numFmt = "0.000000";
    row.height = Math.max(row.height ?? 26, 44);
  });
  finish(rejected, 7, rejected.rowCount);

  const calendar = base("Hari Kerja dan Libur", "PENGATURAN HARI LAPORAN", ["Tanggal", "Hari", "Jenis hari", "Keterangan", "Sumber pengaturan", "Terakhir diubah WIB"], [16, 16, 18, 42, 30, 26]);
  const manual = new Map(input.holidays.map((row) => [row.day, row]));
  report.schedule.forEach((item) => {
    const row = body(calendar, [serial(parseDay(item.day)), new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "long" }).format(new Date(parseDay(item.day))), item.holiday ? "Libur" : "Hari kerja", item.reason, manual.has(item.day) ? "Ditetapkan admin" : "Jadwal Senin–Sabtu", serial(manual.get(item.day)?.updated_at ?? null)]);
    row.getCell(1).numFmt = "dd/mm/yyyy";
    row.getCell(6).numFmt = "dd/mm/yyyy hh:mm:ss";
    row.height = Math.max(row.height ?? 26, 30);
  });
  finish(calendar, 7, calendar.rowCount);
  return workbook;
}

export async function downloadAttendanceReport(input: ReportInput) {
  const workbook = await createAttendanceWorkbook(input);
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = new Uint8Array(buffer);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `BTI_Rekap_${input.period.mode}_${input.period.key}_${input.scope === "Semua teknisi" ? "semua" : "teknisi"}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
