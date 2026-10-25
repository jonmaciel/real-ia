import type { MetadataRoute } from "next";
import { siteDescription } from "@/lib/seo";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Morada — Encontre seu lugar", short_name: "Morada", description: siteDescription,
    lang: "pt-BR", start_url: "/", scope: "/", display: "standalone",
    background_color: "#ffffff", theme_color: "#c4470a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
