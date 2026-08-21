import type { LucideIcon } from "lucide-react";
import {
  ClipboardCheck,
  LayoutDashboard,
  MapPinned,
  QrCode,
  TicketCheck,
  UsersRound,
} from "lucide-react";

export type AdminNavigationItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type AdminNavigationGroup = {
  label: string;
  items: AdminNavigationItem[];
};

export const adminNavigationGroups: AdminNavigationGroup[] = [
  {
    label: "Ikhtisar",
    items: [
      {
        title: "Ringkasan",
        description: "Ringkasan aktivitas operasional",
        href: "/admin",
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    label: "Operasional",
    items: [
      {
        title: "QR Presensi",
        description: "Kelola QR presensi dinamis",
        href: "/admin/qr",
        icon: QrCode,
      },
      {
        title: "Kehadiran",
        description: "Riwayat dan validasi presensi",
        href: "/admin/presensi",
        icon: ClipboardCheck,
      },
      {
        title: "Penugasan",
        description: "Kelola tiket tugas teknisi",
        href: "/admin/penugasan",
        icon: TicketCheck,
      },
      {
        title: "Pemetaan",
        description: "Pantau lokasi dan geofencing",
        href: "/admin/pemetaan",
        icon: MapPinned,
      },
    ],
  },
  {
    label: "Data master",
    items: [
      {
        title: "Teknisi",
        description: "Kelola data teknisi lapangan",
        href: "/admin/teknisi",
        icon: UsersRound,
      },
    ],
  },
];

export function isNavigationItemActive(
  pathname: string,
  item: AdminNavigationItem,
): boolean {
  if (item.exact) {
    return pathname === item.href;
  }

  return (
    pathname === item.href ||
    pathname.startsWith(`${item.href}/`)
  );
}