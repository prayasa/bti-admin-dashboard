import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopbar } from "@/components/admin/admin-topbar";

type AdminShellProps = Readonly<{
  children: ReactNode;
}>;

export function AdminShell({
  children,
}: AdminShellProps) {
  return (
    <div className="min-h-svh bg-background">
      <a
        href="#admin-main-content"
        className={[
          "fixed top-2 left-2 z-[100]",
          "-translate-y-20 rounded-md",
          "bg-primary px-3 py-2",
          "text-sm font-medium text-primary-foreground",
          "transition-transform",
          "focus:translate-y-0",
        ].join(" ")}
      >
        Lewati ke konten utama
      </a>

      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">
        <AdminSidebar />
      </div>

      <div className="flex min-h-svh min-w-0 flex-col lg:pl-64">
        <AdminTopbar />

        <main
          id="admin-main-content"
          className="min-w-0 flex-1 bg-background"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}