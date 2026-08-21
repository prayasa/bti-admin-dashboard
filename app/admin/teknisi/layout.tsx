import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Manajemen Teknisi",
  description:
    "Pengelolaan data dan akun teknisi CV Bengkel Teknologi Indonesia.",
};

interface TechnicianLayoutProps {
  children: ReactNode;
}

export default function TechnicianLayout({
  children,
}: TechnicianLayoutProps) {
  return children;
}