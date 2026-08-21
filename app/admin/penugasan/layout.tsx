import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Tiket Penugasan",
  description:
    "Pembuatan dan pengelolaan tiket pekerjaan teknisi lapangan BTI.",
};

interface AssignmentLayoutProps {
  children: ReactNode;
}

export default function AssignmentLayout({
  children,
}: AssignmentLayoutProps) {
  return children;
}