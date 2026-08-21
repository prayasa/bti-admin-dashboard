import Link from "next/link";
import {
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type StatCardTone =
  | "default"
  | "success"
  | "warning"
  | "info";

type StatCardProps = {
  title: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  tone?: StatCardTone;
  href?: string;
  linkLabel?: string;
  isLoading?: boolean;
};

const toneStyles: Record<
  StatCardTone,
  {
    iconContainer: string;
    icon: string;
  }
> = {
  default: {
    iconContainer: "bg-primary/10",
    icon: "text-primary",
  },
  success: {
    iconContainer: "bg-success-muted",
    icon: "text-success-muted-foreground",
  },
  warning: {
    iconContainer: "bg-warning-muted",
    icon: "text-warning-muted-foreground",
  },
  info: {
    iconContainer: "bg-info-muted",
    icon: "text-info-muted-foreground",
  },
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
  href,
  linkLabel = "Lihat detail",
  isLoading = false,
}: StatCardProps) {
  const styles = toneStyles[tone];

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {title}
        </CardTitle>

        <CardAction>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-md",
              styles.iconContainer,
            )}
          >
            <Icon
              className={cn("size-4", styles.icon)}
              strokeWidth={2}
              aria-hidden="true"
            />
          </span>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p
            className="text-2xl font-semibold tracking-tight text-foreground tabular-nums"
            aria-live="polite"
          >
            {value}
          </p>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>

        {href ? (
          <Link
            href={href}
            className={[
              "inline-flex items-center gap-1",
              "text-xs font-medium text-primary",
              "transition-colors hover:text-primary/80",
              "focus-visible:ring-[3px] focus-visible:ring-ring/20",
            ].join(" ")}
          >
            {linkLabel}
            <ArrowUpRight
              className="size-3"
              aria-hidden="true"
            />
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}