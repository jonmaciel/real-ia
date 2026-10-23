import type { AssistantFilters } from "./assistant-contracts";
import { money } from "./presentation";
const labels: Record<string, string> = {
  sale: "Comprar", rental: "Alugar", apartment: "Apartamento", house: "Casa", townhouse: "Sobrado", studio: "Studio", land: "Terreno", commercial: "Comercial", rural: "Rural",
  balcony: "Varanda", barbecue: "Churrasqueira", swimming_pool: "Piscina", garden: "Jardim", elevator: "Elevador", air_conditioning: "Ar-condicionado", pet_friendly: "Aceita pets", gym: "Academia", playground: "Playground", gated_community: "Condomínio fechado",
  recommended: "Correspondência no catálogo", price_asc: "Menor preço", price_desc: "Maior preço", recent: "Mais recentes",
};
export function preferenceLabel(value: string) { return labels[value] ?? value; }
export function assistantFilterLabels(f: AssistantFilters) {
  const result: string[] = [];
  for (const value of [f.listing_type, f.property_type, f.city, f.neighborhood, f.region, f.country]) if (value) result.push(preferenceLabel(value));
  if (f.min_price != null) result.push(`A partir de ${money(String(f.min_price), f.currency)}`);
  if (f.max_price != null) result.push(`Até ${money(String(f.max_price), f.currency)}`);
  if (f.min_price != null || f.max_price != null) result.push(f.price_basis === "total_monthly" ? "Orçamento: total mensal informado pela origem" : "Orçamento: preço base anunciado");
  if (f.currency) result.push(`Moeda: ${f.currency}`);
  for (const [value, label] of [[f.bedrooms, "quartos"], [f.bathrooms, "banheiros"], [f.parking_spaces, "vagas"]] as const) if (value != null) result.push(`Mínimo de ${value} ${label}`);
  if (f.min_area != null) result.push(`Área útil a partir de ${String(f.min_area).replace(".", ",")} m²`);
  if (f.max_area != null) result.push(`Área útil até ${String(f.max_area).replace(".", ",")} m²`);
  if (f.furnished != null) result.push(f.furnished ? "Mobiliado" : "Sem mobília");
  for (const item of f.amenities ?? []) result.push(`Requisito: ${preferenceLabel(item)}`);
  for (const item of f.preferred_amenities ?? []) result.push(`Preferência: ${preferenceLabel(item)}`);
  if (f.sort) result.push(`Ordenação: ${preferenceLabel(f.sort)}`);
  return result;
}
