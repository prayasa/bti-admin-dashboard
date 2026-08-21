import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "QR Dinamis",
  description:
    "Generator QR dinamis untuk proses presensi teknisi BTI.",
};

interface QrLayoutProps {
  children: ReactNode;
}

export default function QrLayout({
  children,
}: QrLayoutProps) {
  return children;
}