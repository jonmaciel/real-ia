import { test } from "node:test";
import assert from "node:assert/strict";
import { assistantFormValues, searchFormValues } from "../src/lib/assistant-form-filters";

test("clarificação preenche cidade sem supor modalidade e substitui critérios antigos", () => {
  const before = searchFormValues({ city: "Curitiba", listing_type: "rental", max_price: "5000", q: "antigo", page: 3 });
  const next = assistantFormValues(before, { city: "Araucária", property_type: "house", currency: "BRL" });
  assert.equal(next.values.city, "Araucária");
  assert.equal(next.values.listing_type, "");
  assert.equal(next.values.max_price, "");
  assert.equal(next.values.q, "");
  assert.equal(next.values.page, "1");
  assert.ok(next.conversationOnly.includes("Tipo de imóvel"));
  const refined = assistantFormValues(next.values, { city: "Araucária", listing_type: "sale", max_price: "500000.00" });
  assert.equal(refined.values.city, "Araucária");
  assert.equal(refined.values.listing_type, "sale");
  assert.equal(refined.values.max_price, "500000.00");
  assert.equal(assistantFormValues(refined.values, {}).values.city, "");
});

test("não converte orçamento total em preço base nem arredonda valores incompatíveis", () => {
  const before = searchFormValues();
  const total = assistantFormValues(before, { max_price: "3000.00", price_basis: "total_monthly", furnished: false, bedrooms: 0 });
  assert.equal(total.values.max_price, "");
  assert.ok(total.conversationOnly.includes("Orçamento com taxas / total mensal"));
  assert.ok(total.conversationOnly.includes("Mobília"));
  assert.ok(total.conversationOnly.includes("Quartos"));
  assert.equal(assistantFormValues(before, { min_price: 0, max_price: "3000.01" }).values.min_price, "0");
  assert.equal(assistantFormValues(before, { max_price: "3000.001" }).values.max_price, "");
});
