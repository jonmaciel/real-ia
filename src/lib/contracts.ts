import { z } from "zod";
export const id = z.union([z.number().int().positive(), z.string().min(1)]);
const optional = z.string().nullish();
export const listingSchema = z.object({
  id,
  category_id: id,
  title: z.string(),
  description: optional,
  cover_url: optional,
  listing_type: z.string(),
  price: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .nullish(),
  currency: optional,
  price_type: optional,
  availability: optional,
  real_estate: z.record(z.string(), z.unknown()).nullish(),
  structured_attributes: z.record(z.string(), z.unknown()).nullish(),
  city: optional,
  neighborhood: optional,
  region: optional,
  country: optional,
  completeness: z.number().nullish(),
  first_seen_at: optional,
  last_verified_at: optional,
  published_at: optional,
  updated_at: optional,
  latitude: z.union([z.string(), z.number()]).nullish(),
  longitude: z.union([z.string(), z.number()]).nullish(),
});
export type Listing = z.infer<typeof listingSchema>;
export const categorySchema = z.object({
  id,
  slug: z.string(),
  name: z.string(),
  parent_id: id.nullish(),
  attribute_schema: z.record(
    z.string(),
    z
      .object({
        type: z.string(),
        required: z.boolean().optional(),
        filterable: z.boolean().optional(),
      })
      .passthrough(),
  ),
});
export type Category = z.infer<typeof categorySchema>;
export const searchSchema = z.object({
  data: z.array(listingSchema),
  meta: z.object({
    page: z.number().int().min(1).max(1000),
    per_page: z.number().int().min(1).max(100),
    has_more: z.boolean(),
  }),
});
export const sourceSchema = z.object({
  id,
  original_url: z.string(),
  price: z.string().nullish(),
  currency: optional,
  availability: optional,
  first_observed_at: optional,
  last_observed_at: optional,
  source: z.object({ id, name: z.string(), website: optional }),
});
export const mediaSchema = z.object({
  id,
  kind: z.enum(["image", "video", "floor_plan", "document"]),
  original_url: z.string(),
  attribution: optional,
  width: z.number().nullish(),
  height: z.number().nullish(),
});
export const profileSchema = z.object({
  id,
  name: z.string(),
  email: z.string(),
  role: z.string(),
  verified_at: optional,
});
