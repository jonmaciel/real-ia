import { test } from "node:test";
import assert from "node:assert/strict";
import { assistantSearchParams, parseAssistantSearch } from "../src/lib/assistant-search";
import { assistantInputSchema } from "../src/lib/assistant-contracts";

test("query exata preserva tipo, false, zero, base, preferências, exclusões e paginação", () => {
  const params = assistantSearchParams({ filters: { city: "Araucária", property_type: "house", bedrooms: 0, furnished: false, price_basis: "total_monthly", max_price: "3000.00", amenities: ["balcony"], preferred_amenities: ["pet_friendly"] }, excludedIds: ["3"], page: 2, perPage: 20 });
  const parsed = parseAssistantSearch(Object.fromEntries(params));
  assert.equal(parsed.filters.city, "Araucária"); assert.equal(parsed.filters.furnished, false); assert.equal(parsed.filters.bedrooms, 0);
  assert.equal(parsed.filters.max_price, "3000.00"); assert.equal(parsed.filters.price_basis, "total_monthly");
  assert.deepEqual(parsed.excludedIds, ["3"]); assert.equal(parsed.page, 2);
  assert.equal(assistantSearchParams(parsed, false).has("assistant"), false);
  assert.deepEqual(parsed.filters.preferred_amenities, ["pet_friendly"]);
});
test("query parcial é válida e serialização não arredonda números pequenos", () => {
  const query = { filters: { city: "Araucária", property_type: "house" as const, min_price: 1e-7 }, excludedIds: [], page: 1, perPage: 20 };
  assert.equal(assistantSearchParams(query).get("min_price"), "0.0000001");
  assert.equal(parseAssistantSearch({ city: "Araucária", property_type: "house" }).filters.listing_type, undefined);
});
test("query rejeita parâmetros desconhecidos, repetidos, contextos e valores inválidos", () => {
  for (const raw of [{ q: "x" }, { city: ["x", "y"] }, { radius: "1" }, { search_token: "secret" }, { furnished: "0" }, { min_price: "-1" }, { max_price: "1e5" }, { max_price: "1000000000001" }, { bedrooms: "101" }, { page: "0" }, { page: "1001" }, { per_page: "101" }, { excluded_ids: "0,2" }, { min_price: "5", max_price: "4" }, { amenities: "unknown" }]) assert.throws(() => parseAssistantSearch(raw));
});
test("contexto aceita somente página e snapshot de filtros; não recebe contexto factual ou modelo", () => {
  assert.equal(assistantInputSchema.safeParse({ question: "alugar", context: { page: "search", current_filters: { city: "Araucária", property_type: "house" } } }).success, true);
  for (const context of [{ page: "search", html: "x" }, { page: "search", current_filters: { radius: 2 } }, { page: "search", listing: {} }, { page: "https://example.com" }, { page: "search", model: "model" }]) assert.equal(assistantInputSchema.safeParse({ question: "alugar", context }).success, false);
});
