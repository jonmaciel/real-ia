import type { Metadata } from "next";
import type { Listing } from "./contracts";
import { money, period, propertyFacts, propertyHref } from "./presentation";

export const siteName = "Morada";
export const siteTitle = "Morada — Imóveis para comprar e alugar";
export const siteDescription = "Encontre imóveis para comprar ou alugar. Busque com IA, explore fotos, compare preços e confira os anúncios de origem na Morada.";
export const shareImageSize = { width: 1200, height: 630 };

export function siteOrigin(value = process.env.APP_URL) {
  const url = new URL(value || "https://real-ia.vercel.app");
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("APP_URL inválida");
  return url.origin;
}
export function absoluteUrl(path: string) { return new URL(path, siteOrigin()).href; }
export function shortText(value: string, max = 160) {
  const clean = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
export function listingShareData(p: Listing) {
  const location = [p.neighborhood, p.city, p.region].filter(Boolean).join(" · ");
  const facts = propertyFacts(p).filter(f => ["Quartos", "Banheiros", "Vagas de garagem", "Área útil", "Área informada"].includes(f.label) && f.value !== "0");
  const area = facts.find(f => f.label === "Área útil") ?? facts.find(f => f.label === "Área informada");
  const highlights = [area?.value, ...facts.filter(f => ["Quartos", "Banheiros", "Vagas de garagem"].includes(f.label)).map(f => `${f.value} ${f.label.toLowerCase()}`)].filter((x): x is string => !!x).slice(0, 3);
  const price = p.price_type === "on_request" ? "Sob consulta" : p.price != null ? money(p.price, p.currency) : "Consulte o valor";
  const pricePeriod = p.price != null && p.price_type !== "on_request" ? period(p.price_type) : "";
  const priceText = `${price}${pricePeriod}`;
  const title = shortText(p.title, 110);
  // A factual fallback works even when the crawler has no description. No inferred fees or availability.
  const description = shortText([title, location, priceText, highlights.join(" · "), "Veja fotos e o anúncio original na Morada."].filter(Boolean).join(". "));
  return { title, location: shortText(location || "Conheça os detalhes do imóvel", 90), highlights, price, pricePeriod, description, path: propertyHref(p) };
}
export function pageMetadata(title: string, description: string, path: string): Metadata {
  const image = { url: absoluteUrl("/opengraph-image"), ...shareImageSize, type: "image/png", alt: "Morada — Encontre seu próximo lugar" };
  return {
    title, description, alternates: { canonical: absoluteUrl(path) },
    openGraph: { type: "website", locale: "pt_BR", siteName, title: `${title} | ${siteName}`, description, url: absoluteUrl(path), images: [image] },
    twitter: { card: "summary_large_image", title: `${title} | ${siteName}`, description, images: [image] },
  };
}
export function listingMetadata(p: Listing): Metadata {
  const data = listingShareData(p);
  const image = { url: absoluteUrl(`${data.path}/opengraph-image`), ...shareImageSize, type: "image/png", alt: `${data.title} — foto, preço e localização na Morada` };
  return {
    title: data.title, description: data.description, alternates: { canonical: absoluteUrl(data.path) },
    openGraph: { type: "website", siteName, locale: "pt_BR", title: `${data.title} | ${siteName}`, description: data.description, url: absoluteUrl(data.path), images: [image] },
    twitter: { card: "summary_large_image", title: `${data.title} | ${siteName}`, description: data.description, images: [image] },
  };
}
