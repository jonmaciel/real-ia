import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { profileSchema } from "@/lib/contracts";
import { request, demo, ApiError, errorMessage } from "@/lib/api";
import { AuthenticationForm } from "@/components/auth-form";
export const metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};
export default async function Account() {
  if (demo)
    return (
      <section className="section">
        <h1>Minha conta</h1>
        <p>Contas indisponíveis no modo de demonstração.</p>
      </section>
    );
  const token = (await cookies()).get("morada_session")?.value;
  if (!token) redirect("/auth/login");
  let profile;
  try {
    profile = z.object({ data: profileSchema }).parse(
      await request("/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ).data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 401)
      redirect("/api/session-expired");
    return (
      <section className="section">
        <h1>Minha conta</h1>
        <p role="status">{errorMessage(e)}</p>
      </section>
    );
  }
  return (
    <section className="section account">
      <span className="eyebrow">SEU ESPAÇO</span>
      <h1>Olá, {profile.name}.</h1>
      <p>{profile.email}</p>
      {profile.role === "admin" && (
        <div className="lead-contact-actions">
        <Link
          href="/admin/anuncios"
          prefetch={false}
          className="button secondary"
        >
          Revisar anúncios
        </Link>
        <Link href="/admin/interessados" prefetch={false} className="button secondary">Acompanhar interessados</Link>
        </div>
      )}
      <div className="account-grid">
        <section className="panel">
          <h2>Seu perfil</h2>
          <AuthenticationForm action="profile" initialName={profile.name} />
        </section>
        <section className="panel">
          <h2>Sua sessão</h2>
          <p>A renovação revoga a sessão atual e cria uma nova.</p>
          <AuthenticationForm action="rotate" />
          <AuthenticationForm action="logout" />
        </section>
        <section className="panel">
          <h2>Excluir conta</h2>
          <p>
            Esta ação exclui permanentemente sua conta da plataforma e suas
            sessões. Informe sua senha atual para confirmar.
          </p>
          <AuthenticationForm action="delete" />
        </section>
      </div>
    </section>
  );
}
