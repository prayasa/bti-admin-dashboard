"use client";

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type TechnicianListItem = {
  id: string;
  nama_lengkap: string;
  nik: string | null;
};

type TechnicianListProps = {
  technicians: TechnicianListItem[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
};

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return initials || "TK";
}

export function TechnicianList({
  technicians,
  selectedId,
  isLoading,
  onSelect,
}: TechnicianListProps) {
  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle>Daftar teknisi</CardTitle>

        <CardDescription>
          Pilih teknisi untuk melihat riwayat.
        </CardDescription>

        <CardAction>
          <Badge variant="neutral">
            {technicians.length} teknisi
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="px-0 [&:last-child]:pb-0">
        <div className="stable-scrollbar max-h-[calc(100svh-15rem)] overflow-y-auto border-t border-border">
          {isLoading ? (
            Array.from({
              length: 6,
            }).map((_, index) => (
              <div
                key={index}
                className="flex h-14 items-center gap-3 border-b border-border px-3 last:border-b-0"
              >
                <Skeleton className="size-8 rounded-full" />

                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))
          ) : technicians.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center px-4 text-center text-sm text-muted-foreground">
              Belum ada teknisi terdaftar.
            </div>
          ) : (
            technicians.map((technician) => {
              const isSelected =
                selectedId === technician.id;

              return (
                <button
                  key={technician.id}
                  type="button"
                  onClick={() =>
                    onSelect(technician.id)
                  }
                  aria-pressed={isSelected}
                  className={cn(
                    "relative flex min-h-14 w-full items-center gap-3",
                    "border-b border-border px-3 py-2 text-left",
                    "transition-colors last:border-b-0",
                    "focus-visible:z-10 focus-visible:ring-[3px] focus-visible:ring-ring/20",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/30",
                  )}
                >
                  {isSelected ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
                    />
                  ) : null}

                  <Avatar className="size-8">
                    <AvatarFallback
                      className={cn(
                        isSelected &&
                          "bg-primary/10 text-primary",
                      )}
                    >
                      {getInitials(
                        technician.nama_lengkap,
                      )}
                    </AvatarFallback>
                  </Avatar>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {technician.nama_lengkap}
                    </span>

                    <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
                      {technician.nik ||
                        "NIK belum tersedia"}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}