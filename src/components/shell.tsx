import Link from "next/link";
import { ArrowUpRight, House } from "lucide-react";
import { MobileNavigation } from "./mobile-navigation";
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
      <MobileNavigation />
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
