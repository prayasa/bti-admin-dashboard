import type {
  Metadata,
  Viewport,
} from "next";
import type { ReactNode } from "react";

import { PwaRegister } from "@/components/staff/pwa-register";

export const metadata: Metadata = {
  title: "Presensi Teknisi",
  description:
    "Aplikasi web presensi terbatas untuk teknisi BTI pada perangkat iOS.",
  applicationName: "BTI Staff",
  manifest: "/manifest.webmanifest",
  formatDetection: {
    telephone: false,
  },
  appleWebApp: {
    capable: true,
    title: "BTI Staff",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      {
        url: "/staff-icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/staff-icon.svg",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: "#fafafa",
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: "#09090b",
    },
  ],
};

interface StaffLayoutProps {
  children: ReactNode;
}

export default function StaffLayout({
  children,
}: StaffLayoutProps) {
  return (
    <>
      <PwaRegister />
      {children}
    </>
  );
}
