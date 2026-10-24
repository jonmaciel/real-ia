import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { interestSchema, interestReceiptSchema, leadEventInputSchema, leadSchema, parseLeadFilters, leadQuery, type Lead } from "../src/lib/lead-contracts";
import { buildLeadEvent, type EventForm } from "../src/lib/lead-event-form";
import { leadRate, localDateInput, localInstant, mergeLeadEvents } from "../src/lib/lead-presentation";
import { questionSignature } from "../src/lib/questions-signature";
const input = { name: "Pessoa de teste", phone: "(41) 99999-0100", preferred_contact: "whatsapp", consent: true, entry_point: "listing", idempotency_key: randomUUID() };
test("interesse exige consentimento explícito, contato e canal correspondente sem inventar DDI", () => {
  assert.equal(interestSchema.parse(input).phone, input.phone);
  for (const extra of [{ consent: false }, { consent: "true" }, { phone: undefined }, { preferred_contact: "email" }, { phone: "abc41999990100" }, { phone: "+1234567890123456" }, { email: "inválido" }, { name: "" }, { message: "a".repeat(2001) }, { role: "admin" }, { snapshot: {} }, { history: [] }, { source_listing_id: "0" }]) assert.equal(interestSchema.safeParse({ ...input, ...extra }).success, false);
  assert.equal(interestSchema.safeParse({ ...input, phone: undefined, email: "test@example.test", preferred_contact: "email" }).success, true);
});
test("recibo público elimina contatos e não é credencial para consultar pipeline", () => {
  const receipt = interestReceiptSchema.parse({ data: { id: randomUUID(), status: "received", submitted_at: "2026-10-23T12:00:00Z", email: "PRIVATE", note: "PRIVATE" }, meta: { replayed: true } });
  assert.deepEqual(Object.keys(receipt.data), ["id", "status", "submitted_at"]);
});
test("filtros administrativos são escalares e período exige fuso, calendário válido e ordem", () => {
  const filters = parseLeadFilters({ status: "new", listing_id: "2", assigned_to_id: "unassigned", created_from: "2026-10-01T00:00:00-03:00", created_to: "2026-11-01T00:00:00-03:00" });
  assert.equal(leadQuery(filters).get("assigned_to_id"), "unassigned"); assert.equal(leadQuery(filters, true).has("page"), false);
  for (const bad of [{ q: "private@example.test" }, { status: ["new"] }, { listing_id: "-1" }, { page: "1001" }, { per_page: "101" }, { created_from: "2026-02-30T00:00:00Z" }, { created_from: "2026-10-23T12:00:00" }, { created_from: "2026-11-01T00:00:00Z", created_to: "2026-10-01T00:00:00Z" }]) assert.throws(() => parseLeadFilters(bad));
});
test("ações só levam campos pertinentes, versão real e UUID da tentativa", () => {
  const lead = { version: 7, created_at: "2026-01-01T12:00:00Z", allowed_event_types: ["note", "contacted", "assigned", "won", "visit_scheduled"] } as Lead;
  const form: EventForm = { event_type: "note", channel: "whatsapp", occurred_at: "", scheduled_at: "", note: "Texto factual", reason: "não enviar", assigned_to_id: "2", closed_amount: "", closed_currency: "" };
  const key = randomUUID(); const action = buildLeadEvent(form, lead, key);
  assert.deepEqual(action, { event_type: "note", version: 7, idempotency_key: key, note: "Texto factual" });
  assert.equal(buildLeadEvent({ ...form, event_type: "assigned", assigned_to_id: "" }, lead, key).event_type, "assigned");
  const won = buildLeadEvent({ ...form, event_type: "won" }, lead, key); assert.equal("closed_amount" in won, false);
  assert.throws(() => buildLeadEvent({ ...form, event_type: "won", closed_amount: "3500" }, lead, key));
  assert.throws(() => buildLeadEvent({ ...form, event_type: "visit_scheduled", scheduled_at: "2020-01-01T00:00" }, lead, key));
  assert.equal(leadEventInputSchema.safeParse({ ...action, status: "won" }).success, false);
});
test("Brasília converte com fuso; taxa é fração do total e null não vira zero", () => {
  assert.equal(localInstant("2026-10-23T10:30"), "2026-10-23T13:30:00.000Z");
  assert.equal(localDateInput("2026-10-23T13:30:00Z"), "2026-10-23T10:30");
  assert.throws(() => localInstant("2026-02-30T10:30"));
  assert.equal(leadRate(0.25), "25%"); assert.equal(leadRate(null), "—");
});
test("assinatura da captação depende de método, caminho real e bytes originais", () => {
  const path = "/api/v1/listings-platform/listings/2/interests"; const key = "test-only-secret";
  const a = questionSignature(key, path, "10", "127.0.0.1", '{"consent":true}');
  assert.notEqual(a, questionSignature(key, path, "10", "127.0.0.1", '{ "consent": true }'));
  assert.notEqual(a, questionSignature(key, "/api/v1/listings-platform/assistant/messages", "10", "127.0.0.1", '{"consent":true}'));
});
test("contrato privado exclui campos secretos e histórico reconcilia IDs por ordem de registro", () => {
  const fixture = { id: randomUUID(), version: 0, listing_id: null, source_listing_id: null, name: "Nome", preferred_contact: "email", entry_point: "listing", status: "lost", assigned_to: null, allowed_event_types: ["note", "reopened"], listing_snapshot: { title: "Snapshot preservado", payload_original: "SECRET" }, created_at: "2026-01-01T12:00:00Z", updated_at: "2026-01-01T12:00:00Z", request_digest: "SECRET" };
  const lead = leadSchema.parse(fixture); assert.equal("request_digest" in lead, false); assert.equal("payload_original" in lead.listing_snapshot, false);
  const base = { event_type: "note" as const, from_status: "new" as const, to_status: "new" as const, occurred_at: "2026-01-01T12:00:00Z", created_at: "2026-01-02T12:00:00Z", actor: { id: null, name: null }, details: {} };
  assert.deepEqual(mergeLeadEvents([{ ...base, id: 1 }, { ...base, id: 2 }], [{ ...base, id: 2 }, { ...base, id: 3 }]).map(e => e.id), [3, 2, 1]);
});
