import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  authSchemas,
  authPaths,
  authMethods,
  type AuthAction,
} from "@/lib/auth-contracts";
import { request, ApiError, errorMessage, demo } from "@/lib/api";
import { profileSchema } from "@/lib/contracts";
const sessionName = "morada_session";
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  const headers = { "Cache-Control": "private, no-store" };
  const fail = (message: string, status: number) =>
    NextResponse.json({ message }, { status, headers });
  const origin = process.env.APP_URL ?? "http://localhost:3001";
  if (
    req.headers.get("origin") !== new URL(origin).origin ||
    req.headers.get("sec-fetch-site") === "cross-site"
  )
    return fail("Origem não autorizada.", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return fail("Formato inválido.", 400);
  if (demo) return fail("Contas indisponíveis no modo de demonstração.", 403);
  const { action } = await params;
  if (!Object.hasOwn(authSchemas, action))
    return fail("Recurso indisponível.", 404);
  const key = action as AuthAction;
  const jar = await cookies();
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 16384)
      return fail("Requisição muito grande.", 400);
    const body = authSchemas[key].parse(JSON.parse(raw));
    const token = jar.get(sessionName)?.value;
    const protectedAction = ["profile", "delete", "logout", "rotate"].includes(
      key,
    );
    if (protectedAction && !token) throw new ApiError(401);
    const result = await request(authPaths[key], {
      method: authMethods[key] ?? "POST",
      headers: {
        "Content-Type": "application/json",
        ...(protectedAction ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (key === "login" || key === "rotate") {
      const data = z
        .object({
          data: z.object({
            token: z.string().min(1),
            expires_in: z.number().int().positive().max(604800),
          }),
        })
        .parse(result).data;
      jar.set(sessionName, data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: data.expires_in,
      });
    }
    if (["logout", "delete", "reset"].includes(key)) jar.delete(sessionName);
    if (key === "profile" || key === "register")
      z.object({ data: profileSchema }).parse(result);
    return NextResponse.json(
      {
        message:
          key === "forgot"
            ? "Se houver uma conta, enviaremos as instruções por e-mail."
            : key === "register"
              ? "Conta criada. Insira o token recebido por e-mail na página de verificação."
              : key === "login"
                ? "Sessão iniciada."
                : key === "reset"
                  ? "Senha redefinida. Entre novamente."
                  : key === "delete"
                    ? "Conta excluída."
                    : "Operação concluída.",
      },
      { headers },
    );
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) jar.delete(sessionName);
    if (e instanceof z.ZodError)
      return fail(e.issues.map((i) => i.message).join(" "), 422);
    if (e instanceof SyntaxError) return fail("Dados inválidos.", 400);
    return fail(errorMessage(e, "auth"), e instanceof ApiError ? e.status : 502);
  }
}
