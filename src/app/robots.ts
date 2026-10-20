import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return {
    rules:
      process.env.DEMO_MODE === "true"
        ? { userAgent: "*", disallow: "/" }
        : {
            userAgent: "*",
            allow: "/",
            disallow: ["/admin", "/conta", "/auth/", "/api/", "/buscar"],
          },
    sitemap: `${process.env.APP_URL ?? "http://localhost:3001"}/sitemap.xml`,
  };
}
