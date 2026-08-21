"use client";

import type { ComponentProps } from "react";
import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  cva,
  type VariantProps,
} from "class-variance-authority";

import { cn } from "@/lib/utils";

type SheetProps = ComponentProps<
  typeof DialogPrimitive.Root
>;

function Sheet(props: SheetProps) {
  return (
    <DialogPrimitive.Root
      data-slot="sheet"
      {...props}
    />
  );
}

type SheetTriggerProps = ComponentProps<
  typeof DialogPrimitive.Trigger
>;

function SheetTrigger(props: SheetTriggerProps) {
  return (
    <DialogPrimitive.Trigger
      data-slot="sheet-trigger"
      {...props}
    />
  );
}

type SheetCloseProps = ComponentProps<
  typeof DialogPrimitive.Close
>;

function SheetClose(props: SheetCloseProps) {
  return (
    <DialogPrimitive.Close
      data-slot="sheet-close"
      {...props}
    />
  );
}

type SheetPortalProps = ComponentProps<
  typeof DialogPrimitive.Portal
>;

function SheetPortal(props: SheetPortalProps) {
  return (
    <DialogPrimitive.Portal
      data-slot="sheet-portal"
      {...props}
    />
  );
}

type SheetOverlayProps = ComponentProps<
  typeof DialogPrimitive.Overlay
>;

function SheetOverlay({
  className,
  ...props
}: SheetOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-slate-950/45",
        "transition-opacity duration-200",
        "data-[state=closed]:opacity-0",
        "data-[state=open]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

const sheetVariants = cva(
  [
    "fixed z-[51] flex flex-col bg-background",
    "transition-transform duration-200 ease-out",
    "focus:outline-none",
  ],
  {
    variants: {
      side: {
        top: [
          "inset-x-0 top-0 max-h-[85svh]",
          "border-b border-border",
          "data-[state=closed]:-translate-y-full",
          "data-[state=open]:translate-y-0",
        ],
        bottom: [
          "inset-x-0 bottom-0 max-h-[85svh]",
          "border-t border-border",
          "data-[state=closed]:translate-y-full",
          "data-[state=open]:translate-y-0",
        ],
        left: [
          "inset-y-0 left-0 h-full",
          "w-[min(20rem,88vw)]",
          "border-r border-border",
          "data-[state=closed]:-translate-x-full",
          "data-[state=open]:translate-x-0",
        ],
        right: [
          "inset-y-0 right-0 h-full",
          "w-[min(20rem,88vw)]",
          "border-l border-border",
          "data-[state=closed]:translate-x-full",
          "data-[state=open]:translate-x-0",
        ],
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

type SheetContentProps = ComponentProps<
  typeof DialogPrimitive.Content
> &
  VariantProps<typeof sheetVariants>;

function SheetContent({
  side = "right",
  className,
  children,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />

      <DialogPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          sheetVariants({ side }),
          className,
        )}
        {...props}
      >
        {children}

        <DialogPrimitive.Close
          className={cn(
            "absolute top-3 right-3",
            "inline-flex size-8 items-center justify-center",
            "rounded-md text-muted-foreground",
            "transition-colors",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:ring-[3px] focus-visible:ring-ring/20",
            "disabled:pointer-events-none",
          )}
          aria-label="Tutup panel"
        >
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </SheetPortal>
  );
}

type SheetHeaderProps = ComponentProps<"div">;

function SheetHeader({
  className,
  ...props
}: SheetHeaderProps) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex flex-col gap-1.5 border-b border-border p-4",
        className,
      )}
      {...props}
    />
  );
}

type SheetFooterProps = ComponentProps<"div">;

function SheetFooter({
  className,
  ...props
}: SheetFooterProps) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex flex-col-reverse gap-2",
        "border-t border-border p-4",
        "sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

type SheetTitleProps = ComponentProps<
  typeof DialogPrimitive.Title
>;

function SheetTitle({
  className,
  ...props
}: SheetTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "text-sm font-semibold text-foreground",
        className,
      )}
      {...props}
    />
  );
}

type SheetDescriptionProps = ComponentProps<
  typeof DialogPrimitive.Description
>;

function SheetDescription({
  className,
  ...props
}: SheetDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn(
        "text-xs leading-relaxed text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  sheetVariants,
};