"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import {
  QrStatusPanel,
  type QrSyncStatus,
} from "@/components/qr/qr-status-panel";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/src/utils/supabase";

const REFRESH_SECONDS = 30;
const REFRESH_INTERVAL_MS =
  REFRESH_SECONDS * 1000;

export function DynamicQrCard() {
  const [qrData, setQrData] = useState("");
  const [expiresAt, setExpiresAt] =
    useState(0);
  const [currentTime, setCurrentTime] =
    useState(0);

  const [syncStatus, setSyncStatus] =
    useState<QrSyncStatus>("syncing");

  const [isGenerating, setIsGenerating] =
    useState(false);

  const activeRef = useRef(false);
  const generatingRef = useRef(false);

  const generateNewToken =
    useCallback(async () => {
      if (generatingRef.current) {
        return;
      }

      generatingRef.current = true;

      if (activeRef.current) {
        setIsGenerating(true);
        setSyncStatus("syncing");
      }

      const issuedAt = Date.now();
      const tokenUuid = crypto.randomUUID();
      const payload = `${tokenUuid}|${issuedAt}`;

      try {
        const { error } = await supabase
          .from("qr_aktif")
          .upsert({
            id: 1,
            token: payload,
            updated_at: new Date(
              issuedAt,
            ).toISOString(),
          });

        if (error) {
          throw error;
        }

        if (!activeRef.current) {
          return;
        }

        setQrData(payload);
        setCurrentTime(issuedAt);
        setExpiresAt(
          issuedAt + REFRESH_INTERVAL_MS,
        );
        setSyncStatus("synced");
      } catch (error) {
        console.error(
          "Gagal menyinkronkan QR:",
          error,
        );

        if (activeRef.current) {
          setSyncStatus("error");
        }
      } finally {
        generatingRef.current = false;

        if (activeRef.current) {
          setIsGenerating(false);
        }
      }
    }, []);

  useEffect(() => {
    activeRef.current = true;
    setCurrentTime(Date.now());

    void generateNewToken();

    const rotationInterval =
      window.setInterval(() => {
        void generateNewToken();
      }, REFRESH_INTERVAL_MS);

    const timerInterval =
      window.setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);

    return () => {
      activeRef.current = false;

      window.clearInterval(rotationInterval);
      window.clearInterval(timerInterval);
    };
  }, [generateNewToken]);

  const countdown =
    expiresAt > 0
      ? Math.max(
          0,
          Math.ceil(
            (expiresAt - currentTime) / 1000,
          ),
        )
      : REFRESH_SECONDS;

  const isExpired =
    Boolean(qrData) && countdown <= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Kode presensi aktif
        </CardTitle>

        <CardDescription>
          Pindai menggunakan aplikasi teknisi BTI
          untuk melakukan presensi.
        </CardDescription>

        <CardAction>
          <Badge
            variant={
              syncStatus === "synced"
                ? "success"
                : syncStatus === "error"
                  ? "destructive"
                  : "info"
            }
          >
            {syncStatus === "synced"
              ? "Aktif"
              : syncStatus === "error"
                ? "Bermasalah"
                : "Menyiapkan"}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,1fr)_minmax(260px,0.8fr)]">
          <div className="flex min-h-80 items-center justify-center rounded-lg border border-border bg-muted/20 p-4">
            <div className="relative flex w-full max-w-72 items-center justify-center rounded-lg border border-slate-200 bg-white p-5">
              {qrData ? (
                <QRCodeSVG
                  value={qrData}
                  size={240}
                  level="H"
                  includeMargin={false}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  title="QR presensi dinamis BTI"
                  style={{
                    width: "100%",
                    height: "auto",
                    maxWidth: 240,
                  }}
                />
              ) : (
                <Skeleton className="aspect-square w-full max-w-60" />
              )}

              {isExpired ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/95 p-6 text-center">
                  <div>
                    <p className="text-sm font-semibold text-destructive">
                      QR kedaluwarsa
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">
                      Tunggu sinkronisasi berikutnya
                      atau perbarui secara manual.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <QrStatusPanel
            status={syncStatus}
            countdown={countdown}
            refreshSeconds={REFRESH_SECONDS}
            isExpired={isExpired}
            isGenerating={isGenerating}
            onRefresh={() =>
              void generateNewToken()
            }
          />
        </div>
      </CardContent>

      <CardFooter>
        <ShieldCheck
          className="size-4 shrink-0 text-success"
          aria-hidden="true"
        />

        <p className="text-xs leading-relaxed text-muted-foreground">
          Token baru ditampilkan setelah berhasil
          disimpan ke server. Jangan membagikan
          tangkapan layar QR kepada pihak lain.
        </p>
      </CardFooter>
    </Card>
  );
}