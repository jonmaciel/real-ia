import "server-only";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { adminListingSchema, approvalSchema } from "./admin-contracts";
import { candidateSchema } from "./manual-contracts";
import { ManualApiError, manualFailure, manualHeaders, manualJson, manualOrigin, manualRequest, manualToken } from "./manual-api";
import { propertyHref } from "./presentation";
import { realEstateCategory } from "./api";
export async function adminWrite(req: Request, id: string, action: string) {
  try {
    manualOrigin(req);
    if (!/^[1-9]\d{0,18}$/.test(id) || !["approve", "reject", "reopen", "update"].includes(action)) throw new ManualApiError(404, "not_found");
    const token = await manualToken();
    const schema = action === "update" ? z.object({ fingerprint: z.string().min(1).max(4096), fields: candidateSchema.partial() }).strict() : action === "reject" ? approvalSchema.extend({ reason: z.string().trim().min(1).max(500) }).strict() : approvalSchema;
    const input = await manualJson<unknown>(req, schema);
    // The protected admin endpoint enforces role on every write, without profile polling.
    const result = await manualRequest(`/admin/listings/${id}${action === "update" ? "" : `/${action}`}`, z.object({ data: adminListingSchema }), { method: action === "update" ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(20000) }, token, () => {
      // Publication can succeed even if the returned payload fails validation.
      revalidateTag("listings-public", { expire: 0 });
      for (const path of ["/", "/buscar", "/admin/anuncios", `/admin/anuncios/${id}`]) revalidatePath(path);
      revalidatePath("/imovel/[id]/[slug]", "page");
    });
    const listing = result.body.data;
    const category = listing.status === "published" ? await realEstateCategory().catch(() => null) : null;
    return NextResponse.json({ data: listing, public_url: category && String(category.id) === String(listing.category_id) ? propertyHref(listing) : null }, { headers: manualHeaders });
  } catch (error) { return manualFailure(error); }
}
