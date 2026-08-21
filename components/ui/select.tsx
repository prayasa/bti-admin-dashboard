"use client";

import type { ComponentProps } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import * as SelectPrimitive from "@radix-ui/react-select";

import { cn } from "@/lib/utils";

type SelectProps = ComponentProps<
  typeof SelectPrimitive.Root
>;

function Select(props: SelectProps) {
  return (
    <SelectPrimitive.Root
      data-slot="select"
      {...props}
    />
  );
}

type SelectGroupProps = ComponentProps<
  typeof SelectPrimitive.Group
>;

function SelectGroup(props: SelectGroupProps) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      {...props}
    />
  );
}

type SelectValueProps = ComponentProps<
  typeof SelectPrimitive.Value
>;

function SelectValue(props: SelectValueProps) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      {...props}
    />
  );
}

type SelectTriggerProps = ComponentProps<
  typeof SelectPrimitive.Trigger
> & {
  size?: "sm" | "default";
};

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit min-w-32 items-center justify-between gap-2",
        "rounded-md border border-input bg-background px-3",
        "text-sm text-foreground",
        "transition-colors outline-none",
        "hover:bg-muted/30",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[placeholder]:text-muted-foreground",
        "data-[size=default]:h-9",
        "data-[size=sm]:h-8 data-[size=sm]:text-xs",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}

      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

type SelectContentProps = ComponentProps<
  typeof SelectPrimitive.Content
>;

function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "relative z-50",
          "max-h-[min(20rem,var(--radix-select-content-available-height))]",
          "min-w-40 overflow-hidden",
          "rounded-md border border-border",
          "bg-popover text-popover-foreground",
          "shadow-md",
          "transition-opacity duration-150",
          "data-[state=closed]:opacity-0",
          "data-[state=open]:opacity-100",
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />

        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>

        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

type SelectLabelProps = ComponentProps<
  typeof SelectPrimitive.Label
>;

function SelectLabel({
  className,
  ...props
}: SelectLabelProps) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        "px-2 py-1.5",
        "text-xs font-semibold text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

type SelectItemProps = ComponentProps<
  typeof SelectPrimitive.Item
>;

function SelectItem({
  className,
  children,
  ...props
}: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex min-h-8 w-full cursor-default",
        "select-none items-center rounded-sm",
        "py-1.5 pr-8 pl-2 text-sm outline-none",
        "transition-colors",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>
        {children}
      </SelectPrimitive.ItemText>

      <span className="absolute right-2 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check
            className="size-3.5 text-primary"
            aria-hidden="true"
          />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

type SelectSeparatorProps = ComponentProps<
  typeof SelectPrimitive.Separator
>;

function SelectSeparator({
  className,
  ...props
}: SelectSeparatorProps) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn(
        "-mx-1 my-1 h-px bg-border",
        className,
      )}
      {...props}
    />
  );
}

type SelectScrollUpButtonProps = ComponentProps<
  typeof SelectPrimitive.ScrollUpButton
>;

function SelectScrollUpButton({
  className,
  ...props
}: SelectScrollUpButtonProps) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "flex h-7 cursor-default items-center justify-center bg-popover",
        className,
      )}
      {...props}
    >
      <ChevronUp
        className="size-4"
        aria-hidden="true"
      />
    </SelectPrimitive.ScrollUpButton>
  );
}

type SelectScrollDownButtonProps = ComponentProps<
  typeof SelectPrimitive.ScrollDownButton
>;

function SelectScrollDownButton({
  className,
  ...props
}: SelectScrollDownButtonProps) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "flex h-7 cursor-default items-center justify-center bg-popover",
        className,
      )}
      {...props}
    >
      <ChevronDown
        className="size-4"
        aria-hidden="true"
      />
    </SelectPrimitive.ScrollDownButton>
  );
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};