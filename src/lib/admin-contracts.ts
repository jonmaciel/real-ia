import { z } from "zod";
import { id, listingSchema, pricingSchema } from "./contracts";
export const statuses = ["draft", "published", "expired", "removed", "rejected"] as const;
export const reviewSchema = z
  .object({
    approved_by_id: id.optional(),
    approved_at: z.string().optional(),
    source_listing_id: id.optional(),
    fingerprint: z.string().optional(),
  })
  .passthrough()
  .nullish();
export const adminListingSchema = listingSchema.extend({
  listing_type: z.string().nullish().transform(value => value ?? ""),
  is_manual: z.boolean().optional(),
  creation_method: z.string().optional(),
  status: z.enum(statuses),
  publication_review: reviewSchema,
});
export const adminSourceSchema = z.object({
  id,
  source_id: id,
  source_name: z.string(),
  original_url: z.string().nullish(),
  lifecycle: z.string(),
  price: z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .nullish(),
  currency: z.string().nullish(),
  price_type: z.string().nullish(),
  pricing: pricingSchema.nullish(),
  availability: z.string().nullish(),
  last_observed_at: z.string().nullish(),
  extraction_metadata: z.record(z.string(), z.unknown()).nullish(),
  fingerprint: z.string().nullish(),
});
export const adminMediaSchema = z.object({ id, is_cover: z.boolean().optional(), position: z.number().int().nonnegative().optional(), hosted_url: z.string().nullish(), attribution: z.string().nullish(), processing_status: z.string() });
export const adminDetailSchema = adminListingSchema.extend({
  real_estate: z.record(z.string(), z.unknown()).nullish(),
  sources: z.array(adminSourceSchema),
  media: z.array(adminMediaSchema).optional(),
  media_has_more: z.boolean().optional(),
  missing_fields: z.array(z.string()).optional(),
  manual_intake: z.object({ public_id: z.string().uuid(), status: z.enum(["collecting", "processing", "ready"]), prompt: z.string(), transcript: z.string().nullish(), extraction: z.record(z.string(), z.unknown()) }).nullish(),
});
export type AdminListing = z.infer<typeof adminListingSchema>;
export type AdminDetail = z.infer<typeof adminDetailSchema>;
export const adminSearchSchema = z.object({
  data: z.array(adminListingSchema),
  meta: z.object({
    page: z.number().int().min(1).max(1000),
    per_page: z.number().int().min(1).max(100),
    has_more: z.boolean(),
  }),
});
export const adminFiltersSchema = z.object({
  status: z.enum(statuses).default("draft"),
  creation_method: z.enum(["ingestion", "manual_ai"]).optional(),
  city: z.string().max(120).optional(),
  source_id: z
    .string()
    .regex(/^[1-9]\d*$/)
    .optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminFilters = z.infer<typeof adminFiltersSchema>;
export function parseAdminFilters(
  raw: Record<string, string | string[] | undefined>,
) {
  const clean: Record<string, string> = {};
  for (const key of Object.keys(adminFiltersSchema.shape)) {
    const value = raw[key];
    if (Array.isArray(value)) throw new Error("Filtro repetido");
    if (value !== undefined && value !== "") clean[key] = value;
  }
  return adminFiltersSchema.parse(clean);
}
export function adminQuery(filters: AdminFilters) {
  return new URLSearchParams(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
}
export const approvalSchema = z
  .object({
    source_listing_id: z.string().regex(/^[1-9]\d*$/),
    fingerprint: z.string().min(1).max(4096),
  })
  .strict();
export function statusLabel(status: string) {
  return (
    (
      {
        draft: "Rascunho",
        published: "Publicado",
        expired: "Expirado",
        removed: "Removido",
        rejected: "Rejeitado",
      } as Record<string, string>
    )[status] ?? status
  );
}
export function lifecycleLabel(value: string) {
  return (
    (
      {
        active: "Ativo",
        unverified: "Não verificado",
        missing: "Não localizado",
        removed: "Removido",
        expired: "Expirado",
        inactive: "Inativo",
      } as Record<string, string>
    )[value] ?? value
  );
}

export function adminError(status: number, code?: string) {
  if (code === "manual_listing_incomplete") return "Complete os campos pendentes antes de aprovar este anúncio manual.";
  if (code === "review_outdated")
    return "Os dados mudaram desde a revisão. Revise a versão atualizada antes de aprovar novamente.";
  if (code === "listing_not_approvable")
    return "Este anúncio não reúne as condições de aprovação. Confira o status e o ciclo de vida da origem atualizados.";
  return (
    (
      {
        400: "Parâmetros inválidos. Confira os filtros ou os dados enviados.",
        401: "Sua sessão expirou. Entre novamente.",
        403: "Acesso restrito a administradores.",
        404: "Anúncio não encontrado.",
        429: "Limite de requisições atingido. Aguarde antes de tentar novamente.",
      } as Record<number, string>
    )[status] ?? "Não foi possível consultar a API. Tente novamente."
  );
}
