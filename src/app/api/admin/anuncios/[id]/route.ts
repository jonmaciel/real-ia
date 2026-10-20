import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDetail, adminError } from "@/lib/admin-api";
import { ApiError } from "@/lib/api";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return NextResponse.json(
      { data: await adminDetail((await params).id) },
      { headers },
    );
  } catch (e) {
    const status = e instanceof ApiError ? e.status : 502;
    if (status === 401) (await cookies()).delete("morada_session");
    return NextResponse.json(
      { message: adminError(status) },
      { status, headers },
    );
  }
}
