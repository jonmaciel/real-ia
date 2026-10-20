import Link from "next/link";
import { ArrowUpRight, House, Menu } from "lucide-react";
export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="Morada, início">
        <span className="brand-icon">
          <House size={22} />
        </span>
        morada<span className="brand-dot">.</span>
      </Link>
      <nav className="desktop-nav" aria-label="Principal">
        <Link href="/buscar?listing_type=sale">Comprar</Link>
        <Link href="/buscar?listing_type=rental">Alugar</Link>
        <Link href="/#como-funciona">Como funciona</Link>
      </nav>
      <Link className="account-link" href="/conta">
        Minha conta <ArrowUpRight size={16} />
      </Link>
      <details className="mobile-nav">
        <summary aria-label="Abrir navegação">
          <Menu />
        </summary>
        <nav aria-label="Navegação móvel">
          <Link href="/buscar?listing_type=sale">Comprar</Link>
          <Link href="/buscar?listing_type=rental">Alugar</Link>
          <Link href="/conta">Minha conta</Link>
        </nav>
      </details>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div>
        <Link href="/" className="brand">
          morada.
        </Link>
        <p>Mais clareza para encontrar seu lugar.</p>
      </div>
      <div>
        <Link href="/buscar">Explorar imóveis</Link>
        <Link href="/#como-funciona">Como funciona</Link>
        <Link href="/privacidade">Privacidade</Link>
      </div>
      <p className="fineprint">
        © {new Date().getFullYear()} Morada. Preços e disponibilidade devem ser
        confirmados com o anunciante.
      </p>
    </footer>
  );
}
