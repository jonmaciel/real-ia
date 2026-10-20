import { locale } from "./locale";
import type { Listing, Category } from "./contracts";
export const flags = {
  aiSearch: false,
  voiceSearch: false,
  accountFavorites: false,
  savedSearches: false,
  notifications: false,
  geoSearch: false,
} as const;
export function safeUrl(value: string | null | undefined) {
  try {
    const u = new URL(value ?? "");
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function money(
  value: string | null | undefined,
  currency: string | null | undefined = "BRL",
) {
  if (value == null) return "Preço não informado";
  if (!/^\d+(\.\d+)?$/.test(value)) return "Preço indisponível";
  const [whole, fraction = ""] = value.split(".");
  const numeric = BigInt(whole);
  const digits = fraction.padEnd(2, "0");
  const amount = `${numeric.toLocaleString(locale.language)},${digits}`;
  return `${currency === "BRL" ? "R$" : (currency ?? "Moeda não informada")} ${amount}`;
}
export function period(type: string | null | undefined) {
  return (
    (
      {
        monthly: "/mês",
        yearly: "/ano",
        hourly: "/hora",
        negotiable: " · negociável",
        on_request: " · sob consulta",
        fixed: "",
      } as Record<string, string>
    )[type ?? ""] ?? (type ? ` · ${type}` : "")
  );
}
export function modality(type: string) {
  return (
    ({ sale: "Venda", rental: "Aluguel" } as Record<string, string>)[type] ??
    type
  );
}
export function slug(title: string) {
  return (
    title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "imovel"
  );
}
export function propertyHref(p: Listing) {
  return `/imovel/${encodeURIComponent(p.id)}/${slug(p.title)}`;
}
export function features(p: Listing, category?: Category) {
  const a = p.structured_attributes ?? {};
  const schema = category?.attribute_schema;
  const items: string[] = [];
  if (
    typeof a.bedrooms === "number" &&
    Number.isInteger(a.bedrooms) &&
    a.bedrooms >= 0 &&
    (!schema || schema.bedrooms?.type === "integer")
  )
    items.push(`${a.bedrooms} quarto${a.bedrooms === 1 ? "" : "s"}`);
  if (a.balcony === true && (!schema || schema.balcony?.type === "boolean"))
    items.push("Varanda");
  const area = a.reported_area_sqm ?? p.real_estate?.reported_area_sqm;
  if (
    (typeof area === "number" && Number.isFinite(area) && area >= 0) ||
    (typeof area === "string" && /^\d+(\.\d+)?$/.test(area))
  )
    items.push(`Área informada: ${String(area).replace(".", ",")} m²`);
  return items;
}
export function date(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(+d)
    ? null
    : new Intl.DateTimeFormat(locale.language, {
        timeZone: locale.timeZone,
      }).format(d);
}

export function availability(value: string | null | undefined) {
  return (
    (
      {
        unknown: "Disponibilidade não confirmada",
        available: "Disponível",
        unavailable: "Indisponível",
        reserved: "Reservado",
      } as Record<string, string>
    )[value ?? "unknown"] ?? value
  );
}
