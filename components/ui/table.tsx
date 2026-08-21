import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type TableProps = ComponentProps<"table">;

function Table({
  className,
  ...props
}: TableProps) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn(
          "w-full caption-bottom border-collapse text-sm",
          className,
        )}
        {...props}
      />
    </div>
  );
}

type TableHeaderProps =
  ComponentProps<"thead">;

function TableHeader({
  className,
  ...props
}: TableHeaderProps) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "border-b border-border bg-muted/30",
        "[&_tr]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

type TableBodyProps =
  ComponentProps<"tbody">;

function TableBody({
  className,
  ...props
}: TableBodyProps) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        "[&_tr:last-child]:border-b-0",
        className,
      )}
      {...props}
    />
  );
}

type TableFooterProps =
  ComponentProps<"tfoot">;

function TableFooter({
  className,
  ...props
}: TableFooterProps) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t border-border bg-muted/30",
        "font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

type TableRowProps = ComponentProps<"tr">;

function TableRow({
  className,
  ...props
}: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-border",
        "transition-colors",
        "hover:bg-muted/20",
        "data-[state=selected]:bg-muted/40",
        className,
      )}
      {...props}
    />
  );
}

type TableHeadProps = ComponentProps<"th">;

function TableHead({
  className,
  ...props
}: TableHeadProps) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 whitespace-nowrap px-3 text-left align-middle",
        "text-[11px] font-semibold tracking-wide",
        "text-muted-foreground uppercase",
        "[&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

type TableCellProps = ComponentProps<"td">;

function TableCell({
  className,
  ...props
}: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2 align-middle",
        "[&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

type TableCaptionProps =
  ComponentProps<"caption">;

function TableCaption({
  className,
  ...props
}: TableCaptionProps) {
  return (
    <caption
      data-slot="table-caption"
      className={cn(
        "mt-3 text-xs text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
};