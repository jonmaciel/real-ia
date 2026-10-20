import type { Listing, Category } from "./contracts";
export const categories: Category[] = [
  {
    id: 1,
    slug: "real-estate",
    name: "Imóveis",
    attribute_schema: {
      bedrooms: { type: "integer" },
      balcony: { type: "boolean" },
    },
  },
];
export const listings: Listing[] = [
  ["Apartamento com varanda no Batel", "Batel", "rental", "3500.00", 3, true],
  [
    "Um novo capítulo no Água Verde",
    "Água Verde",
    "sale",
    "685000.00",
    2,
    true,
  ],
  ["Espaço e tranquilidade no Cabral", "Cabral", "rental", "4200.00", 3, false],
  ["Seu refúgio no Juvevê", "Juvevê", "sale", "920000.00", 3, true],
  ["Apartamento acolhedor no Centro", "Centro", "rental", "2100.00", 1, false],
  [
    "Uma casa para chamar de sua",
    "Santa Felicidade",
    "sale",
    "1250000.00",
    3,
    true,
  ],
].map(([title, neighborhood, type, price, bedrooms, balcony], i) => ({
  id: i + 1,
  category_id: 1,
  title: String(title),
  neighborhood: String(neighborhood),
  listing_type: String(type),
  price: String(price),
  currency: "BRL",
  price_type: type === "rental" ? "monthly" : "fixed",
  city: "Curitiba",
  region: "PR",
  country: "BR",
  structured_attributes: { bedrooms, balcony },
  description:
    "Imóvel fictício criado exclusivamente para demonstrar a navegação da plataforma. Não está disponível para negociação.",
  published_at: "2026-10-20T10:00:00Z",
}));
