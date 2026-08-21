"use client";

import type { ComponentProps } from "react";
import { X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import { cn } from "@/lib/utils";

type DialogProps = ComponentProps<
  typeof DialogPrimitive.Root
>;

function Dialog(props: DialogProps) {
  return (
    <DialogPrimitive.Root
      data-slot="dialog"
      {...props}
    />
  );
}

type DialogTriggerProps = ComponentProps<
  typeof DialogPrimitive.Trigger
>;

function DialogTrigger(
  props: DialogTriggerProps,
) {
  return (
    <DialogPrimitive.Trigger
      data-slot="dialog-trigger"
      {...props}
    />
  );
}

type DialogPortalProps = ComponentProps<
  typeof DialogPrimitive.Portal
>;

function DialogPortal(
  props: DialogPortalProps,
) {
  return (
    <DialogPrimitive.Portal
      data-slot="dialog-portal"
      {...props}
    />
  );
}

type DialogCloseProps = ComponentProps<
  typeof DialogPrimitive.Close
>;

function DialogClose(props: DialogCloseProps) {
  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      {...props}
    />
  );
}

type DialogOverlayProps = ComponentProps<
  typeof DialogPrimitive.Overlay
>;

function DialogOverlay({
  className,
  ...props
}: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
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

type DialogContentProps = ComponentProps<
  typeof DialogPrimitive.Content
> & {
  showCloseButton?: boolean;
};

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />

      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-[51]",
          "grid w-[calc(100%-2rem)] max-w-lg",
          "-translate-x-1/2 -translate-y-1/2",
          "gap-4 rounded-lg border border-border",
          "bg-background p-5 text-foreground",
          "shadow-md outline-none",
          "transition-[opacity,transform] duration-200",
          "data-[state=closed]:scale-[0.98]",
          "data-[state=closed]:opacity-0",
          "data-[state=open]:scale-100",
          "data-[state=open]:opacity-100",
          className,
        )}
        {...props}
      >
        {children}

        {showCloseButton ? (
          <DialogPrimitive.Close
            className={[
              "absolute top-3 right-3",
              "inline-flex size-8 items-center justify-center",
              "rounded-md text-muted-foreground",
              "transition-colors",
              "hover:bg-muted hover:text-foreground",
              "focus-visible:ring-[3px] focus-visible:ring-ring/20",
            ].join(" ")}
            aria-label="Tutup dialog"
          >
            <X
              className="size-4"
              aria-hidden="true"
            />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

type DialogHeaderProps =
  ComponentProps<"div">;

function DialogHeader({
  className,
  ...props
}: DialogHeaderProps) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-1.5 pr-8",
        className,
      )}
      {...props}
    />
  );
}

type DialogFooterProps =
  ComponentProps<"div">;

function DialogFooter({
  className,
  ...props
}: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2",
        "sm:flex-row sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

type DialogTitleProps = ComponentProps<
  typeof DialogPrimitive.Title
>;

function DialogTitle({
  className,
  ...props
}: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "text-base font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

type DialogDescriptionProps = ComponentProps<
  typeof DialogPrimitive.Description
>;

function DialogDescription({
  className,
  ...props
}: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm leading-relaxed text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};