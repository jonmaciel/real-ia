import { NextRequest, NextResponse } from "next/server";
import { baseUrl } from "@/lib/api";
import { interestSchema, interestReceiptSchema, leadId } from "@/lib/lead-contracts";
import { checkLeadOrigin, checkLeadInput, leadFailure, leadRequest, privateLeadHeaders, readLeadBody, LeadApiError } from "@/lib/lead-api";
import { questionProxyHeaders } from "@/lib/questions-proxy";
export const maxDuration = 30;
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkLeadOrigin(req);
    const id = checkLeadInput(leadId, (await params).id);
    const { value, bytes } = await readLeadBody(req);
    checkLeadInput(interestSchema, value);
    const path = `/listings/${id}/interests`;
    let signed: Record<string, string>;
    try { signed = questionProxyHeaders(req.headers, new URL(`${baseUrl()}${path}`).pathname, bytes); }
    catch { throw new LeadApiError(503, "proxy_not_configured"); }
    const result = await leadRequest(path, interestReceiptSchema, { method: "POST", headers: { ...signed, "Content-Type": "application/json", Origin: new URL(process.env.APP_URL ?? "http://localhost:3001").origin }, body: bytes as BodyInit });
    return NextResponse.json(result.body, { status: result.status, headers: privateLeadHeaders() });
  } catch (error) { return leadFailure(error); }
}
