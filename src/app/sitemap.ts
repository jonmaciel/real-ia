import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return process.env.DEMO_MODE === "true"
    ? []
    : [
        {
          url: process.env.APP_URL ?? "http://localhost:3001",
          changeFrequency: "weekly",
        },
      ];
}
