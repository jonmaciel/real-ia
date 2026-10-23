import { test } from "node:test";
import assert from "node:assert/strict";
import { propertyFacts } from "../src/lib/presentation";
import { listings } from "../src/lib/fixtures";
test("ficha imobiliária preserva atributos conhecidos e distingue área informada de útil", () => {
  const facts = propertyFacts({ ...listings[0], structured_attributes: { bedrooms: 2, reported_area_sqm: "60.0" }, real_estate: { bedrooms: null, bathrooms: 1, parking_spaces: 0, usable_area_sqm: "42.5", property_type: "apartment" } });
  assert.deepEqual(facts, [
    { label: "Tipo do imóvel", value: "Apartamento" },
    { label: "Quartos", value: "2" },
    { label: "Banheiros", value: "1" },
    { label: "Vagas de garagem", value: "0" },
    { label: "Área útil", value: "42,5 m²" },
    { label: "Área informada", value: "60,0 m²" },
  ]);
});
test("ficha não transforma ausências ou valores inválidos em características", () => {
  assert.deepEqual(propertyFacts({ ...listings[0], structured_attributes: { bedrooms: "3", balcony: false }, real_estate: { property_type: "unknown", bathrooms: -1, usable_area_sqm: "Infinity" } }), []);
});
