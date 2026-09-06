"use client";

import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

export interface MapLayerVisibility {
  office: boolean;
  attendance: boolean;
  activeAssignments: boolean;
  completedAssignments: boolean;
  liveTechnicians: boolean;
}

export type MapLayerKey = keyof MapLayerVisibility;

interface MapLegendProps {
  visibility: MapLayerVisibility;
  counts: {
    attendance: number;
    activeAssignments: number;
    completedAssignments: number;
    liveTechnicians: number;
  };
  onToggle: (layer: MapLayerKey) => void;
}

const legendItems: Array<{
  key: MapLayerKey;
  label: string;
  count?: keyof MapLegendProps["counts"];
  dotClassName: string;
}> = [
  {
    key: "office",
    label: "Kantor dan geofence",
    dotClassName: "border-blue-700 bg-blue-600",
  },
  {
    key: "liveTechnicians",
    label: "Posisi teknisi live",
    count: "liveTechnicians",
    dotClassName: "border-cyan-700 bg-cyan-500",
  },
  {
    key: "attendance",
    label: "Presensi hari ini",
    count: "attendance",
    dotClassName: "border-violet-700 bg-violet-500",
  },
  {
    key: "activeAssignments",
    label: "Tugas aktif",
    count: "activeAssignments",
    dotClassName: "border-amber-700 bg-amber-500",
  },
  {
    key: "completedAssignments",
    label: "Tugas selesai",
    count: "completedAssignments",
    dotClassName: "border-emerald-700 bg-emerald-500",
  },
];

export function MapLegend({
  visibility,
  counts,
  onToggle,
}: MapLegendProps) {
  return (
    <div className="space-y-1">
      {legendItems.map((item) => {
        const isVisible = visibility[item.key];
        const count = item.count ? counts[item.count] : null;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            aria-pressed={isVisible}
            className={cn(
              "flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors",
              isVisible
                ? "border-border bg-background text-foreground"
                : "border-transparent bg-muted/40 text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "size-3 shrink-0 rounded-full border",
                item.dotClassName,
                !isVisible && "opacity-30 grayscale",
              )}
              aria-hidden="true"
            />

            <span className="min-w-0 flex-1 text-sm font-medium">
              {item.label}
            </span>

            {count !== null ? (
              <span className="min-w-6 rounded bg-muted px-1.5 py-0.5 text-center text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            ) : null}

            {isVisible ? (
              <Eye
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            ) : (
              <EyeOff
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
