import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdmin, adminError } from "@/lib/admin-api";
import { request, ApiError, realEstateCategory } from "@/lib/api";
import { approvalSchema, adminListingSchema } from "@/lib/admin-contracts";
import { propertyHref } from "@/lib/presentation";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  const fail = (status: number, message: string, code?: string) =>
    NextResponse.json({ message, code }, { status, headers });
  if (
    req.headers.get("origin") !==
      new URL(process.env.APP_URL ?? "http://localhost:3001").origin ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    return fail(403, "Origem não autorizada.");
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return fail(400, "Envie os dados em JSON.");
  try {
    const { token } = await requireAdmin();
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 8192)
      return fail(400, "Requisição muito grande.");
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return fail(400, "JSON inválido.");
    }
    const parsed = approvalSchema.safeParse(input);
    if (!parsed.success)
      return fail(400, "Dados de aprovação inválidos. Recarregue o detalhe.");
    const body = parsed.data;
    const { id } = await params;
    const result = await request(
      `/admin/listings/${encodeURIComponent(id)}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    // Invalidate even if a successful upstream response subsequently fails validation.
    revalidateTag("listings-public", { expire: 0 });
    revalidatePath("/");
    revalidatePath("/buscar");
    revalidatePath("/imovel/[id]/[slug]", "page");
    revalidatePath("/admin/anuncios");
    revalidatePath(`/admin/anuncios/${encodeURIComponent(id)}`);
    const listing = z.object({ data: adminListingSchema }).parse(result).data;
    const category = await realEstateCategory().catch(() => null);
    return NextResponse.json(
      {
        data: listing,
        public_url:
          listing.status === "published" &&
          category &&
          String(category.id) === String(listing.category_id)
            ? propertyHref(listing)
            : null,
      },
      { headers },
    );
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(
        502,
        "A API respondeu com dados inesperados. Atualize o detalhe para confirmar a publicação.",
      );
    const status = e instanceof ApiError ? e.status : 502;
    const code = e instanceof ApiError ? e.code : undefined;
    if (status === 401) (await cookies()).delete("morada_session");
    return fail(status, adminError(status, code), code);
  }
}
