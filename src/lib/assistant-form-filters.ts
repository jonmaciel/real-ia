import type { AssistantFilters } from "./assistant-contracts";
import { filterSchema, type Filters } from "./filters";

export type SearchFormValues = Record<keyof Filters, string>;
export function searchFormValues(filters: Partial<Filters> = {}, full = true): SearchFormValues {
  return {
    city: filters.city ?? "", neighborhood: filters.neighborhood ?? "", region: filters.region ?? "", country: filters.country ?? "",
    listing_type: filters.listing_type ?? (full ? "" : "sale"), availability: filters.availability ?? "", currency: filters.currency ?? "BRL",
    min_price: filters.min_price ?? "", max_price: filters.max_price ?? "", q: filters.q ?? "", sort: filters.sort ?? "recent",
    page: String(filters.page ?? 1), per_page: String(filters.per_page ?? 20),
  };
}

// The conversation returns a complete snapshot, including while asking for clarification.
// Only copy fields whose meaning is supported by the conventional /search endpoint.
export function assistantFormValues(current: SearchFormValues, filters: AssistantFilters) {
  const values = { ...current, page: "1", q: "", availability: "" };
  const conversationOnly: string[] = [];
  for (const key of ["city", "neighborhood", "region", "country", "currency", "listing_type"] as const) {
    const parsed = filterSchema.shape[key].safeParse(filters[key] ?? undefined);
    values[key] = parsed.success ? parsed.data ?? "" : "";
    if (!parsed.success) conversationOnly.push(`Campo ${key} incompatível com a busca convencional`);
  }
  for (const key of ["min_price", "max_price"] as const) {
    const value = filters[key];
    const parsed = filterSchema.shape[key].safeParse(value == null ? undefined : String(value));
    values[key] = filters.price_basis !== "total_monthly" && parsed.success ? parsed.data ?? "" : "";
    if (value != null && !parsed.success) conversationOnly.push("Orçamento com precisão não suportada no formulário");
  }
  values.sort = filters.sort && filters.sort !== "recommended" ? filters.sort : "recent";
  const advanced = {
    property_type: "Tipo de imóvel", bedrooms: "Quartos", bathrooms: "Banheiros", parking_spaces: "Vagas",
    min_area: "Área mínima", max_area: "Área máxima", furnished: "Mobília",
  } as const;
  for (const [key, label] of Object.entries(advanced)) if (filters[key as keyof typeof advanced] != null) conversationOnly.push(label);
  if (filters.amenities?.length) conversationOnly.push("Comodidades obrigatórias");
  if (filters.preferred_amenities?.length) conversationOnly.push("Comodidades preferidas");
  if (filters.price_basis === "total_monthly") conversationOnly.push("Orçamento com taxas / total mensal");
  if (filters.sort === "recommended") conversationOnly.push("Ordenação por correspondência");
  return { values, conversationOnly };
}
