import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pemetaan dan Geofencing",
  description:
    "Pemantauan spasial lokasi penugasan dan presensi teknisi BTI.",
};

interface MappingLayoutProps {
  children: ReactNode;
}

export default function MappingLayout({
  children,
}: MappingLayoutProps) {
  return children;
}