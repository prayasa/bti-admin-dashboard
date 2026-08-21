"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import {
  adminNavigationGroups,
  isNavigationItemActive,
} from "@/config/admin-navigation";
import { cn } from "@/lib/utils";

type AdminSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function AdminSidebar({
  className,
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col",
        "border-r border-sidebar-border",
        "bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">
        <Link
          href="/admin"
          onClick={onNavigate}
          className={cn(
            "flex min-w-0 items-center gap-3 rounded-md",
            "focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/20",
          )}
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center",
              "rounded-md bg-sidebar-primary",
              "text-sidebar-primary-foreground",
            )}
          >
            <Wrench
              className="size-4.5"
              strokeWidth={2}
              aria-hidden="true"
            />
          </span>

          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-foreground">
              BTI Operations
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              Admin Console
            </span>
          </span>
        </Link>
      </div>

      <nav
        className="stable-scrollbar flex-1 overflow-y-auto px-3 py-4"
        aria-label="Navigasi utama admin"
      >
        <div className="space-y-5">
          {adminNavigationGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                {group.label}
              </p>

              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive =
                    isNavigationItemActive(
                      pathname,
                      item,
                    );

                  const Icon = item.icon;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        aria-current={
                          isActive ? "page" : undefined
                        }
                        title={item.description}
                        className={cn(
                          "relative flex h-9 items-center gap-3",
                          "rounded-md px-3",
                          "text-[13px] font-medium",
                          "outline-none transition-colors",
                          "focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/20",
                          isActive
                            ? [
                                "bg-sidebar-accent",
                                "text-sidebar-accent-foreground",
                              ]
                            : [
                                "text-sidebar-foreground",
                                "hover:bg-sidebar-accent/70",
                                "hover:text-sidebar-accent-foreground",
                              ],
                        )}
                      >
                        {isActive ? (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute inset-y-2 left-0",
                              "w-0.5 rounded-full",
                              "bg-sidebar-primary",
                            )}
                          />
                        ) : null}

                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            isActive
                              ? "text-sidebar-primary"
                              : "text-muted-foreground",
                          )}
                          strokeWidth={
                            isActive ? 2.2 : 1.8
                          }
                          aria-hidden="true"
                        />

                        <span className="truncate">
                          {item.title}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="shrink-0 px-3 pb-3">
        <Separator className="mb-3" />

        <div className="flex items-start gap-2.5 rounded-md border border-sidebar-border bg-background/50 p-3">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-success"
            aria-hidden="true"
          />

          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">
              Sistem internal
            </p>
            <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
              CV Bengkel Teknologi Indonesia
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}