import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminPageSkeletonProps {
  showStats?: boolean;
  statCount?: number;
  rowCount?: number;
}

export function AdminPageSkeleton({
  showStats = true,
  statCount = 4,
  rowCount = 6,
}: AdminPageSkeletonProps) {
  return (
    <div
      className="page-container space-y-6"
      aria-label="Memuat halaman"
      aria-busy="true"
    >
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>

        <Skeleton className="h-9 w-28" />
      </div>

      {showStats ? (
        <div
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          aria-hidden="true"
        >
          {Array.from({ length: statCount }).map((_, index) => (
            <Card key={index}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 w-14" />
                </div>

                <Skeleton className="size-9 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-72 max-w-full" />
            </div>

            <div className="flex gap-2">
              <Skeleton className="h-9 w-56 max-w-full" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <div className="grid grid-cols-12 gap-4 bg-muted/30 px-4 py-3">
              <Skeleton className="col-span-3 h-3" />
              <Skeleton className="col-span-4 h-3" />
              <Skeleton className="col-span-2 h-3" />
              <Skeleton className="col-span-2 h-3" />
              <Skeleton className="col-span-1 h-3" />
            </div>

            {Array.from({ length: rowCount }).map((_, index) => (
              <div
                key={index}
                className="grid min-h-16 grid-cols-12 items-center gap-4 px-4 py-3"
              >
                <div className="col-span-3 space-y-2">
                  <Skeleton className="h-4 w-32 max-w-full" />
                  <Skeleton className="h-3 w-20" />
                </div>

                <div className="col-span-4 space-y-2">
                  <Skeleton className="h-4 w-48 max-w-full" />
                  <Skeleton className="h-3 w-full max-w-64" />
                </div>

                <Skeleton className="col-span-2 h-6 w-24" />
                <Skeleton className="col-span-2 h-4 w-20" />
                <Skeleton className="col-span-1 ml-auto size-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <span className="sr-only">
        Data dashboard sedang dimuat.
      </span>
    </div>
  );
}