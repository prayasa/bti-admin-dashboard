import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: {
    default: "Dashboard Admin",
    template: "%s | BTI Admin",
  },
  description:
    "Dashboard operasional CV Bengkel Teknologi Indonesia untuk mengelola teknisi, presensi, penugasan, QR, dan pemetaan.",
  robots: {
    index: false,
    follow: false,
  },
};

interface AdminLayoutProps {
  children: ReactNode;
}

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return <AdminShell>{children}</AdminShell>;
}