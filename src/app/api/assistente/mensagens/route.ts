import { NextRequest, NextResponse } from "next/server";
import { questionProxyHeaders } from "@/lib/questions-proxy";
import { ApiError, baseUrl, request } from "@/lib/api";
import { questionError } from "@/lib/property-questions";
import { assistantInputSchema, assistantResponseSchema } from "@/lib/assistant-contracts";
export const maxDuration = 90;
export async function POST(req: NextRequest) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  const fail = (status: number, code: string) => NextResponse.json({ error: { code }, message: questionError(status) }, { status, headers });
  if (req.headers.get("origin") !== new URL(process.env.APP_URL ?? "http://localhost:3001").origin || req.headers.get("sec-fetch-site") === "cross-site") return fail(403, "origin_forbidden");
  if (!req.headers.get("content-type")?.startsWith("application/json")) return fail(400, "invalid_request");
  let upstreamSignal: AbortSignal | undefined;
  try {
    // Bound the request stream before JSON parsing, including escaped Unicode.
    const reader = req.body?.getReader();
    if (!reader) return fail(400, "invalid_request");
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 250000) { await reader.cancel(); return fail(400, "invalid_request"); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    let raw: unknown;
    try { raw = JSON.parse(new TextDecoder().decode(bytes)); } catch { return fail(400, "invalid_request"); }
    const input = assistantInputSchema.safeParse(raw);
    if (!input.success) return fail(400, "invalid_request");
    const path = "/assistant/messages";
    const body = JSON.stringify(input.data);
    let proxyHeaders: Record<string, string>;
    try { proxyHeaders = questionProxyHeaders(req.headers, new URL(`${baseUrl()}${path}`).pathname, body); } catch { return fail(503, "proxy_not_configured"); }
    upstreamSignal = AbortSignal.any([req.signal, AbortSignal.timeout(65000)]);
    const started = performance.now();
    const result = assistantResponseSchema.safeParse(await request(path, {
      method: "POST", headers: { ...proxyHeaders, "Content-Type": "application/json", Origin: new URL(process.env.APP_URL ?? "http://localhost:3001").origin },
      body, signal: upstreamSignal,
    }));
    headers["Server-Timing"] = `assistant;dur=${(performance.now() - started).toFixed(1)}`;
    if (!result.success || (result.data.data.mode === "property" && String(result.data.data.selected_listing_id) !== String(input.data.selected_listing_id))) return fail(502, "ai_invalid_response");
    return NextResponse.json(result.data, { headers });
  } catch (e) {
    const timedOut = upstreamSignal?.aborted && upstreamSignal.reason?.name === "TimeoutError";
    const status = timedOut ? 504 : e instanceof ApiError ? e.status : 502;
    if (e instanceof ApiError && e.retryAfter) headers["Retry-After"] = e.retryAfter;
    return fail(status, timedOut ? "ai_timeout" : e instanceof ApiError ? e.code : "ai_invalid_response");
  }
}
