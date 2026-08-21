import {
  CheckCircle2,
  ClipboardClock,
  MapPinCheck,
  Tickets,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

interface MapSummaryProps {
  totalAssignments: number;
  activeAssignments: number;
  completedAssignments: number;
  validAttendance: number;
}

const summaryItems = [
  {
    key: "totalAssignments",
    label: "Total tiket",
    icon: Tickets,
    iconClassName: "text-slate-600 dark:text-slate-300",
  },
  {
    key: "activeAssignments",
    label: "Tugas aktif",
    icon: ClipboardClock,
    iconClassName: "text-amber-600 dark:text-amber-400",
  },
  {
    key: "completedAssignments",
    label: "Tugas selesai",
    icon: CheckCircle2,
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "validAttendance",
    label: "Presensi valid",
    icon: MapPinCheck,
    iconClassName: "text-blue-600 dark:text-blue-400",
  },
] as const;

export function MapSummary({
  totalAssignments,
  activeAssignments,
  completedAssignments,
  validAttendance,
}: MapSummaryProps) {
  const values = {
    totalAssignments,
    activeAssignments,
    completedAssignments,
    validAttendance,
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summaryItems.map((item) => {
        const Icon = item.icon;

        return (
          <Card key={item.key}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>

                <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                  {values[item.key]}
                </p>
              </div>

              <div className="flex size-9 items-center justify-center rounded-md border border-border bg-muted/50">
                <Icon
                  className={`size-4 ${item.iconClassName}`}
                  aria-hidden="true"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}