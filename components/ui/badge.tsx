import type { ComponentProps } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex h-5 shrink-0 items-center justify-center gap-1",
    "whitespace-nowrap rounded-full border px-2",
    "text-[11px] font-medium leading-none",
    "transition-colors",
    "[&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        outline:
          "border-border bg-background text-foreground",
        destructive:
          "border-transparent bg-destructive/10 text-destructive",
        success:
          "border-success/20 bg-success-muted text-success-muted-foreground",
        warning:
          "border-warning/20 bg-warning-muted text-warning-muted-foreground",
        info:
          "border-info/20 bg-info-muted text-info-muted-foreground",
        neutral:
          "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
  };

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: BadgeProps) {
  const Component = asChild ? Slot : "span";

  return (
    <Component
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };