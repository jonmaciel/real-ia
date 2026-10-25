import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  return process.env.DEMO_MODE === "true"
    ? []
    : [
        {
          url: absoluteUrl("/"),
          changeFrequency: "weekly",
        },
        { url: absoluteUrl("/privacidade"), changeFrequency: "monthly" },
      ];
}
