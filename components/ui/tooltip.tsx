"use client";

import type { ComponentProps } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

type TooltipProviderProps = ComponentProps<
  typeof TooltipPrimitive.Provider
>;

function TooltipProvider({
  delayDuration = 350,
  skipDelayDuration = 100,
  ...props
}: TooltipProviderProps) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  );
}

type TooltipProps = ComponentProps<typeof TooltipPrimitive.Root>;

function Tooltip(props: TooltipProps) {
  return (
    <TooltipPrimitive.Root
      data-slot="tooltip"
      {...props}
    />
  );
}

type TooltipTriggerProps = ComponentProps<
  typeof TooltipPrimitive.Trigger
>;

function TooltipTrigger(props: TooltipTriggerProps) {
  return (
    <TooltipPrimitive.Trigger
      data-slot="tooltip-trigger"
      {...props}
    />
  );
}

type TooltipContentProps = ComponentProps<
  typeof TooltipPrimitive.Content
>;

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 max-w-72",
          "rounded-md border border-border",
          "bg-popover px-2.5 py-1.5 text-xs leading-relaxed",
          "text-popover-foreground shadow-sm",
          "transition-opacity duration-150",
          "data-[state=closed]:opacity-0",
          "data-[state=delayed-open]:opacity-100",
          "data-[state=instant-open]:opacity-100",
          className,
        )}
        {...props}
      >
        {children}

        <TooltipPrimitive.Arrow
          data-slot="tooltip-arrow"
          className="fill-popover"
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
};