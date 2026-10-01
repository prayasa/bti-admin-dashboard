import { Clock3, MapPinCheck, RefreshCw, ScanLine, ShieldCheck, Info } from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { AttendanceNotifications } from "@/components/qr/attendance-notifications";
import { DynamicQrCard } from "@/components/qr/dynamic-qr-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const securitySteps = [
  {
    title: "Pindai melalui aplikasi",
    description: "Buka aplikasi teknisi BTI, pilih presensi masuk atau pulang, lalu pindai QR aktif.",
    icon: ScanLine,
  },
  {
    title: "Pastikan lokasi sesuai",
    description: "Aktifkan izin lokasi dan lakukan presensi di dalam radius lokasi kantor.",
    icon: MapPinCheck,
  },
  {
    title: "Periksa hasil presensi",
    description: "Pastikan aplikasi teknisi menampilkan presensi berhasil. Aktivitas terbaru akan muncul di panel admin.",
    icon: ShieldCheck,
  },
];

const securityParameters = [
  { label: "Masa berlaku", value: "30 detik", icon: Clock3 },
  { label: "Koreksi QR", value: "Level H", icon: ScanLine },
  { label: "Sinkronisasi", value: "Supabase", icon: ShieldCheck },
];

export default function QrPage() {
  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="QR Presensi Dinamis"
        description="Tampilkan QR pada perangkat kantor. Pantau presensi masuk dan pulang melalui panel aktivitas terbaru."
        actions={<Badge variant="info"><RefreshCw aria-hidden="true" />Rotasi 30 detik</Badge>}
      />

      {/* Independent column stacks prevent the QR card stretching with the sidebar. */}
      <div className="grid grid-cols-1 items-start gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.8fr)]">
        <div className="min-w-0 space-y-4">
          <DynamicQrCard />

          <Card>
            <CardHeader className="flex flex-col gap-1">
              <CardTitle className="leading-snug">Panduan presensi</CardTitle>
              <CardDescription>Tiga langkah untuk membantu teknisi melakukan presensi dengan benar.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {securitySteps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="min-w-0 rounded-lg border border-border bg-muted/15 p-3">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background"><Icon className="size-4 text-muted-foreground" aria-hidden="true" /></span>
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">0{index + 1}</span>
                      </div>
                      <p className="text-sm font-medium leading-snug">{step.title}</p>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 flex items-start gap-2 rounded-md bg-muted/30 p-3">
                <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-xs leading-relaxed text-muted-foreground">Jika QR kedaluwarsa, tunggu kode berikutnya atau pilih <span className="font-medium text-foreground">Perbarui sekarang</span>. Gunakan QR yang sedang tampil pada layar.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <AttendanceNotifications />

          <Card>
            <CardHeader className="flex flex-col gap-1">
              <CardTitle className="leading-snug">Parameter keamanan</CardTitle>
              <CardDescription>Konfigurasi QR yang sedang digunakan.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="divide-y divide-border">
                {securityParameters.map((parameter) => {
                  const Icon = parameter.icon;
                  return (
                    <div key={parameter.label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <dt className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5 shrink-0" aria-hidden="true" />{parameter.label}</dt>
                      <dd className="shrink-0 text-xs font-semibold">{parameter.value}</dd>
                    </div>
                  );
                })}
              </dl>
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-medium">Menunggu presensi terbaru?</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Tetap buka halaman ini untuk menerima notifikasi. Gunakan tombol <span className="font-medium text-foreground">Lihat kehadiran</span> untuk memeriksa catatan lengkap.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
