// Isolated contract server. This module is never imported by the application.
import { randomUUID, createHash } from "node:crypto";
import type { ServerResponse } from "node:http";
import { interestSchema, leadEventInputSchema, type Lead, type LeadEvent } from "../src/lib/lead-contracts";
import { listings } from "../src/lib/fixtures";
const leads = new Map<string, Lead>(); const events = new Map<string, LeadEvent[]>();
const captures = new Map<string, { payload: string; id: string }>(); const writes = new Map<string, { payload: string; leadId: string; event: LeadEvent }>();
let eventId = 0; let observation: Record<string, unknown> | null = null;
const assignees = [{ id: 1, name: "Equipe Morada" }, { id: 2, name: "Outro administrador" }];
const allowed = (status: string): Lead["allowed_event_types"] => {
  if (["won", "lost"].includes(status)) return ["note", "assigned", "reopened"];
  const kinds: Lead["allowed_event_types"] = ["contact_attempt", "contacted", "lost", "note", "assigned"];
  if (["contacted", "visit_scheduled"].includes(status)) kinds.push("visit_scheduled");
  if (status === "visit_scheduled") kinds.push("visit_completed");
  if (["contacted", "visit_scheduled", "visited", "negotiating"].includes(status)) kinds.push("negotiating");
  if (["contacted", "visited", "negotiating"].includes(status)) kinds.push("won"); return kinds;
};
function createLead(name: string, listingId = 2, status: Lead["status"] = "new") {
  const id = randomUUID(); const created = "2026-01-01T12:00:00Z";
  const lead: Lead = { id, version: 0, listing_id: listingId, source_listing_id: 1, name, email: "private@example.test", phone: "+5541999990100", preferred_contact: "email", entry_point: "listing", status, listing_snapshot: { id: listingId, title: "Título preservado na captação", price: "1200.00", price_type: "monthly", currency: "BRL", listing_type: "rental", source: { id: 1, name: "Fonte captada", original_url: "https://example.com/original" } }, assigned_to: null, allowed_event_types: allowed(status), created_at: created, updated_at: created, message: "<script>privateMessage()</script>", consent_at: created, consent_version: "property-interest-v1", first_contacted_at: null, first_visit_completed_at: null, first_won_at: null, visit_scheduled_at: null, closed_at: null, closed_amount: null, closed_currency: null, lost_reason: null };
  leads.set(id, lead); events.set(id, []); addEvent(lead, "interest_received"); return lead;
}
function addEvent(lead: Lead, kind: LeadEvent["event_type"], fields: Partial<LeadEvent> = {}) {
  const event: LeadEvent = { id: ++eventId, event_type: kind, from_status: lead.status, to_status: lead.status, occurred_at: new Date().toISOString(), created_at: new Date().toISOString(), scheduled_at: null, note: null, channel: null, details: {}, actor: { id: kind === "interest_received" ? null : 1, name: kind === "interest_received" ? null : "Equipe Morada" }, ...fields };
  events.get(lead.id)!.unshift(event); return event;
}
export function mockLeads(path: string, url: URL, method: string | undefined, raw: unknown, bytes: Buffer, token: string | undefined, sessions: Set<string>, admins: Set<string>, res: ServerResponse) {
  const send = (status: number, body: unknown) => { res.statusCode = status; res.end(JSON.stringify(body)); return true; };
  const error = (status: number, code: string) => send(status, { error: { code } });
  if (path === "/__leads-reset") {
    leads.clear(); events.clear(); writes.clear(); captures.clear(); eventId = 0; observation = null;
    const first = createLead("Interessado novo"); const second = createLead("Interessado após visita", 999999, "lost"); second.listing_id = null; second.first_contacted_at = second.first_visit_completed_at = "2026-01-02T12:00:00Z"; second.closed_at = "2026-01-03T12:00:00Z"; second.lost_reason = "Desistiu após visitar";
    for (let i = 0; i < 55; i++) { addEvent(first, "note", { note: `Nota anterior ${i}` }); first.version++; }
    const scheduled = createLead("Visita anterior", 2, "visit_scheduled"); scheduled.first_contacted_at = "2026-01-02T12:00:00Z"; scheduled.visit_scheduled_at = "2026-01-03T12:00:00Z";
    return send(200, { data: { first: first.id, removed: second.id, scheduled: scheduled.id } });
  }
  if (path === "/__leads-observation") return send(200, observation);
  const capture = /^\/listings\/(\d+)\/interests$/.exec(path);
  if (capture) {
    observation = { sha256: createHash("sha256").update(bytes).digest("hex"), method, path, moradaIp: res.req.headers["x-morada-client-ip"] ?? null };
    const input = interestSchema.safeParse(raw); if (!input.success) return error(422, "validation_failed");
    const data = input.data; const payload = JSON.stringify(data); const prior = captures.get(data.idempotency_key);
    if (prior) return prior.payload === payload ? send(200, { data: { id: prior.id, status: "received", submitted_at: leads.get(prior.id)!.created_at }, meta: { replayed: true } }) : error(409, "idempotency_conflict");
    if (!listings.some(l => String(l.id) === capture[1]) || (data.source_listing_id && data.source_listing_id !== "1")) return error(404, "not_found");
    if (capture[1] === "6") return error(422, "listing_unavailable");
    if (data.message === "Limite") { res.setHeader("Retry-After", "2"); return error(429, "rate_limited"); }
    if (data.email === "rejected@example.test") return send(422, { error: { code: "validation_failed", details: { email: ["PRIVATE_VALIDATION_DETAIL"], internal_payload: ["PRIVATE_PAYLOAD"] } } });
    const lead = createLead(data.name, Number(capture[1])); Object.assign(lead, { email: data.email ?? null, phone: data.phone ?? null, preferred_contact: data.preferred_contact, message: data.message, entry_point: data.entry_point });
    lead.created_at = lead.updated_at = lead.consent_at = new Date().toISOString();
    captures.set(data.idempotency_key, { payload, id: lead.id });
    return send(201, { data: { id: lead.id, status: "received", submitted_at: lead.created_at }, meta: { replayed: false } });
  }
  if (!path.startsWith("/admin/leads")) return false;
  res.setHeader("Cache-Control", "no-store");
  if (!token || !sessions.has(token)) return error(401, "unauthorized");
  if (!admins.has(token)) return error(403, "forbidden");
  if (path === "/admin/leads/assignees") return send(200, { data: assignees });
  const rows = [...leads.values()].filter(l => (!url.searchParams.get("status") || l.status === url.searchParams.get("status")) && (!url.searchParams.get("listing_id") || String(l.listing_id) === url.searchParams.get("listing_id")) && (!url.searchParams.get("assigned_to_id") || (url.searchParams.get("assigned_to_id") === "unassigned" ? l.assigned_to == null : String(l.assigned_to?.id) === url.searchParams.get("assigned_to_id"))) && (!url.searchParams.get("created_from") || Date.parse(l.created_at) >= Date.parse(url.searchParams.get("created_from")!)) && (!url.searchParams.get("created_to") || Date.parse(l.created_at) < Date.parse(url.searchParams.get("created_to")!)));
  if (path === "/admin/leads/summary") {
    const milestones = { contacted: rows.filter(l => l.first_contacted_at).length, visited: rows.filter(l => l.first_visit_completed_at).length, won: rows.filter(l => l.first_won_at).length };
    return send(200, { data: { captured_total: rows.length, by_status: Object.fromEntries(["new", "contacted", "visit_scheduled", "visited", "negotiating", "won", "lost"].map(s => [s, rows.filter(l => l.status === s).length])), milestones, conversion_rates: Object.fromEntries(Object.entries(milestones).map(([k, v]) => [k, rows.length ? v / rows.length : null])), filters: Object.fromEntries(url.searchParams) } });
  }
  const page = Number(url.searchParams.get("page") ?? 1), per = Number(url.searchParams.get("per_page") ?? (path.endsWith("/events") ? 50 : 20));
  const paged = (data: unknown[]) => ({ data: data.slice((page - 1) * per, page * per), meta: { page, per_page: per, total_count: data.length, has_more: page * per < data.length } });
  if (path === "/admin/leads") return send(200, paged(rows));
  const match = /^\/admin\/leads\/([^/]+)(\/events)?$/.exec(path); const lead = match ? leads.get(match[1]) : null;
  if (!lead || !match) return error(404, "not_found");
  const history = events.get(lead.id)!;
  if (!match[2]) return send(200, { data: { ...lead, events: history.slice(0, 50) }, meta: { events_has_more: history.length > 50 } });
  if (method !== "POST") return send(200, paged(history));
  const input = leadEventInputSchema.safeParse(raw); if (!input.success) return error(400, "invalid_request");
  const action = input.data; const payload = JSON.stringify(action); const prior = writes.get(action.idempotency_key);
  if (prior) return prior.payload === payload && prior.leadId === lead.id ? send(200, { data: { lead, event: prior.event }, meta: { replayed: true } }) : error(409, "idempotency_conflict");
  if (action.note === "Conflito entre operadores" && lead.version === 55) { lead.version++; lead.status = "contacted"; lead.first_contacted_at = new Date().toISOString(); lead.allowed_event_types = allowed(lead.status); addEvent(lead, "contacted", { from_status: "new", to_status: "contacted", channel: "phone" }); }
  if (action.version !== lead.version) return error(409, "lead_outdated");
  if (action.occurred_at && Date.parse(action.occurred_at) > Date.now()) return error(422, "invalid_event_time");
  if (!lead.allowed_event_types.includes(action.event_type)) return error(422, "invalid_transition");
  const from = lead.status; const now = new Date().toISOString(); const details: LeadEvent["details"] = {};
  if (action.event_type === "contacted") { if (lead.status === "new") lead.status = "contacted"; lead.first_contacted_at ??= now; }
  if (action.event_type === "visit_scheduled") { if (Date.parse(action.scheduled_at) <= Date.now()) return error(422, "invalid_event_time"); lead.status = "visit_scheduled"; lead.visit_scheduled_at = action.scheduled_at; }
  if (action.event_type === "visit_completed") { lead.status = "visited"; lead.first_visit_completed_at ??= now; }
  if (action.event_type === "negotiating") lead.status = "negotiating";
  if (action.event_type === "won") { lead.status = "won"; lead.first_won_at ??= now; lead.closed_at = now; lead.closed_amount = action.closed_amount ?? null; lead.closed_currency = action.closed_currency ?? null; details.closed_amount = action.closed_amount; details.closed_currency = action.closed_currency; }
  if (action.event_type === "lost") { lead.status = "lost"; lead.closed_at = now; lead.lost_reason = action.reason; details.reason = action.reason; }
  if (action.event_type === "reopened") { lead.status = "new"; lead.closed_at = lead.closed_amount = lead.closed_currency = lead.lost_reason = null; details.reason = action.reason; }
  if (action.event_type === "assigned") { const person = assignees.find(a => String(a.id) === String(action.assigned_to_id)); if (action.assigned_to_id && !person) return error(422, "invalid_assignee"); lead.assigned_to = person ?? null; details.assigned_to_id = action.assigned_to_id; }
  lead.version++; lead.updated_at = now; lead.allowed_event_types = allowed(lead.status);
  const event = addEvent(lead, action.event_type, { from_status: from, to_status: lead.status, note: action.note, channel: "channel" in action ? action.channel : null, scheduled_at: "scheduled_at" in action ? action.scheduled_at : null, occurred_at: action.occurred_at ?? now, details });
  writes.set(action.idempotency_key, { payload, leadId: lead.id, event });
  return send(201, { data: { lead, event }, meta: { replayed: false } });
}
