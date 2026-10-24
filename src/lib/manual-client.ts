import { z } from "zod";
import { manualError, manualPhotosResponse, type ManualPhoto } from "./manual-contracts";
export class ManualClientError extends Error {
  constructor(public status: number, public code: string, public wait = 0) { super(manualError(status, code)); }
}
export async function manualFetch<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}) {
  let response: Response;
  try { response = await fetch(`/api/anuncios-manuais${path}`, { ...init, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(145000) }); }
  catch { throw new ManualClientError(504, "ai_timeout"); }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const raw = response.headers.get("Retry-After");
    const seconds = raw ? (/^\d+$/.test(raw) ? Number(raw) : (Date.parse(raw) - Date.now()) / 1000) : 0;
    throw new ManualClientError(response.status, body?.code ?? "unavailable", Math.max(0, seconds || (response.status === 429 ? 60 : body?.code === "submission_busy" ? 3 : 0)));
  }
  const parsed = schema.safeParse(body); if (!parsed.success) throw new ManualClientError(502, "invalid_response");
  return parsed.data;
}
export async function allManualPhotos(id: string) {
  const result: ManualPhoto[] = [];
  for (let page = 1; page <= 100000; page++) {
    const response = await manualFetch(`/${id}/photos?page=${page}&per_page=100`, manualPhotosResponse);
    if (response.meta.page !== page || (response.meta.has_more && !response.data.length)) throw new ManualClientError(502, "invalid_response");
    result.push(...response.data);
    if (!response.meta.has_more) return result;
  }
  throw new ManualClientError(502, "invalid_response");
}
