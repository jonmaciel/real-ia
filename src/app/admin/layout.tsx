import Link from "next/link";
export const metadata = {
  title: "Revisão de anúncios",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="section admin">
      <nav className="breadcrumb" aria-label="Navegação administrativa">
        <Link href="/conta">Minha conta</Link>
        <span>/</span>
        <Link href="/admin/anuncios" prefetch={false}>
          Revisão de anúncios
        </Link>
      </nav>
      {children}
    </section>
  );
}
