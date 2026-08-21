"use client";

import {
  Check,
  Monitor,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ThemeValue = "light" | "dark" | "system";

type ThemeOption = {
  value: ThemeValue;
  label: string;
  description: string;
  icon: LucideIcon;
};

const themeOptions: ThemeOption[] = [
  {
    value: "light",
    label: "Mode terang",
    description: "Gunakan tampilan terang",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Mode gelap",
    description: "Gunakan tampilan gelap",
    icon: Moon,
  },
  {
    value: "system",
    label: "Ikuti sistem",
    description: "Sesuaikan dengan perangkat",
    icon: Monitor,
  },
];

export function ThemeToggle() {
  const {
    theme,
    resolvedTheme,
    setTheme,
  } = useTheme();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="Memuat pengaturan tema"
      >
        <Sun className="size-4" aria-hidden="true" />
      </Button>
    );
  }

  const CurrentThemeIcon =
    resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Ubah tema tampilan"
          title="Ubah tema tampilan"
        >
          <CurrentThemeIcon
            className="size-4"
            aria-hidden="true"
          />
          <span className="sr-only">
            Ubah tema tampilan
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56"
      >
        <DropdownMenuLabel>
          Tema tampilan
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = theme === option.value;

          return (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => setTheme(option.value)}
              className="h-auto min-h-10 py-2"
            >
              <Icon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">
                  {option.label}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {option.description}
                </span>
              </span>

              {isSelected ? (
                <Check
                  className="ml-auto size-4 text-primary"
                  aria-hidden="true"
                />
              ) : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}