"use client";

import type { ReactNode } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/providers/theme-provider";

type AppProvidersProps = Readonly<{
  children: ReactNode;
}>;

function GlobalToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="top-right"
      visibleToasts={4}
      duration={4000}
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            "border-border bg-popover text-popover-foreground shadow-sm",
          title: "font-medium text-foreground",
          description: "text-muted-foreground",
          actionButton:
            "bg-primary text-primary-foreground hover:bg-primary/90",
          cancelButton:
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          closeButton:
            "border-border bg-background text-muted-foreground hover:text-foreground",
        },
      }}
    />
  );
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      disableTransitionOnChange
      storageKey="bti-ui-theme"
    >
      <TooltipPrimitive.Provider
        delayDuration={350}
        skipDelayDuration={100}
      >
        {children}
        <GlobalToaster />
      </TooltipPrimitive.Provider>
    </ThemeProvider>
  );
}