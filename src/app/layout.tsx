import { AssistantProvider } from "@/components/assistant-provider";
import { PropertyChatWidget } from "@/components/property-chat-widget";
import type { Metadata, Viewport } from "next";
import { absoluteUrl, siteDescription, siteName, siteOrigin, siteTitle } from "@/lib/seo";
import { SiteHeader, Footer } from "@/components/shell";
import { demo } from "@/lib/api";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/manrope";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "./portal.css";
import "./neighborhood.css";
import "./questions.css";
import "./leads.css";
export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  applicationName: siteName,
  title: { default: siteTitle, template: "%s | Morada" },
  description: siteDescription,
  authors: [{ name: siteName, url: siteOrigin() }], creator: siteName, publisher: siteName,
  alternates: { canonical: absoluteUrl("/") },
  robots: demo ? { index: false, follow: false } : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: { locale: "pt_BR", type: "website", siteName, title: siteTitle, description: siteDescription, url: absoluteUrl("/"), images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, type: "image/png", alt: "Morada — Seu próximo lugar. Seu novo começo." }] },
  twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription, images: [{ url: absoluteUrl("/opengraph-image"), alt: "Morada — Seu próximo lugar. Seu novo começo." }] },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }, { url: "/favicon.ico", type: "image/x-icon", sizes: "16x16 32x32 48x48" }], shortcut: "/favicon.ico", apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }] },
  appleWebApp: { capable: true, title: siteName, statusBarStyle: "default" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#c4470a", colorScheme: "light" };
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
        <AssistantProvider>
        <SiteHeader />
        <main id="conteudo">{children}</main>
        <Footer />
        <PropertyChatWidget />
        </AssistantProvider>
      </body>
    </html>
  );
}
