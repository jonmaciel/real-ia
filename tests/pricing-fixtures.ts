// Synthetic contract values, never used as a production fallback.
import type { Listing, Pricing } from "../src/lib/contracts";

export const rentalPricing: Pricing = {
  base_amount: "1200.0", gross_amount: "1500.0", discount_amount: "300.0",
  discount_condition: "Pagamento em dia", total_amount: "1577.72",
  total_period: "monthly", total_source: "reported",
  charges: [
    { code: "condominium", label: "Condomínio", amount: "350.0", period: "monthly" },
    { code: "property_tax", label: "IPTU", amount: "0.0", period: "monthly" },
    { code: "fire_insurance", label: "Seguro incêndio", amount: "27.72", period: "monthly" },
    { code: "cleaning", label: "Taxa de limpeza", amount: "0.0", period: "one_off" },
  ],
};
const base: Listing = { id: 701, category_id: 1, title: "Imóvel com composição de custos", listing_type: "rental", price: "1200.0", currency: "BRL", price_type: "monthly", availability: "unknown", city: "Curitiba" };
export const pricingListings: Listing[] = [
  { ...base, pricing: rentalPricing },
  { ...base, id: 702, title: "Imóvel com custos parciais", pricing: { charges: [{ code: "condominium", label: "Condomínio", amount: null, period: "monthly" }, { code: "property_tax", label: "IPTU", amount: "120.0", period: "yearly" }, { label: "Taxa administrativa", amount: "10.0", period: "unknown" }] } },
  { ...base, id: 703, title: "Imóvel antigo sem composição", price: null },
  { ...base, id: 704, title: "Imóvel para compra com despesas", listing_type: "sale", price: "685000.0", price_type: "fixed", pricing: { base_amount: "685000.0", charges: [{ label: "Condomínio", amount: "350.0", period: "monthly" }, { label: "IPTU", amount: "1200.0", period: "yearly" }] } },
  { ...base, id: 705, title: "Imóvel com taxas zeradas", pricing: { charges: [{ label: "Condomínio", amount: "0", period: "monthly" }, { label: "IPTU", amount: "0.000", period: "yearly" }] } },
];
export const pricingSources = [
  { id: 1, price: "1200.0", price_type: "monthly", currency: "BRL", pricing: rentalPricing, original_url: "https://example.com/one", source: { id: 1, name: "Origem com taxas mensais" } },
  { id: 2, price: "1400.0", price_type: "monthly", currency: "BRL", pricing: { base_amount: "1400.0", charges: [{ label: "IPTU", amount: "120.0", period: "yearly" }] }, original_url: "https://example.com/two", source: { id: 2, name: "Outra origem com taxa anual" } },
];
