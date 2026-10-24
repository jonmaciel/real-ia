import { z } from "zod";
import { assistantFiltersSchema, assistantIdSchema, recommendationSchema, type AssistantFilters } from "./assistant-contracts";

const amenity = z.enum(["balcony", "barbecue", "swimming_pool", "garden", "elevator", "air_conditioning", "pet_friendly", "gym", "playground", "gated_community"]);
const amount = z.union([z.number().finite().min(0).max(1e12), z.string().max(414).regex(/^\d{1,13}(\.\d{1,400})?$/).refine(value => Number(value) <= 1e12)]);
export const exactFiltersSchema = assistantFiltersSchema.extend({
  city: z.string().min(1).max(100).nullish(), neighborhood: z.string().min(1).max(100).nullish(),
  region: z.string().min(1).max(100).nullish(), country: z.string().min(1).max(100).nullish(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullish(),
  amenities: z.array(amenity).max(10).nullish(), preferred_amenities: z.array(amenity).max(10).nullish(),
  min_price: amount.nullish(), max_price: amount.nullish(), min_area: amount.nullish(), max_area: amount.nullish(),
}).strict().superRefine((filters, ctx) => {
  for (const [minimum, maximum] of [[filters.min_price, filters.max_price], [filters.min_area, filters.max_area]]) {
    if (minimum != null && maximum != null && Number(minimum) > Number(maximum)) ctx.addIssue({ code: "custom", message: "invalid_range" });
  }
});
export type AssistantSearch = { filters: AssistantFilters; excludedIds: string[]; page: number; perPage: number };
export function removeAssistantFilter(query: AssistantSearch, key: keyof AssistantFilters, value?: string): AssistantSearch {
  const filters = { ...query.filters };
  if ((key === "amenities" || key === "preferred_amenities") && value !== undefined) {
    filters[key] = (filters[key] ?? []).filter(item => item !== value);
    if (!filters[key]?.length) delete filters[key];
  } else delete filters[key];
  return { ...query, filters, page: 1 };
}
const arrays = new Set(["amenities", "preferred_amenities"]);
const counts = new Set(["bedrooms", "bathrooms", "parking_spaces"]);
const amounts = new Set(["min_price", "max_price", "min_area", "max_area"]);

// Expand exponent notation without arithmetic or rounding on monetary values.
function decimal(value: string | number) {
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  const [coefficient, power] = text.toLowerCase().split("e");
  const [whole, fraction = ""] = coefficient.split(".");
  const digits = whole + fraction;
  const position = whole.length + Number(power);
  return position <= 0 ? `0.${"0".repeat(-position)}${digits}` : position >= digits.length ? digits + "0".repeat(position - digits.length) : `${digits.slice(0, position)}.${digits.slice(position)}`;
}
export function assistantSearchParams(query: AssistantSearch, marker = true) {
  const filters = exactFiltersSchema.parse(query.filters);
  const params = new URLSearchParams();
  if (marker) params.set("assistant", "1");
  for (const key of Object.keys(exactFiltersSchema.shape).sort()) {
    const value = filters[key as keyof AssistantFilters];
    if (value == null || (Array.isArray(value) && !value.length)) continue;
    params.set(key, Array.isArray(value) ? value.join(",") : typeof value === "number" ? decimal(value) : String(value));
  }
  const excluded = z.array(assistantIdSchema).max(300).parse(query.excludedIds);
  if (excluded.length) params.set("excluded_ids", excluded.join(","));
  params.set("page", String(z.number().int().min(1).max(1000).parse(query.page)));
  params.set("per_page", String(z.number().int().min(1).max(100).parse(query.perPage)));
  return params;
}
export function parseAssistantSearch(raw: Record<string, string | string[] | undefined>): AssistantSearch {
  const filters: Record<string, unknown> = {};
  const allowed = new Set([...Object.keys(exactFiltersSchema.shape), "assistant", "excluded_ids", "page", "per_page"]);
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key) || Array.isArray(value)) throw new Error("invalid_request");
    if (value === undefined || value === "") continue;
    if (key === "assistant") { if (value !== "1") throw new Error("invalid_request"); continue; }
    if (["excluded_ids", "page", "per_page"].includes(key)) continue;
    if (arrays.has(key)) filters[key] = value.split(",");
    else if (key === "furnished") { if (!["true", "false"].includes(value)) throw new Error("invalid_request"); filters[key] = value === "true"; }
    else if (counts.has(key)) { if (!/^\d{1,3}$/.test(value)) throw new Error("invalid_request"); filters[key] = Number(value); }
    else if (amounts.has(key)) { if (!/^\d{1,13}(\.\d{1,400})?$/.test(value) || Number(value) > 1e12) throw new Error("invalid_request"); filters[key] = value; }
    else filters[key] = value;
  }
  const integer = (key: string, fallback: number, max: number) => {
    const value = raw[key];
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d{1,4}$/.test(value)) throw new Error("invalid_request");
    return z.number().int().min(1).max(max).parse(Number(value));
  };
  return {
    filters: exactFiltersSchema.parse(filters),
    excludedIds: z.array(assistantIdSchema).max(300).parse(typeof raw.excluded_ids === "string" && raw.excluded_ids ? raw.excluded_ids.split(",") : []).map(String),
    page: integer("page", 1, 1000), perPage: integer("per_page", 20, 100),
  };
}
export const assistantResultsSchema = z.object({
  data: z.array(recommendationSchema).max(100),
  meta: z.object({ page: z.number().int().min(1).max(1000), per_page: z.number().int().min(1).max(100), total_count: z.number().int().nonnegative(), has_more: z.boolean(), applied_filters: exactFiltersSchema }),
});
