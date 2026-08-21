"use client";

import {
  Clock3,
  CloudCheck,
  CloudOff,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type QrSyncStatus =
  | "syncing"
  | "synced"
  | "error";

type QrStatusPanelProps = {
  status: QrSyncStatus;
  countdown: number;
  refreshSeconds: number;
  isExpired: boolean;
  isGenerating: boolean;
  onRefresh: () => void;
};

const statusConfig = {
  syncing: {
    label: "Menyinkronkan",
    description:
      "Token baru sedang dikirim ke server.",
    badgeVariant: "info" as const,
    icon: LoaderCircle,
    iconClassName: "text-info",
  },
  synced: {
    label: "Tersinkronisasi",
    description:
      "QR aktif dan dikenali oleh server.",
    badgeVariant: "success" as const,
    icon: CloudCheck,
    iconClassName: "text-success",
  },
  error: {
    label: "Gagal tersinkron",
    description:
      "Server tidak menerima token terbaru.",
    badgeVariant: "destructive" as const,
    icon: CloudOff,
    iconClassName: "text-destructive",
  },
};

export function QrStatusPanel({
  status,
  countdown,
  refreshSeconds,
  isExpired,
  isGenerating,
  onRefresh,
}: QrStatusPanelProps) {
  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const progress = Math.max(
    0,
    Math.min(
      100,
      (countdown / refreshSeconds) * 100,
    ),
  );

  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            <StatusIcon
              className={cn(
                "size-4",
                config.iconClassName,
                status === "syncing" &&
                  "animate-spin",
              )}
              aria-hidden="true"
            />
          </span>

          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Status server
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {config.description}
            </p>
          </div>
        </div>

        <Badge variant={config.badgeVariant}>
          {config.label}
        </Badge>
      </div>

      <div className="my-4 h-px bg-border" />

      <div
        role="status"
        aria-live="polite"
        className="space-y-3"
      >
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock3
                className="size-3.5"
                aria-hidden="true"
              />
              Rotasi berikutnya
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Token berubah otomatis setiap{" "}
              {refreshSeconds} detik.
            </p>
          </div>

          <div className="shrink-0 text-right">
            <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums">
              {countdown}
            </span>
            <span className="ml-1 text-xs font-medium text-muted-foreground">
              detik
            </span>
          </div>
        </div>

        <div
          role="progressbar"
          aria-label="Waktu berlaku QR"
          aria-valuemin={0}
          aria-valuemax={refreshSeconds}
          aria-valuenow={countdown}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              isExpired
                ? "bg-destructive"
                : "bg-primary",
            )}
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        {isExpired ? (
          <p className="text-xs font-medium text-destructive">
            QR telah kedaluwarsa dan tidak boleh
            digunakan.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            QR hanya valid selama penghitung masih
            berjalan.
          </p>
        )}
      </div>

      <div className="mt-auto pt-5">
        <Button
          variant={
            status === "error"
              ? "destructive"
              : "outline"
          }
          size="sm"
          className="w-full"
          onClick={onRefresh}
          disabled={isGenerating}
        >
          <RefreshCw
            className={cn(
              isGenerating && "animate-spin",
            )}
            aria-hidden="true"
          />
          {isGenerating
            ? "Menyinkronkan..."
            : status === "error"
              ? "Coba sinkronkan ulang"
              : "Perbarui sekarang"}
        </Button>
      </div>
    </div>
  );
}