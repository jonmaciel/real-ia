import type { Candidate } from "../src/lib/manual-contracts";
export function manualCandidate(incomplete = false): Candidate {
  return {
    title: "Casa enviada pelo anunciante", description: "Descrição pública do imóvel.", listing_type: incomplete ? null : "rental", property_type: incomplete ? null : "house", price: incomplete ? null : 2000, currency: "BRL", price_type: incomplete ? null : "monthly", city: incomplete ? null : "Araucária", neighborhood: incomplete ? null : "Centro", region: "PR", country: "BR", latitude: null, longitude: null,
    address: { street: null, number: null, complement: null, postal_code: null },
    contact: { agency_name: null, creci: null, phone: incomplete ? null : "+5541999991234", mobile: null, email: null, website: null, whatsapp_url: null },
    attributes: { bedrooms: 3, suites: null, bathrooms: null, parking_spaces: null, floor: null, total_floors: null, construction_year: null, usable_area_sqm: null, built_area_sqm: null, land_area_sqm: null, total_area_sqm: null, condominium_fee: null, property_tax: null, other_recurring_charges: null, balcony: null, barbecue: null, swimming_pool: null, garden: null, elevator: null, air_conditioning: null, pet_friendly: null, gym: null, playground: null, gated_community: null, furnished: null },
    pricing: { base_amount: incomplete ? null : 2000, gross_amount: null, discount_amount: null, total_amount: null, discount_condition: null, total_period: null, charges: [{ code: "property_tax", label: "IPTU", amount: 120, period: "yearly" }] }, warnings: ["Confirme as informações antes de publicar."],
  };
}
