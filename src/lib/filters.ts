import { z } from "zod";
const price = z
  .string()
  .regex(/^\d{1,16}(\.\d{1,2})?$/)
  .optional();
export const filterSchema = z
  .object({
    city: z.string().max(120).optional(),
    neighborhood: z.string().max(120).optional(),
    region: z.string().max(100).optional(),
    country: z.string().max(100).optional(),
    listing_type: z.enum(["sale", "rental"]).optional(),
    availability: z.string().max(50).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .default("BRL"),
    min_price: price,
    max_price: price,
    q: z.string().max(200).optional(),
    sort: z.enum(["recent", "price_asc", "price_desc"]).default("recent"),
    page: z.coerce.number().int().min(1).max(1000).default(1),
    per_page: z.coerce.number().int().min(1).max(100).default(20),
  })
  .superRefine((v, c) => {
    if (v.min_price && v.max_price) {
      const minor = (s: string) => {
        const [w, f = ""] = s.split(".");
        return BigInt(w) * 100n + BigInt((f + "00").slice(0, 2));
      };
      if (minor(v.min_price) > minor(v.max_price))
        c.addIssue({
          code: "custom",
          message: "O preço mínimo deve ser menor que o máximo.",
          path: ["max_price"],
        });
    }
  });
export type Filters = z.infer<typeof filterSchema>;
export function parseFilters(
  raw: Record<string, string | string[] | undefined>,
) {
  const clean: Record<string, string> = {};
  for (const k of Object.keys(filterSchema.shape)) {
    const v = raw[k];
    if (Array.isArray(v)) throw new Error("Use apenas um valor por filtro.");
    if (v !== undefined && v !== "") clean[k] = v;
  }
  return filterSchema.parse(clean);
}
export function serialize(filters: Filters, category?: string) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters))
    if (v !== undefined && v !== "") p.set(k, String(v));
  if (category) p.set("category", category);
  return p;
}
