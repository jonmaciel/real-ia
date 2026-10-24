"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";

export function MobileNavigation() {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node))
        ref.current.open = false;
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return (
    <details className="mobile-nav" ref={ref} onKeyDown={(event) => {
      if (event.key === "Escape" && ref.current?.open) {
        ref.current.open = false;
        ref.current.querySelector("summary")?.focus();
      }
    }}>
      <summary aria-label="Abrir navegação"><Menu /></summary>
      <nav aria-label="Navegação móvel" onClick={(event) => {
        if ((event.target as Element).closest("a") && ref.current)
          ref.current.open = false;
      }}>
        <Link href="/buscar?listing_type=sale">Comprar</Link>
        <Link href="/buscar?listing_type=rental">Alugar</Link>
        <Link href="/anunciar">Anunciar imóvel</Link>
        <Link href="/#como-funciona">Como funciona</Link>
        <Link href="/conta">Minha conta</Link>
      </nav>
    </details>
  );
}
