"use client";

import type { ComponentProps } from "react";
import {
  Check,
  ChevronRight,
  Circle,
} from "lucide-react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";

import { cn } from "@/lib/utils";

type DropdownMenuProps = ComponentProps<
  typeof DropdownMenuPrimitive.Root
>;

function DropdownMenu(props: DropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root
      data-slot="dropdown-menu"
      {...props}
    />
  );
}

type DropdownMenuPortalProps = ComponentProps<
  typeof DropdownMenuPrimitive.Portal
>;

function DropdownMenuPortal(
  props: DropdownMenuPortalProps,
) {
  return (
    <DropdownMenuPrimitive.Portal
      data-slot="dropdown-menu-portal"
      {...props}
    />
  );
}

type DropdownMenuTriggerProps = ComponentProps<
  typeof DropdownMenuPrimitive.Trigger
>;

function DropdownMenuTrigger(
  props: DropdownMenuTriggerProps,
) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  );
}

type DropdownMenuContentProps = ComponentProps<
  typeof DropdownMenuPrimitive.Content
>;

function DropdownMenuContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 min-w-44 overflow-hidden",
          "rounded-md border border-border bg-popover p-1",
          "text-popover-foreground shadow-md",
          "transition-opacity duration-150",
          "data-[state=closed]:opacity-0",
          "data-[state=open]:opacity-100",
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

type DropdownMenuGroupProps = ComponentProps<
  typeof DropdownMenuPrimitive.Group
>;

function DropdownMenuGroup(
  props: DropdownMenuGroupProps,
) {
  return (
    <DropdownMenuPrimitive.Group
      data-slot="dropdown-menu-group"
      {...props}
    />
  );
}

type DropdownMenuItemProps = ComponentProps<
  typeof DropdownMenuPrimitive.Item
> & {
  inset?: boolean;
  destructive?: boolean;
};

function DropdownMenuItem({
  className,
  inset = false,
  destructive = false,
  ...props
}: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset || undefined}
      data-destructive={destructive || undefined}
      className={cn(
        "relative flex h-8 cursor-default select-none items-center gap-2",
        "rounded-sm px-2 text-sm outline-none",
        "transition-colors",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        "data-[inset=true]:pl-8",
        "data-[destructive=true]:text-destructive",
        "data-[destructive=true]:focus:bg-destructive/10",
        "data-[destructive=true]:focus:text-destructive",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

type DropdownMenuCheckboxItemProps = ComponentProps<
  typeof DropdownMenuPrimitive.CheckboxItem
>;

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: DropdownMenuCheckboxItemProps) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      checked={checked}
      className={cn(
        "relative flex min-h-8 cursor-default select-none items-center",
        "rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none",
        "transition-colors",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-3.5" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>

      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

type DropdownMenuRadioGroupProps = ComponentProps<
  typeof DropdownMenuPrimitive.RadioGroup
>;

function DropdownMenuRadioGroup(
  props: DropdownMenuRadioGroupProps,
) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  );
}

type DropdownMenuRadioItemProps = ComponentProps<
  typeof DropdownMenuPrimitive.RadioItem
>;

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: DropdownMenuRadioItemProps) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "relative flex min-h-8 cursor-default select-none items-center",
        "rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none",
        "transition-colors",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-4 items-center justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>

      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

type DropdownMenuLabelProps = ComponentProps<
  typeof DropdownMenuPrimitive.Label
> & {
  inset?: boolean;
};

function DropdownMenuLabel({
  className,
  inset = false,
  ...props
}: DropdownMenuLabelProps) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset || undefined}
      className={cn(
        "px-2 py-1.5 text-xs font-semibold text-foreground",
        "data-[inset=true]:pl-8",
        className,
      )}
      {...props}
    />
  );
}

type DropdownMenuSeparatorProps = ComponentProps<
  typeof DropdownMenuPrimitive.Separator
>;

function DropdownMenuSeparator({
  className,
  ...props
}: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn(
        "-mx-1 my-1 h-px bg-border",
        className,
      )}
      {...props}
    />
  );
}

type DropdownMenuShortcutProps =
  ComponentProps<"span">;

function DropdownMenuShortcut({
  className,
  ...props
}: DropdownMenuShortcutProps) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-[11px] tracking-widest text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

type DropdownMenuSubProps = ComponentProps<
  typeof DropdownMenuPrimitive.Sub
>;

function DropdownMenuSub(props: DropdownMenuSubProps) {
  return (
    <DropdownMenuPrimitive.Sub
      data-slot="dropdown-menu-sub"
      {...props}
    />
  );
}

type DropdownMenuSubTriggerProps = ComponentProps<
  typeof DropdownMenuPrimitive.SubTrigger
> & {
  inset?: boolean;
};

function DropdownMenuSubTrigger({
  className,
  inset = false,
  children,
  ...props
}: DropdownMenuSubTriggerProps) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset || undefined}
      className={cn(
        "flex h-8 cursor-default select-none items-center gap-2",
        "rounded-sm px-2 text-sm outline-none",
        "transition-colors",
        "focus:bg-accent focus:text-accent-foreground",
        "data-[state=open]:bg-accent",
        "data-[inset=true]:pl-8",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-4 text-muted-foreground" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

type DropdownMenuSubContentProps = ComponentProps<
  typeof DropdownMenuPrimitive.SubContent
>;

function DropdownMenuSubContent({
  className,
  collisionPadding = 8,
  ...props
}: DropdownMenuSubContentProps) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      collisionPadding={collisionPadding}
      className={cn(
        "z-50 min-w-40 overflow-hidden",
        "rounded-md border border-border bg-popover p-1",
        "text-popover-foreground shadow-md",
        "transition-opacity duration-150",
        "data-[state=closed]:opacity-0",
        "data-[state=open]:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
};