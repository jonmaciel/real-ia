import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { ApiError, demo, request } from "@/lib/api";
import { adminError, adminMediaSchema } from "@/lib/admin-contracts";
import { reviewPreviews } from "@/lib/admin-previews";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  try {
    if (demo) throw new ApiError(403);
    const token = (await cookies()).get("morada_session")?.value;
    if (!token) throw new ApiError(401);
    const { id } = await params;
    if (!/^[1-9]\d{0,18}$/.test(id)) throw new ApiError(400);
    // The protected upstream detail enforces admin role on every request. Avoid a
    // /users/me call per row, which would exhaust the separate profile rate limit.
    const detail = z.object({ data: z.object({ media: z.array(adminMediaSchema).max(200).optional() }) }).parse(await request(`/admin/listings/${id}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([req.signal, AbortSignal.timeout(10000)]),
    }));
    return NextResponse.json({ data: reviewPreviews(detail.data.media) }, { headers });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 502;
    if (error instanceof ApiError && error.retryAfter) headers["Retry-After"] = error.retryAfter;
    if (status === 401) (await cookies()).delete("morada_session");
    return NextResponse.json({ message: adminError(status) }, { status, headers });
  }
}
