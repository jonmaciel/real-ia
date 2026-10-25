import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  return {
    rules:
      process.env.DEMO_MODE === "true"
        ? { userAgent: "*", disallow: "/" }
        : {
            userAgent: "*",
            allow: "/",
            disallow: ["/admin", "/conta", "/auth/", "/api/", "/anunciar"],
          },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
