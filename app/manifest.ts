import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/staff",
    name: "BTI Staff",
    short_name: "BTI Staff",
    description:
      "Presensi teknisi CV Bengkel Teknologi Indonesia melalui QR dinamis dan geofencing.",
    start_url: "/staff",
    scope: "/staff",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafafa",
    theme_color: "#2563eb",
    lang: "id-ID",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/staff-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/staff-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/staff-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
