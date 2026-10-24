import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, baseUrl, demo } from "./api";
import { leadError } from "./lead-presentation";

export class LeadApiError extends ApiError {
  constructor(status: number, code: string, retryAfter?: string, public fields: Record<string, string> = {}) { super(status, code, retryAfter); }
}
const fieldMessages: Record<string, string> = { name: "Informe um nome de até 100 caracteres.", email: "Informe um e-mail válido.", phone: "Informe um telefone válido, com 8 a 15 dígitos.", preferred_contact: "O canal escolhido precisa de um contato correspondente.", message: "Use até 2.000 caracteres.", consent: "Autorize o contato sobre este imóvel.", note: "Confira a nota, com até 2.000 caracteres.", reason: "Informe um motivo de até 500 caracteres.", scheduled_at: "Informe uma data futura para a visita.", occurred_at: "Confira a data real da ação.", assigned_to_id: "Escolha um responsável elegível.", closed_amount: "Confira o valor e a moeda de fechamento.", closed_currency: "Informe uma moeda com três letras maiúsculas." };
export async function leadRequest<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}) {
  if (demo) throw new LeadApiError(503, "lead_capture_unavailable");
  let response: Response;
  try { response = await fetch(`${baseUrl()}${path}`, { ...init, cache: "no-store", redirect: "error", signal: init.signal ?? AbortSignal.timeout(20000) }); }
  catch { throw new LeadApiError(503, "lead_capture_unavailable"); }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const fields: Record<string, string> = {};
    for (const key of Object.keys(body?.error?.details ?? {})) if (fieldMessages[key]) fields[key] = fieldMessages[key];
    const knownCodes = ["invalid_request", "unauthorized", "forbidden", "not_found", "idempotency_conflict", "lead_outdated", "validation_failed", "consent_required", "listing_unavailable", "invalid_transition", "invalid_event_time", "invalid_assignee", "rate_limited", "lead_capture_unavailable"];
    throw new LeadApiError(response.status, knownCodes.includes(body?.error?.code) ? body.error.code : "unavailable", response.headers.get("Retry-After") ?? undefined, fields);
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new LeadApiError(502, "invalid_response");
  return { body: result.data, status: response.status };
}
export async function leadToken() {
  const token = (await cookies()).get("morada_session")?.value;
  if (!token) throw new LeadApiError(401, "unauthorized");
  return token;
}
export function privateLeadHeaders() { return { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" }; }
export async function leadFailure(error: unknown) {
  const status = error instanceof ApiError ? error.status : 502;
  const code = error instanceof ApiError ? error.code : "invalid_response";
  const headers: Record<string, string> = privateLeadHeaders();
  if (error instanceof ApiError && error.retryAfter) headers["Retry-After"] = error.retryAfter;
  if (status === 401) (await cookies()).delete("morada_session");
  return NextResponse.json({ error: { code, details: error instanceof LeadApiError ? error.fields : {} }, message: leadError(status, code) }, { status, headers });
}
export function checkLeadOrigin(req: Request) {
  if (req.headers.get("origin") !== new URL(process.env.APP_URL ?? "http://localhost:3001").origin || req.headers.get("sec-fetch-site") === "cross-site") throw new LeadApiError(403, "origin_forbidden");
  if (!req.headers.get("content-type")?.startsWith("application/json")) throw new LeadApiError(400, "invalid_request");
}
export async function readLeadBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new LeadApiError(400, "invalid_request");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 40000) { await reader.cancel(); throw new LeadApiError(400, "invalid_request"); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return { bytes, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown }; } catch { throw new LeadApiError(400, "invalid_request"); }
}
export function checkLeadInput<T>(schema: z.ZodType<T>, input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) { const key = String(issue.path[0]); if (fieldMessages[key]) fields[key] = fieldMessages[key]; }
    throw new LeadApiError(400, "invalid_request", undefined, fields);
  }
  return parsed.data;
}
