import {
  Clock3,
  MapPinCheck,
  RefreshCw,
  ScanLine,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/admin/page-header";
import { DynamicQrCard } from "@/components/qr/dynamic-qr-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const securitySteps = [
  {
    title: "Pindai melalui aplikasi",
    description:
      "QR hanya digunakan melalui aplikasi teknisi BTI.",
    icon: ScanLine,
  },
  {
    title: "Validasi lokasi",
    description:
      "Koordinat perangkat diperiksa terhadap radius geofence.",
    icon: MapPinCheck,
  },
  {
    title: "Token sekali pakai",
    description:
      "Token lama akan ditolak setelah QR diperbarui.",
    icon: ShieldCheck,
  },
];

export default function QrPage() {
  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="QR Presensi Dinamis"
        description="Tampilkan QR ini pada perangkat internal untuk proses presensi teknisi yang tervalidasi server dan lokasi."
        actions={
          <Badge variant="info">
            <RefreshCw aria-hidden="true" />
            Rotasi 30 detik
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,2fr)_minmax(300px,0.8fr)]">
        <DynamicQrCard />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                Alur validasi
              </CardTitle>

              <CardDescription>
                Tiga lapisan pemeriksaan sebelum
                presensi diterima.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <ol className="space-y-4">
                {securitySteps.map(
                  (step, index) => {
                    const Icon = step.icon;

                    return (
                      <li
                        key={step.title}
                        className="flex items-start gap-3"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/30">
                          <Icon
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </span>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold tracking-wide text-muted-foreground">
                              0{index + 1}
                            </span>

                            <p className="text-sm font-medium text-foreground">
                              {step.title}
                            </p>
                          </div>

                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {step.description}
                          </p>
                        </div>
                      </li>
                    );
                  },
                )}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                Parameter keamanan
              </CardTitle>

              <CardDescription>
                Konfigurasi QR yang sedang
                digunakan.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-0">
              <div className="flex items-center justify-between gap-4 border-b border-border py-3 first:pt-0">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock3
                    className="size-3.5"
                    aria-hidden="true"
                  />
                  Masa berlaku
                </span>

                <span className="text-xs font-semibold text-foreground">
                  30 detik
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 border-b border-border py-3">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ScanLine
                    className="size-3.5"
                    aria-hidden="true"
                  />
                  Koreksi QR
                </span>

                <span className="text-xs font-semibold text-foreground">
                  Level H
                </span>
              </div>

              <div className="flex items-center justify-between gap-4 pt-3">
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck
                    className="size-3.5"
                    aria-hidden="true"
                  />
                  Sinkronisasi
                </span>

                <span className="text-xs font-semibold text-foreground">
                  Supabase
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}