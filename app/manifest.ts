import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BTI Staff",
    short_name: "BTI Staff",
    description:
      "Presensi teknisi CV Bengkel Teknologi Indonesia melalui QR dinamis dan geofencing.",
    start_url: "/staff",
    scope: "/staff/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#2563eb",
    lang: "id-ID",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/staff-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/staff-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
