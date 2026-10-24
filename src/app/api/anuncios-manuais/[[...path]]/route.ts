import { NextResponse } from "next/server";
import { z } from "zod";
import { manualPhotosResponse, manualResponse, uuid } from "@/lib/manual-contracts";
import { ManualApiError, manualBodyLimit, manualBytes, manualFailure, manualHeaders, manualJson, manualOrigin, manualRequest, manualToken } from "@/lib/manual-api";

export const runtime = "nodejs";
export const maxDuration = 180;
type Context = { params: Promise<{ path?: string[] }> };
async function handle(req: Request, context: Context) {
  try {
    const parts = (await context.params).path ?? [];
    const [id, action, photo] = parts;
    const method = req.method;
    const valid = (!parts.length && method === "POST") || (uuid.safeParse(id).success && (
      (parts.length === 1 && method === "GET") ||
      (parts.length === 2 && action === "photos" && ["GET", "POST"].includes(method)) ||
      (parts.length === 2 && action === "process" && method === "POST") ||
      (parts.length === 2 && action === "cover" && method === "PATCH") ||
      (parts.length === 3 && action === "photos" && /^[1-9]\d*$/.test(photo) && method === "DELETE")
    ));
    if (!valid) throw new ManualApiError(404, "not_found");
    if (method !== "GET") manualOrigin(req);
    const token = await manualToken();
    const query = new URL(req.url).searchParams;
    const photosGet = action === "photos" && method === "GET";
    if ([...query.keys()].some(key => !photosGet || !["page", "per_page"].includes(key)) || [...new Set(query.keys())].some(key => query.getAll(key).length !== 1)) throw new ManualApiError(400, "invalid_request");
    if (photosGet) {
      const paging = z.object({ page: z.coerce.number().int().min(1).max(100000), per_page: z.coerce.number().int().min(1).max(200) }).safeParse({ page: query.get("page") ?? 1, per_page: query.get("per_page") ?? 100 });
      if (!paging.success) throw new ManualApiError(400, "invalid_request");
    }
    let body: BodyInit | undefined; const headers: Record<string, string> = {};
    if (method === "POST" && (!parts.length || action === "photos")) {
      const type = req.headers.get("content-type") ?? "";
      if (type.startsWith("multipart/form-data;") && /boundary=/.test(type)) {
        // Forward original bytes and original Content-Type; never reconstruct multipart.
        const bytes = await manualBytes(req, manualBodyLimit());
        body = new Uint8Array(bytes).buffer; headers["Content-Type"] = type;
      } else if (!parts.length) {
        const input = await manualJson(req, z.object({ request_key: uuid, prompt: z.string().max(8000).refine(v => !v.includes("\0")) }).strict());
        body = JSON.stringify(input); headers["Content-Type"] = "application/json";
      } else throw new ManualApiError(400, "invalid_request");
    } else if (action === "cover") {
      body = JSON.stringify(await manualJson(req, z.object({ photo_id: z.union([z.number().int().positive(), z.string().regex(/^[1-9]\d*$/)]) }).strict())); headers["Content-Type"] = "application/json";
    } else if (method !== "GET" && (await manualBytes(req, 1)).length) throw new ManualApiError(400, "invalid_request");
    const path = `/manual-listings${parts.length ? `/${parts.join("/")}` : ""}${query.size ? `?${query}` : ""}`;
    const result = await manualRequest<z.infer<typeof manualPhotosResponse> | z.infer<typeof manualResponse>>(path, photosGet ? manualPhotosResponse : manualResponse, { method, headers, body }, token);
    return NextResponse.json(result.body, { status: result.status, headers: manualHeaders });
  } catch (error) { return manualFailure(error); }
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
