// Synthetic catalog for contract tests only. No imports from production code.
import { recommendation } from "./assistant-fixtures";
import type { Recommendation } from "../src/lib/assistant-contracts";
export const assistantCatalog: Recommendation[] = [
  { ...recommendation(2), title: "Casa para comprar em Araucária", city: "Araucária", listing_type: "sale" as const, price: "650000.00", price_type: "fixed", real_estate: { property_type: "house", bedrooms: 2, furnished: false } },
  { ...recommendation(3), title: "Casa para alugar em Araucária", city: "Araucária", price: "2800.00", real_estate: { property_type: "house", bedrooms: 3, furnished: false, parking_spaces: 1 }, structured_attributes: { pet_friendly: true }, pricing: { total_amount: "3200.00" } },
  { ...recommendation(4), title: "Studio para alugar em Araucária", city: "Araucária", price: "1800.00", real_estate: { property_type: "studio", bedrooms: 0, furnished: true, parking_spaces: 0 }, pricing: { total_amount: "2100.00" } },
  { ...recommendation(5), title: "Casa para alugar em Curitiba", city: "Curitiba", price: "2500.00", real_estate: { property_type: "house", bedrooms: 2, furnished: false }, pricing: { total_amount: "2900.00" } },
];
