import { z } from "zod";
import { listingSchema, pricingSchema } from "./contracts";

export const leadUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const leadId = z.string().regex(/^[1-9]\d{0,18}$/).refine(v => /^[1-9]\d{0,18}$/.test(v) && BigInt(v) <= 9223372036854775807n);
export const leadStatuses = ["new", "contacted", "visit_scheduled", "visited", "negotiating", "won", "lost"] as const;
export const leadActions = ["contact_attempt", "contacted", "visit_scheduled", "visit_completed", "negotiating", "won", "lost", "reopened", "assigned", "note"] as const;
export const contactChannels = ["email", "phone", "whatsapp"] as const;
const channel = z.enum(contactChannels);
const text = (max: number) => z.string().max(max, `Use até ${max} caracteres.`).refine(v => !v.includes("\u0000"), "Remova caracteres inválidos.");
export const phoneValid = (value: string) => /^\+?\d{8,15}$/.test(value.replace(/[\s().-]/g, ""));
const email = text(254).refine(v => !v || z.email().safeParse(v).success, "Informe um e-mail válido.");
const phone = text(100).refine(v => !v || phoneValid(v), "Informe um telefone com 8 a 15 dígitos, sem acrescentar um DDI fictício.");
export const interestSchema = z.object({
  name: text(100).refine(v => v.trim().length > 0, "Informe seu nome."),
  email: email.optional(), phone: phone.optional(), preferred_contact: channel,
  message: text(2000).optional(), consent: z.literal(true, { error: "Autorize o contato sobre este imóvel para continuar." }),
  idempotency_key: leadUuid, entry_point: z.enum(["listing", "search", "assistant"]), source_listing_id: leadId.optional(),
}).strict().superRefine((v, ctx) => {
  if (!v.email?.trim() && !v.phone?.trim()) ctx.addIssue({ code: "custom", path: ["email"], message: "Informe pelo menos um contato válido." });
  if (v.preferred_contact === "email" ? !v.email?.trim() : !v.phone?.trim())
    ctx.addIssue({ code: "custom", path: [v.preferred_contact === "email" ? "email" : "phone"], message: "Informe o contato necessário para o canal escolhido." });
});
export type InterestInput = z.infer<typeof interestSchema>;
export const interestReceiptSchema = z.object({ data: z.object({ id: leadUuid, status: z.literal("received"), submitted_at: z.iso.datetime({ offset: true }) }), meta: z.object({ replayed: z.boolean() }) });

const instant = z.iso.datetime({ offset: true });
const nullableText = z.string().nullish();
const refId = z.union([z.number().int().positive().safe(), leadId]);
const person = z.object({ id: refId, name: z.string() });
const snapshotSchema = listingSchema.partial().extend({ source: z.object({ id: refId, name: z.string(), original_url: nullableText }).nullish(), pricing: pricingSchema.nullish() });
export const leadSchema = z.object({
  id: leadUuid, version: z.number().int().min(0).max(2147483647),
  listing_id: refId.nullable(), source_listing_id: refId.nullable(),
  name: z.string(), email: nullableText, phone: nullableText, preferred_contact: channel,
  entry_point: z.enum(["listing", "search", "assistant"]), status: z.enum(leadStatuses),
  listing_snapshot: snapshotSchema, assigned_to: person.nullable(), allowed_event_types: z.array(z.enum(leadActions)),
  first_contacted_at: instant.nullish(), first_visit_completed_at: instant.nullish(), first_won_at: instant.nullish(),
  visit_scheduled_at: instant.nullish(), closed_at: instant.nullish(), closed_amount: z.string().regex(/^\d+(\.\d+)?$/).nullish(), closed_currency: nullableText,
  lost_reason: nullableText, created_at: instant, updated_at: instant,
  message: nullableText, consent_at: instant.nullish(), consent_version: nullableText,
});
export type Lead = z.infer<typeof leadSchema>;
export const leadEventSchema = z.object({
  id: refId, event_type: z.enum(["interest_received", ...leadActions]), from_status: z.enum(leadStatuses), to_status: z.enum(leadStatuses),
  occurred_at: instant, created_at: instant, scheduled_at: instant.nullish(), channel: channel.nullish(), note: nullableText,
  details: z.object({ reason: nullableText, assigned_to_id: refId.nullish(), closed_amount: nullableText, closed_currency: nullableText, entry_point: nullableText, consent_version: nullableText }),
  actor: z.object({ id: refId.nullable(), name: nullableText }),
});
export type LeadEvent = z.infer<typeof leadEventSchema>;
const pagination = z.object({ page: z.number().int().min(1).max(1000), per_page: z.number().int().min(1).max(100), total_count: z.number().int().nonnegative(), has_more: z.boolean() });
export const leadListSchema = z.object({ data: z.array(leadSchema), meta: pagination });
export const leadDetailSchema = z.object({ data: leadSchema.extend({ events: z.array(leadEventSchema).max(50) }), meta: z.object({ events_has_more: z.boolean() }) });
export type LeadDetail = z.infer<typeof leadDetailSchema>;
export const leadEventsSchema = z.object({ data: z.array(leadEventSchema), meta: pagination });
export const assigneesSchema = z.object({ data: z.array(person).max(200) });
export type Assignee = z.infer<typeof person>;
const milestones = z.object({ contacted: z.number().int().nonnegative(), visited: z.number().int().nonnegative(), won: z.number().int().nonnegative() });
export const leadSummarySchema = z.object({ data: z.object({
  captured_total: z.number().int().nonnegative(), by_status: z.object(Object.fromEntries(leadStatuses.map(status => [status, z.number().int().nonnegative()])) as Record<typeof leadStatuses[number], z.ZodNumber>),
  milestones, conversion_rates: z.object({ contacted: z.number().min(0).max(1).nullable(), visited: z.number().min(0).max(1).nullable(), won: z.number().min(0).max(1).nullable() }), filters: z.record(z.string(), z.string()),
}) });

const eventCommon = { idempotency_key: leadUuid, version: z.number().int().min(0).max(2147483647), occurred_at: instant.optional(), note: text(2000).optional() };
export const leadEventInputSchema = z.discriminatedUnion("event_type", [
  z.object({ ...eventCommon, event_type: z.literal("contact_attempt"), channel }).strict(),
  z.object({ ...eventCommon, event_type: z.literal("contacted"), channel }).strict(),
  z.object({ ...eventCommon, event_type: z.literal("visit_scheduled"), scheduled_at: instant }).strict(),
  z.object({ ...eventCommon, event_type: z.literal("visit_completed") }).strict(),
  z.object({ ...eventCommon, event_type: z.literal("negotiating") }).strict(),
  z.object({ ...eventCommon, event_type: z.literal("won"), closed_amount: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/).refine(v => Number(v) <= 1e12).optional(), closed_currency: z.string().regex(/^[A-Z]{3}$/).optional() }).strict(),
  z.object({ ...eventCommon, event_type: z.literal("lost"), reason: text(500).refine(v => v.trim().length > 0) }).strict(),
  z.object({ ...eventCommon, event_type: z.literal("reopened"), reason: text(500).refine(v => v.trim().length > 0) }).strict(),
  z.object({ ...eventCommon, event_type: z.literal("assigned"), assigned_to_id: refId.nullable() }).strict(),
  z.object({ ...eventCommon, event_type: z.literal("note"), note: text(2000).refine(v => v.trim().length > 0) }).strict(),
]).superRefine((v, ctx) => {
  if (v.event_type === "won" && (v.closed_amount == null) !== (v.closed_currency == null)) ctx.addIssue({ code: "custom", path: ["closed_amount"], message: "Informe valor e moeda juntos ou deixe ambos vazios." });
});
export type LeadEventInput = z.infer<typeof leadEventInputSchema>;
export const leadEventReceiptSchema = z.object({ data: z.object({ lead: leadSchema, event: leadEventSchema }), meta: z.object({ replayed: z.boolean() }) });
export const leadFiltersSchema = z.object({
  status: z.enum(leadStatuses).optional(), listing_id: leadId.optional(), assigned_to_id: z.union([leadId, z.literal("unassigned")]).optional(),
  created_from: instant.optional(), created_to: instant.optional(), page: z.coerce.number().int().min(1).max(1000).default(1), per_page: z.coerce.number().int().min(1).max(100).default(20),
}).strict().refine(v => !v.created_from || !v.created_to || Date.parse(v.created_from) < Date.parse(v.created_to), { path: ["created_to"], message: "O fim deve ser posterior ao início." });
export type LeadFilters = z.infer<typeof leadFiltersSchema>;
export function parseLeadFilters(raw: Record<string, string | string[] | undefined>) {
  return leadFiltersSchema.parse(Object.fromEntries(Object.entries(raw).filter(([, value]) => value !== undefined && value !== "")));
}
export function leadQuery(filters: LeadFilters, summary = false) {
  return new URLSearchParams(Object.entries(filters).filter(([key, value]) => value !== undefined && value !== "" && (!summary || !["page", "per_page"].includes(key))).map(([key, value]) => [key, String(value)]));
}
