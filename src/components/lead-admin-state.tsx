import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { leadError } from "@/lib/lead-presentation";
export function LeadAdminState({ error, href }: { error: unknown; href: string }) {
  if (error instanceof ApiError && error.status === 401) redirect("/api/session-expired");
  const status = error instanceof ApiError ? error.status : 502;
  return <div className="state-box" role="alert"><h2>{status === 403 ? "Acesso restrito" : status === 404 ? "Interessado não encontrado" : "Não foi possível carregar"}</h2><p>{leadError(status, error instanceof ApiError ? error.code : undefined)}</p>{![403, 404, 429].includes(status) && <Link className="button secondary" prefetch={false} href={href}>Tentar novamente</Link>}{status === 429 && <p>Aguarde o limite informado pelo serviço antes de recarregar.</p>}<Link href="/conta">Minha conta</Link></div>;
}
