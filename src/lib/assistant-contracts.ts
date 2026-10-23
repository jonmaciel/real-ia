import { z } from "zod";
import { listingSchema } from "./contracts";
import { historyMessageSchema } from "./property-questions";
export const assistantIdSchema = z.union([z.number().int().positive().safe(), z.string().regex(/^[1-9]\d{0,18}$/)]).refine(v => { try { return BigInt(v) <= 9223372036854775807n; } catch { return false; } });
const token = z.string().min(1).max(24000).refine(v => new TextEncoder().encode(v).length <= 24000);
const decimal = z.string().max(100).regex(/^\d+(\.\d+)?$/);
const optionalText = z.string().nullish();
export const pricingSchema = z.object({
  base_amount: decimal.nullish(), gross_amount: decimal.nullish(), discount_amount: decimal.nullish(), discount_condition: optionalText,
  total_amount: decimal.nullish(), total_period: optionalText, total_source: optionalText,
  charges: z.array(z.object({ code: optionalText, label: optionalText, amount: decimal.nullish(), period: optionalText })).max(30).optional(),
});
export const addressSchema = z.object({ street: optionalText, number: optionalText, complement: optionalText, postal_code: optionalText, city: optionalText, neighborhood: optionalText, region: optionalText, country: optionalText });
export const recommendationSchema = listingSchema.omit({ category_id: true }).extend({
  id: assistantIdSchema, listing_type: z.enum(["sale", "rental"]), pricing: pricingSchema.nullish(), address: addressSchema.nullish(), original_url: optionalText,
  match_reasons: z.array(z.string().max(2000)).max(30), matched_preferences: z.array(z.string().max(2000)).max(30), warnings: z.array(z.string().max(2000)).max(30),
}).refine(card => card.availability !== "unavailable");
const amount = z.union([z.number().finite().nonnegative().max(1e12), decimal]);
export const assistantFiltersSchema = z.object({
  city: optionalText, neighborhood: optionalText, region: optionalText, country: optionalText, currency: optionalText,
  listing_type: z.enum(["sale", "rental"]).nullish(), property_type: z.enum(["apartment", "house", "townhouse", "studio", "land", "commercial", "rural"]).nullish(),
  min_price: amount.nullish(), max_price: amount.nullish(), min_area: amount.nullish(), max_area: amount.nullish(),
  bedrooms: z.number().int().min(0).max(100).nullish(), bathrooms: z.number().int().min(0).max(100).nullish(), parking_spaces: z.number().int().min(0).max(100).nullish(),
  furnished: z.boolean().nullish(), amenities: z.array(z.string()).max(10).nullish(), preferred_amenities: z.array(z.string()).max(10).nullish(),
  price_basis: z.enum(["base", "total_monthly"]).nullish(), sort: z.enum(["recommended", "price_asc", "price_desc", "recent"]).nullish(),
});
export const assistantContextSchema = z.object({
  page: z.enum(["home", "search", "listing", "other"]), current_filters: assistantFiltersSchema.strict().optional(),
}).strict();
export type AssistantPageContext = z.infer<typeof assistantContextSchema>;
export const assistantInputSchema = z.object({
  question: z.string().trim().min(1).max(2000).refine(v => !v.includes("\u0000")),
  history: z.array(historyMessageSchema).max(6).default([]),
  selected_listing_id: assistantIdSchema.nullish().transform(v => v ?? null),
  search_token: token.nullish().transform(v => v ?? null),
  context: assistantContextSchema.optional(),
}).strict().refine(v => v.history.reduce((sum, m) => sum + m.content.length, 0) <= 8000);
const citation = z.object({ id: z.string(), title: z.string(), url: z.string(), kind: z.enum(["listing", "web"]), start_index: z.number().int().optional(), end_index: z.number().int().optional() });
export const assistantResponseSchema = z.object({ data: z.object({
  mode: z.enum(["search", "property"]), action: z.enum(["recommendations", "clarify", "no_results", "answer", "traditional_search"]),
  answer: z.string().min(1).max(20000).refine(v => v.trim().length > 0), citations: z.array(citation).max(100), recommendations: z.array(recommendationSchema).max(3),
  selected_listing_id: assistantIdSchema.nullable(), applied_filters: assistantFiltersSchema,
  unverified_preferences: z.array(z.string().max(2000)).max(30), search_token: token,
  has_more: z.boolean(), context_changed: z.boolean(), model: z.string(), web_search_used: z.boolean(), context_updated_at: optionalText,
  excluded_ids: z.array(assistantIdSchema).max(300).optional(),
  filter_proposal: z.object({ filters: assistantFiltersSchema, excluded_ids: z.array(assistantIdSchema).max(300) }).nullish(),
  ui_action: z.object({ type: z.literal("switch_search_tab"), tab: z.literal("traditional"), requires_confirmation: z.literal(false) }).strict().nullish(),
}).refine(v => v.action === "recommendations" ? v.recommendations.length > 0 : v.recommendations.length === 0).refine(v => v.mode === "search" ? v.selected_listing_id === null && v.action !== "answer" : v.selected_listing_id !== null && v.action === "answer" && !v.recommendations.length) });
export type AssistantResponse = z.infer<typeof assistantResponseSchema>["data"];
export type Recommendation = z.infer<typeof recommendationSchema>;
export type AssistantFilters = z.infer<typeof assistantFiltersSchema>;
