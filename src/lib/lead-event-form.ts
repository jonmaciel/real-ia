import { leadEventInputSchema, type Lead, type LeadEventInput } from "./lead-contracts";
import { localInstant } from "./lead-presentation";
export type EventForm = { event_type: string; channel: string; occurred_at: string; scheduled_at: string; note: string; reason: string; assigned_to_id: string; closed_amount: string; closed_currency: string };
export function buildLeadEvent(form: EventForm, lead: Lead, key: string, now = Date.now()): LeadEventInput {
  if (!lead.allowed_event_types.includes(form.event_type as LeadEventInput["event_type"])) throw new Error("Escolha uma ação permitida na versão atual.");
  const input: Record<string, unknown> = { event_type: form.event_type, version: lead.version, idempotency_key: key };
  if (form.note.trim()) input.note = form.note.trim();
  if (form.occurred_at) {
    input.occurred_at = localInstant(form.occurred_at);
    if (Date.parse(input.occurred_at as string) > now || Date.parse(input.occurred_at as string) < Math.floor(Date.parse(lead.created_at) / 1000) * 1000) throw new Error("A data real precisa estar entre a captação e o momento atual.");
  }
  if (["contact_attempt", "contacted"].includes(form.event_type)) input.channel = form.channel;
  if (form.event_type === "visit_scheduled") {
    input.scheduled_at = localInstant(form.scheduled_at);
    if (Date.parse(input.scheduled_at as string) <= now) throw new Error("A visita precisa ser agendada para uma data futura.");
  }
  if (form.event_type === "visit_completed" && lead.visit_scheduled_at && Date.parse(lead.visit_scheduled_at) > now) throw new Error("Esta visita ainda está prevista para o futuro. Registre a realização somente após ela acontecer.");
  if (["lost", "reopened"].includes(form.event_type)) input.reason = form.reason.trim();
  if (form.event_type === "assigned") input.assigned_to_id = form.assigned_to_id || null;
  if (form.event_type === "won") {
    if (form.closed_amount.trim()) input.closed_amount = form.closed_amount.trim().replace(",", ".");
    if (form.closed_currency.trim()) input.closed_currency = form.closed_currency.trim().toUpperCase();
  }
  const result = leadEventInputSchema.safeParse(input);
  if (!result.success) throw new Error(result.error.issues[0].message.startsWith("Informe") ? result.error.issues[0].message : "Confira os campos obrigatórios e os limites desta ação.");
  return result.data;
}
