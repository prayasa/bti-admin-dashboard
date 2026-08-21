import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Riwayat Presensi",
  description:
    "Pemantauan riwayat kehadiran, validasi geofence, dan anomali presensi teknisi BTI.",
};

interface AttendanceLayoutProps {
  children: ReactNode;
}

export default function AttendanceLayout({
  children,
}: AttendanceLayoutProps) {
  return children;
}