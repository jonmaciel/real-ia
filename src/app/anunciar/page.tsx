import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { profileSchema } from "@/lib/contracts";
import { ApiError, demo, errorMessage, request } from "@/lib/api";
import { manualBodyLimit, manualRequest } from "@/lib/manual-api";
import { manualResponse, uuid, type ManualSubmission } from "@/lib/manual-contracts";
import { ManualIntake } from "@/components/manual-intake";
export const dynamic = "force-dynamic";
export const metadata = { title: "Anunciar imóvel", robots: { index: false, follow: false } };
export default async function Announce({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = (await cookies()).get("morada_session")?.value;
  if (!token) redirect("/auth/login");
  const value = (await searchParams).cadastro;
  if (value !== undefined && !uuid.safeParse(value).success) return <section className="section"><h1>Link de cadastro inválido</h1><Link href="/anunciar">Iniciar um cadastro</Link></section>;
  let profile: z.infer<typeof profileSchema> | undefined;
  let initial: ManualSubmission | null = null;
  let failure: unknown;
  try {
    if (demo) throw new ApiError(503);
    profile = z.object({ data: profileSchema }).parse(await request("/users/me", { headers: { Authorization: `Bearer ${token}` } })).data;
    if (profile.verified_at && typeof value === "string") initial = (await manualRequest(`/manual-listings/${value}`, manualResponse, {}, token)).body.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/api/session-expired");
    failure = error;
  }
  if (failure || !profile) return <section className="section"><h1>Não foi possível abrir o cadastro</h1><p role="alert">{failure instanceof ApiError && failure.status === 404 ? "Cadastro não encontrado ou sem acesso para esta conta." : errorMessage(failure)}</p><Link className="button secondary" href="/anunciar">Tentar novamente</Link></section>;
  if (!profile.verified_at) return <section className="section"><h1>Verifique seu e-mail para anunciar</h1><p>Use o token enviado ao seu e-mail para confirmar a conta.</p><Link className="button primary" href="/auth/verify">Verificar e-mail</Link></section>;
  return <section className="section"><ManualIntake key={initial?.id ?? "new"} initial={initial} bodyLimit={manualBodyLimit()} admin={profile.role === "admin"} /></section>;
}
