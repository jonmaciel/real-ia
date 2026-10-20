import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthenticationForm } from "@/components/auth-form";
import { demo } from "@/lib/api";
const flows = {
  login: {
    title: "Bem-vindo de volta.",
    description:
      "Entre com sua conta Morada. Seu e-mail precisa estar verificado.",
  },
  register: {
    title: "Seu próximo capítulo.",
    description:
      "Crie sua conta independente da plataforma. O cadastro não inicia uma sessão.",
  },
  verify: {
    title: "Confirme seu e-mail.",
    description: "Cole o token enviado por e-mail. Ele é válido por 24 horas.",
  },
  forgot: {
    title: "Vamos recuperar seu acesso.",
    description: "Informe seu e-mail para receber um token de redefinição.",
  },
  reset: {
    title: "Uma nova senha.",
    description:
      "Cole o token recebido por e-mail, válido por 30 minutos, e escolha sua nova senha.",
  },
} as const;
export const metadata = {
  title: "Sua conta",
  robots: { index: false, follow: false },
};
export default async function AuthPage({
  params,
}: {
  params: Promise<{ flow: string }>;
}) {
  const { flow } = await params;
  if (!Object.hasOwn(flows, flow)) notFound();
  const key = flow as keyof typeof flows;
  return (
    <section className="auth-page">
      <div className="auth-intro">
        <span className="eyebrow">BOM TER VOCÊ POR AQUI</span>
        <h1>
          Todo novo começo
          <br />
          merece uma <em>morada.</em>
        </h1>
        <p>Um espaço para suas próximas possibilidades.</p>
      </div>
      <div className="auth-card">
        <h2>{flows[key].title}</h2>
        <p>{flows[key].description}</p>
        {demo ? (
          <p role="status">Contas indisponíveis no modo de demonstração.</p>
        ) : (
          <AuthenticationForm action={key} />
        )}
        <nav className="auth-links" aria-label="Acesso à conta">
          <Link href="/auth/login">Entrar</Link>
          <Link href="/auth/register">Criar conta</Link>
          <Link href="/auth/verify">Verificar e-mail</Link>
          <Link href="/auth/forgot">Esqueci a senha</Link>
          <Link href="/auth/reset">Tenho um token de redefinição</Link>
        </nav>
      </div>
    </section>
  );
}
