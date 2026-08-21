import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type CardProps = ComponentProps<"div">;

function Card({
  className,
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex flex-col gap-4",
        "rounded-lg border border-border",
        "bg-card text-card-foreground",
        className,
      )}
      {...props}
    />
  );
}

type CardHeaderProps = ComponentProps<"div">;

function CardHeader({
  className,
  ...props
}: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto]",
        "items-start gap-x-4 gap-y-1",
        "px-4 pt-4",
        className,
      )}
      {...props}
    />
  );
}

type CardTitleProps = ComponentProps<"h3">;

function CardTitle({
  className,
  ...props
}: CardTitleProps) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        "col-start-1 row-start-1",
        "text-sm font-semibold leading-none text-foreground",
        className,
      )}
      {...props}
    />
  );
}

type CardDescriptionProps = ComponentProps<"p">;

function CardDescription({
  className,
  ...props
}: CardDescriptionProps) {
  return (
    <p
      data-slot="card-description"
      className={cn(
        "col-start-1 row-start-2",
        "text-xs leading-relaxed text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

type CardActionProps = ComponentProps<"div">;

function CardAction({
  className,
  ...props
}: CardActionProps) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1",
        "self-start justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

type CardContentProps = ComponentProps<"div">;

function CardContent({
  className,
  ...props
}: CardContentProps) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "px-4",
        "[&:last-child]:pb-4",
        className,
      )}
      {...props}
    />
  );
}

type CardFooterProps = ComponentProps<"div">;

function CardFooter({
  className,
  ...props
}: CardFooterProps) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "mt-auto flex items-center gap-2",
        "border-t border-border",
        "bg-muted/30 px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};