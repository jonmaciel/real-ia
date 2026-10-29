import { NextRequest, NextResponse } from "next/server";
import { ApiError, baseUrl, request } from "@/lib/api";
import { questionProxyHeaders } from "@/lib/questions-proxy";
import { assistantAudioResponseSchema, assistantMetadataSchema } from "@/lib/assistant-contracts";
import { audioErrorMessage, audioFileError, AUDIO_TIMEOUT_MS, MAX_AUDIO_BODY_BYTES, MAX_AUDIO_METADATA_BYTES } from "@/lib/assistant-audio";
import { questionError } from "@/lib/property-questions";
export const runtime = "nodejs";
export const maxDuration = 100;
export async function POST(req: NextRequest) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  const fail = (status: number, code: string) => NextResponse.json({ error: { code }, message: audioErrorMessage(code) ?? questionError(status) }, { status, headers });
  const origin = new URL(process.env.APP_URL ?? "http://localhost:3001").origin;
  if (req.headers.get("origin") !== origin || req.headers.get("sec-fetch-site") === "cross-site") return fail(403, "origin_forbidden");
  const contentType = req.headers.get("content-type");
  if (!contentType || !/^multipart\/form-data\s*;/i.test(contentType) || !/boundary=/i.test(contentType)) return fail(400, "invalid_request");
  if (Number(req.headers.get("content-length")) > MAX_AUDIO_BODY_BYTES) return fail(413, "audio_too_large");
  const deadline = AbortSignal.timeout(AUDIO_TIMEOUT_MS);
  const signal = AbortSignal.any([req.signal, deadline]);
  try {
    const reader = req.body?.getReader();
    if (!reader) return fail(400, "invalid_request");
    const chunks: Uint8Array[] = []; let size = 0;
    const stopReading = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", stopReading, { once: true });
    try {
      signal.throwIfAborted();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > MAX_AUDIO_BODY_BYTES) { await reader.cancel(); return fail(413, "audio_too_large"); }
        chunks.push(value);
      }
      signal.throwIfAborted();
    } finally { signal.removeEventListener("abort", stopReading); reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    // Parse a copy for validation only. Forward/sign the untouched original bytes.
    let form: FormData;
    try { form = await new Request("http://localhost", { method: "POST", headers: { "Content-Type": contentType }, body: bytes }).formData(); }
    catch { return fail(400, "invalid_request"); }
    if (Array.from(form.keys()).some(key => !["audio", "metadata"].includes(key)) || form.getAll("audio").length !== 1 || form.getAll("metadata").length > 1) return fail(400, "invalid_request");
    const audio = form.get("audio");
    if (!(audio instanceof File)) return fail(422, "invalid_audio");
    const fileError = audioFileError(audio);
    if (fileError) return fail(fileError.status, fileError.code);
    const metadata = form.get("metadata") ?? "{}";
    if (typeof metadata !== "string" || new TextEncoder().encode(metadata).length > MAX_AUDIO_METADATA_BYTES) return fail(400, "invalid_request");
    let raw: unknown;
    try { raw = JSON.parse(metadata); } catch { return fail(400, "invalid_request"); }
    const input = assistantMetadataSchema.safeParse(raw);
    if (!input.success) return fail(400, "invalid_request");
    const path = "/assistant/audio-messages";
    let proxyHeaders: Record<string, string>;
    try { proxyHeaders = questionProxyHeaders(req.headers, new URL(`${baseUrl()}${path}`).pathname, bytes); } catch { return fail(503, "proxy_not_configured"); }
    const started = performance.now();
    const result = assistantAudioResponseSchema.safeParse(await request(path, {
      method: "POST", headers: { ...proxyHeaders, "Content-Type": contentType, Origin: origin }, body: bytes,
      signal,
    }));
    headers["Server-Timing"] = `assistant;dur=${(performance.now() - started).toFixed(1)}`;
    if (!result.success || (result.data.data.mode === "property" && String(result.data.data.selected_listing_id) !== String(input.data.selected_listing_id))) return fail(502, "ai_invalid_response");
    return NextResponse.json(result.data, { headers });
  } catch (error) {
    if (error instanceof ApiError && error.retryAfter) headers["Retry-After"] = error.retryAfter;
    return fail(deadline.aborted ? 504 : error instanceof ApiError ? error.status : 502, deadline.aborted ? "ai_timeout" : error instanceof ApiError ? error.code : "ai_invalid_response");
  }
}
