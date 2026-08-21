import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type InputProps = ComponentProps<"input">;

function Input({
  className,
  type,
  ...props
}: InputProps) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(
        "h-9 w-full min-w-0 rounded-md",
        "border border-input bg-background",
        "px-3 py-1 text-sm text-foreground",
        "transition-colors outline-none",
        "placeholder:text-muted-foreground",
        "hover:border-foreground/20",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20",
        "disabled:pointer-events-none disabled:cursor-not-allowed",
        "disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "file:mr-3 file:border-0 file:bg-transparent",
        "file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };