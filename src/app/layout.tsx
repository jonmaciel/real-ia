import { PropertyChatWidget } from "@/components/property-chat-widget";
import type { Metadata } from "next";
import { SiteHeader, Footer } from "@/components/shell";
import { demo } from "@/lib/api";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "./globals.css";
import "./portal.css";
import "./neighborhood.css";
import "./questions.css";
import "leaflet/dist/leaflet.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3001"),
  title: { default: "Morada — Encontre seu lugar", template: "%s | Morada" },
  description:
    "Descubra imóveis para comprar e alugar, com preços claros e acesso às fontes de origem.",
  robots: demo ? { index: false, follow: false } : undefined,
  openGraph: { locale: "pt_BR", type: "website", siteName: "Morada" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        {demo && (
          <div className="demo-banner">
            Modo de demonstração · Imóveis fictícios, sem ofertas reais. Contas
            indisponíveis.
          </div>
        )}
        <SiteHeader />
        <main id="conteudo">{children}</main>
        <Footer />
        <PropertyChatWidget />
      </body>
    </html>
  );
}
