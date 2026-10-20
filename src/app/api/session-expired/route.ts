import { cookies } from "next/headers";
import { NextResponse } from "next/server";
export async function GET() {
  (await cookies()).delete("morada_session");
  const response = NextResponse.redirect(
    new URL("/auth/login", process.env.APP_URL ?? "http://localhost:3001"),
  );
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
