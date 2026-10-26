import { test } from "node:test";
import assert from "node:assert/strict";
import { listingSchema, pricingSchema, sourceSchema } from "../src/lib/contracts";
import { adminDetailSchema, adminSourceSchema } from "../src/lib/admin-contracts";
import { recommendationSchema } from "../src/lib/assistant-contracts";
import { recommendation } from "./assistant-fixtures";
import { pricingListings, pricingSources, rentalPricing } from "./pricing-fixtures";
import { isZeroAmount } from "../src/lib/presentation";

test("composição é preservada nos contratos público, de fontes, admin e assistente", () => {
  assert.deepEqual(listingSchema.parse(pricingListings[0]).pricing, rentalPricing);
  assert.deepEqual(sourceSchema.parse(pricingSources[0]).pricing, rentalPricing);
  const source = adminSourceSchema.parse({ ...pricingSources[0], source_id: 1, source_name: "Origem de teste", lifecycle: "active", fingerprint: "v1" });
  const detail = adminDetailSchema.parse({ ...pricingListings[0], status: "draft", sources: [source] });
  assert.deepEqual(detail.pricing, rentalPricing);
  assert.deepEqual(detail.sources[0].pricing, rentalPricing);
  assert.deepEqual(recommendationSchema.parse({ ...recommendation(2), pricing: rentalPricing }).pricing, rentalPricing);
});

test("taxa zero é distinta de valor desconhecido; ausência de composição e total é compatível", () => {
  for (const value of [0, "0", "0.0", "0.00", "000.000"]) assert.equal(isZeroAmount(value), true);
  for (const value of [null, undefined, "", "0.01", `0.${"0".repeat(400)}1`]) assert.equal(isZeroAmount(value), false);
  assert.equal(pricingSchema.parse(rentalPricing).charges?.[1].amount, "0.0");
  assert.equal(listingSchema.parse(pricingListings[1]).pricing?.charges?.[0].amount, null);
  assert.equal(listingSchema.parse(pricingListings[1]).pricing?.total_amount, undefined);
  assert.equal(listingSchema.parse(pricingListings[2]).pricing, undefined);
  assert.deepEqual(pricingSchema.parse({}), {});
  assert.equal(pricingSchema.parse({ base_amount: "1234567890123456.70" }).base_amount, "1234567890123456.70");
});

test("composição rejeita números imprecisos, valores negativos e cobranças excessivas", () => {
  for (const pricing of [{ total_amount: 1577.72 }, { gross_amount: "-1.00" }, { charges: [{ amount: "NaN" }] }, { charges: Array.from({ length: 31 }, () => ({ amount: "0.0" })) }])
    assert.equal(pricingSchema.safeParse(pricing).success, false);
});
