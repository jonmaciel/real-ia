import { test } from "node:test";
import assert from "node:assert/strict";
import { automaticReviewSchema, adminDetailSchema, adminError } from "../src/lib/admin-contracts";
const review = { review_id: 221, status: "needs_review", label: "Pendente após análise da IA", reviewed: true, ai_evaluated: true, applied: false, reason: "Dados coerentes, com descrição ausente na política anterior.", missing_fields: ["description"], missing_field_labels: ["Descrição (opcional)"], confidence: 0.93, model: "gpt-6-luna", model_decision: null, evaluation_mode: "apply", reviewed_at: "2026-10-25T07:12:06Z", policy_current: false };
test("preserva motivo, autoria e histórico após aprovação manual", () => {
  const data = adminDetailSchema.parse({ id: 200, category_id: 1, title: "Sobrado", listing_type: "rental", status: "published", sources: [], publication_review: { approved_by_id: 1 }, automatic_review: review, review_history: [review] });
  assert.equal(data.status, "published");
  assert.equal(data.automatic_review?.reason, review.reason);
  assert.equal(data.automatic_review?.confidence, 0.93);
  assert.equal(data.review_history?.[0].missing_fields[0], "description");
});
test("distingue rejeição da IA, simulação, erro e anúncio ainda não analisado", () => {
  for (const status of ["rejected", "approved", "error", "not_reviewed"] as const) assert.equal(automaticReviewSchema.parse({ ...review, status }).status, status);
  assert.equal(automaticReviewSchema.parse({ ...review, evaluation_mode: "preview", applied: false }).applied, false);
  assert.equal(automaticReviewSchema.safeParse({ ...review, confidence: 3 }).success, false);
  assert.equal(automaticReviewSchema.safeParse({ ...review, status: "inventado" }).success, false);
  assert.match(adminError(429, "auto_review_budget_exhausted"), /limite diário/i);
  assert.match(adminError(409, "review_in_progress"), /já está em análise/i);
});
