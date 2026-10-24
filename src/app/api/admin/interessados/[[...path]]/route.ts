import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assigneesSchema, leadDetailSchema, leadEventInputSchema, leadEventReceiptSchema, leadEventsSchema, leadListSchema, leadSummarySchema, leadUuid, parseLeadFilters, leadQuery } from "@/lib/lead-contracts";
import { checkLeadOrigin, checkLeadInput, leadFailure, leadRequest, leadToken, privateLeadHeaders, readLeadBody, LeadApiError } from "@/lib/lead-api";
const contextSchema = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1), per_page: z.coerce.number().int().min(1).max(100).default(50) }).strict();
type Context = { params: Promise<{ path?: string[] }> };
export async function GET(req: NextRequest, { params }: Context) {
  try {
    const token = await leadToken();
    const path = (await params).path ?? [];
    const entries = [...req.nextUrl.searchParams.entries()];
    if (new Set(entries.map(([key]) => key)).size !== entries.length) throw new LeadApiError(400, "invalid_request");
    const query = Object.fromEntries(entries);
    let endpoint: string; let schema: z.ZodType;
    if (path.length === 0 || (path.length === 1 && path[0] === "summary")) {
      const filters = parseLeadFilters(query); endpoint = `/admin/leads${path.length ? "/summary" : ""}?${leadQuery(filters, path.length > 0)}`; schema = path.length ? leadSummarySchema : leadListSchema;
    } else if (path.length === 1 && path[0] === "assignees") {
      if (entries.length) throw new LeadApiError(400, "invalid_request"); endpoint = "/admin/leads/assignees"; schema = assigneesSchema;
    } else if (path.length === 1 || (path.length === 2 && path[1] === "events")) {
      const id = checkLeadInput(leadUuid, path[0]);
      if (path.length === 1 && entries.length) throw new LeadApiError(400, "invalid_request");
      const pagination = checkLeadInput(contextSchema, query);
      endpoint = `/admin/leads/${id}${path.length === 2 ? `/events?${new URLSearchParams({ page: String(pagination.page), per_page: String(pagination.per_page) })}` : ""}`; schema = path.length === 2 ? leadEventsSchema : leadDetailSchema;
    } else throw new LeadApiError(404, "not_found");
    const result = await leadRequest(endpoint, schema, { headers: { Authorization: `Bearer ${token}` } });
    return NextResponse.json(result.body, { headers: privateLeadHeaders() });
  } catch (error) { return leadFailure(error instanceof z.ZodError ? new LeadApiError(400, "invalid_request") : error); }
}
export async function POST(req: NextRequest, { params }: Context) {
  try {
    checkLeadOrigin(req);
    const token = await leadToken();
    const path = (await params).path;
    if (!path || path.length !== 2 || path[1] !== "events" || req.nextUrl.search) throw new LeadApiError(404, "not_found");
    const id = checkLeadInput(leadUuid, path[0]);
    const { value, bytes } = await readLeadBody(req);
    checkLeadInput(leadEventInputSchema, value);
    const result = await leadRequest(`/admin/leads/${id}/events`, leadEventReceiptSchema, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Origin: new URL(process.env.APP_URL ?? "http://localhost:3001").origin }, body: bytes as BodyInit });
    revalidatePath("/admin/interessados"); revalidatePath(`/admin/interessados/${id}`);
    return NextResponse.json(result.body, { status: result.status, headers: privateLeadHeaders() });
  } catch (error) { return leadFailure(error); }
}
