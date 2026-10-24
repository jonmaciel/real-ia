import { test } from "node:test";
import assert from "node:assert/strict";
import { assistantSearchParams, parseAssistantSearch, removeAssistantFilter, type AssistantSearch } from "../src/lib/assistant-search";
import { assistantInputSchema } from "../src/lib/assistant-contracts";
import { assistantFilterPills } from "../src/lib/assistant-presentation";

test("pills preservam false, zero e requisitos distintos de preferências", () => {
  const pills = assistantFilterPills({ city: "Araucária", property_type: "house", min_price: 0, max_price: "3000.00", price_basis: "total_monthly", currency: "BRL", furnished: false, bedrooms: 0, amenities: ["pet_friendly"], preferred_amenities: ["gym"] });
  assert.ok(pills.some(pill => pill.key === "furnished" && pill.label === "Sem mobília"));
  assert.ok(pills.some(pill => pill.key === "bedrooms" && pill.label === "Mínimo de 0 quartos"));
  assert.ok(pills.some(pill => pill.key === "min_price"));
  assert.ok(pills.some(pill => pill.label === "Requisito: Aceita pets" && pill.value === "pet_friendly"));
  assert.ok(pills.some(pill => pill.label === "Preferência: Academia" && pill.value === "gym"));
  assert.equal(pills.find(pill => pill.key === "price_basis")?.removable, false);
  assert.equal(pills.find(pill => pill.key === "currency")?.removable, false);
});
test("remover pill reseta paginação e preserva orçamento, demais critérios e exclusões", () => {
  const query: AssistantSearch = { filters: { city: "Araucária", furnished: false, bedrooms: 0, max_price: "3000.00", price_basis: "total_monthly", amenities: ["balcony", "pet_friendly"], preferred_amenities: ["gym", "pet_friendly"] }, excludedIds: ["2"], page: 3, perPage: 20 };
  const next = removeAssistantFilter(query, "preferred_amenities", "pet_friendly");
  assert.deepEqual(next.filters.preferred_amenities, ["gym"]);
  assert.deepEqual(next.filters.amenities, ["balcony", "pet_friendly"]);
  assert.equal(next.page, 1); assert.equal(next.filters.furnished, false); assert.equal(next.filters.bedrooms, 0);
  assert.equal(next.filters.price_basis, "total_monthly"); assert.equal(next.filters.max_price, "3000.00"); assert.deepEqual(next.excludedIds, ["2"]);
  assert.deepEqual(query.filters.preferred_amenities, ["gym", "pet_friendly"]);
  const withoutBudget = removeAssistantFilter(next, "max_price");
  assert.equal(withoutBudget.filters.max_price, undefined); assert.equal(withoutBudget.filters.price_basis, "total_monthly");
  assert.equal(removeAssistantFilter(next, "preferred_amenities", "gym").filters.preferred_amenities, undefined);
});

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
