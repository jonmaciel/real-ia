import Link from "next/link";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api";
import { adminError } from "@/lib/admin-api";
export function AdminState({ error, href }: { error: unknown; href: string }) {
  if (error instanceof ApiError && error.status === 401)
    redirect("/api/session-expired");
  const status = error instanceof ApiError ? error.status : 502;
  return (
    <div className="state-box" role="status">
      <h2>
        {status === 403
          ? "Acesso restrito"
          : status === 404
            ? "Anúncio não encontrado"
            : "Não foi possível carregar"}
      </h2>
      <p>{adminError(status)}</p>
      {status !== 403 && status !== 404 && (
        <Link className="button secondary" prefetch={false} href={href}>
          Tentar novamente
        </Link>
      )}
      <Link href="/conta">Minha conta</Link>
    </div>
  );
}
