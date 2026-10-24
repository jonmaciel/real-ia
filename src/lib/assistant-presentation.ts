import type { AssistantFilters } from "./assistant-contracts";
import { money } from "./presentation";
const labels: Record<string, string> = {
  sale: "Comprar", rental: "Alugar", apartment: "Apartamento", house: "Casa", townhouse: "Sobrado", studio: "Studio", land: "Terreno", commercial: "Comercial", rural: "Rural",
  balcony: "Varanda", barbecue: "Churrasqueira", swimming_pool: "Piscina", garden: "Jardim", elevator: "Elevador", air_conditioning: "Ar-condicionado", pet_friendly: "Aceita pets", gym: "Academia", playground: "Playground", gated_community: "Condomínio fechado",
  recommended: "Correspondência no catálogo", price_asc: "Menor preço", price_desc: "Maior preço", recent: "Mais recentes",
};
export function preferenceLabel(value: string) { return labels[value] ?? value; }
export type AssistantFilterPill = { key: keyof AssistantFilters; label: string; value?: string; removable: boolean };
export function assistantFilterPills(f: AssistantFilters) {
  const result: AssistantFilterPill[] = [];
  const add = (key: keyof AssistantFilters, label: string, removable = true, value?: string) => result.push({ key, label, removable, value });
  for (const key of ["listing_type", "property_type", "city", "neighborhood", "region", "country"] as const) if (f[key]) add(key, preferenceLabel(f[key]));
  if (f.min_price != null) add("min_price", `A partir de ${money(String(f.min_price), f.currency)}`);
  if (f.max_price != null) add("max_price", `Até ${money(String(f.max_price), f.currency)}`);
  // Currency and price basis explain the limits; removing a pill must not silently
  // convert a monthly-total budget into a base-price budget or another currency.
  if (f.min_price != null || f.max_price != null) add("price_basis", f.price_basis === "total_monthly" ? "Orçamento: total mensal informado pela origem" : "Orçamento: preço base anunciado", false);
  if (f.currency && f.currency !== "BRL") add("currency", `Moeda: ${f.currency}`, false);
  for (const [key, label] of [["bedrooms", "quartos"], ["bathrooms", "banheiros"], ["parking_spaces", "vagas"]] as const) if (f[key] != null) add(key, `Mínimo de ${f[key]} ${label}`);
  if (f.min_area != null) add("min_area", `Área útil a partir de ${String(f.min_area).replace(".", ",")} m²`);
  if (f.max_area != null) add("max_area", `Área útil até ${String(f.max_area).replace(".", ",")} m²`);
  if (f.furnished != null) add("furnished", f.furnished ? "Mobiliado" : "Sem mobília");
  for (const item of f.amenities ?? []) add("amenities", `Requisito: ${preferenceLabel(item)}`, true, item);
  for (const item of f.preferred_amenities ?? []) add("preferred_amenities", `Preferência: ${preferenceLabel(item)}`, true, item);
  if (f.sort) add("sort", `Ordenação: ${preferenceLabel(f.sort)}`, f.sort !== "recommended");
  return result;
}
export function assistantFilterLabels(f: AssistantFilters) { return assistantFilterPills(f).map(pill => pill.label); }
