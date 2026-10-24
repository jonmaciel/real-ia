import { ListingConversationSelection } from "@/components/assistant-provider";
import { PropertyGallery } from "@/components/property-gallery";
import { prepareGallery } from "@/lib/gallery";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import {
  getListing,
  getMedia,
  getSources,
  realEstateCategory,
  ApiError,
  errorMessage,
  demo,
} from "@/lib/api";
import {
  availability,
  date,
  modality,
  money,
  period,
  propertyHref,
  safeUrl,
} from "@/lib/presentation";
import {
  PropertyPrice,
  PropertyFeatures,
  ErrorState,
} from "@/components/properties";
import { PropertyFacts } from "@/components/property-facts";
import { PropertyCosts } from "@/components/property-costs";
import { PropertyInterest } from "@/components/property-interest";
import { PropertyNeighborhood } from "@/components/property-neighborhood";
import { publicCoordinates, publishedContact } from "@/lib/property-location";
import { ShareButton } from "@/components/share";
type Props = { params: Promise<{ id: string; slug: string }> };
export async function generateMetadata({ params }: Props) {
  try {
    const p = await getListing((await params).id);
    return {
      title: p.title,
      description: p.description?.slice(0, 160),
      alternates: { canonical: propertyHref(p) },
      openGraph: {
        title: p.title,
        description: p.description?.slice(0, 160),
        url: propertyHref(p),
      },
    };
  } catch {
    return { title: "Imóvel indisponível", robots: { index: false } };
  }
}
export default async function Detail({ params }: Props) {
  const { id, slug } = await params;
  let p;
  try {
    p = await getListing(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    return (
      <section className="section">
        <ErrorState
          message={errorMessage(e)}
          href={`/imovel/${encodeURIComponent(id)}/${encodeURIComponent(slug)}`}
        />
      </section>
    );
  }
  if (propertyHref(p) !== `/imovel/${id}/${slug}`)
    permanentRedirect(propertyHref(p));
  const [sources, media, category] = await Promise.allSettled([
    getSources(id),
    getMedia(id),
    realEstateCategory(),
  ]);
  const allowed = (process.env.MEDIA_ALLOWED_HOSTS ?? "ik.imagekit.io")
    .split(",")
    .filter(Boolean);
  const gallery = prepareGallery(
    media.status === "fulfilled" ? media.value : [],
    [
      ...new Set([
        "ik.imagekit.io",
        ...allowed.map((h) => h.trim()).filter(Boolean),
      ]),
    ],
  );
  const contact = publishedContact(p.description);
  return (
    <article className="section detail">
      <ListingConversationSelection id={String(p.id)} />
      <nav className="breadcrumb">
        <Link href="/">Início</Link>
        <span>/</span>
        <Link href="/buscar">Imóveis</Link>
        <span>/</span>
        {p.title}
      </nav>
          <div id="fotos" className="detail-anchor detail-visual">
            <PropertyGallery
              title={p.title}
              photos={gallery.photos}
              attachments={gallery.attachments}
              failed={media.status === "rejected"}
            />
          </div>
      <div className="detail-grid">
        <div className="detail-intro">
      <div className="section-heading detail-heading">
        <div>
          <span className="detail-modality">{modality(p.listing_type)}</span>
          <h1>{p.title}</h1>
          <p>
            {[p.neighborhood, p.city, p.region].filter(Boolean).join(" · ") ||
              "Localização não informada"}
          </p>
        </div>
        <ShareButton />
      </div>
      <div className="detail-highlights">
        <PropertyFeatures property={p} category={category.status === "fulfilled" ? category.value : undefined} />
      </div>
      <nav className="detail-navigation" aria-label="Seções do imóvel">
        <a href="#fotos">Fotos</a>
        <a href="#sobre">Sobre o imóvel</a>
        <a href="#localizacao">Localização</a>
        <a href="#fontes">Anúncios de origem</a>
      </nav>
        </div>
        <div className="detail-sidebar">
        <aside className="price-panel">
          <span className="eyebrow">PREÇO ANUNCIADO</span>
          <PropertyPrice property={p} />
          <p>{availability(p.availability)}</p>
          <p>
            {modality(p.listing_type)} · {p.currency ?? "Moeda não informada"}
          </p>
          <PropertyCosts property={p} />
          <PropertyInterest listingId={String(p.id)} title={p.title} unavailable={p.availability === "unavailable"} disabled={demo} />
          <a className="button secondary source-shortcut" href="#fontes">
            Consultar anúncios de origem <ArrowUpRight size={17} />
          </a>
          <details className="listing-dates"><summary>Datas deste anúncio</summary>
          {date(p.published_at) && <p>Publicado em {date(p.published_at)}</p>}
          {date(p.first_seen_at) && (
            <p>Visto pela primeira vez em {date(p.first_seen_at)}</p>
          )}
          {date(p.updated_at) && <p>Atualizado em {date(p.updated_at)}</p>}
          {date(p.last_verified_at) && (
            <p>Verificado em {date(p.last_verified_at)}</p>
          )}
          </details>
          <a className="text-link" href="#conteudo">
            Voltar ao início ↑
          </a>
        </aside>
        </div>
        <div className="detail-body">
          <section id="sobre" className="detail-section detail-anchor">
            <h2>Um pouco mais sobre este lugar</h2>
            <PropertyFacts property={p} />
            <p className="description">
              {p.description || "O anunciante não informou uma descrição."}
            </p>
          </section>
          <PropertyNeighborhood
            key={String(p.id)}
            point={publicCoordinates(p)}
            location={[p.neighborhood, p.city, p.region].filter(Boolean).join(" · ")}
          />
          <section
            id="fontes"
            className="detail-section detail-anchor"
            tabIndex={-1}
          >
            <h2>Onde encontramos este imóvel</h2>
            <p>
              Preço e disponibilidade devem ser confirmados com o anunciante. As
              condições e os custos adicionais podem variar.
            </p>
            <div className="published-contact">
              <h3>Contato e endereço</h3>
              {contact.phone && contact.telephone ? (
                <p>Telefone informado na descrição: <a className="text-link" href={contact.telephone}>{contact.phone}</a></p>
              ) : <p>Telefone de contato não informado. Consulte o anunciante pelo anúncio original.</p>}
              {contact.address ? <p>Endereço informado na descrição: <strong>{contact.address}</strong></p> : <p>Endereço completo não informado. Confirme com o anunciante antes de visitar.</p>}
              <small>Informações da descrição pública, sem verificação independente pelo Morada.</small>
            </div>
            {sources.status === "fulfilled" ? (
              sources.value.length ? (
                sources.value.map((s) => {
                  const url = safeUrl(s.original_url);
                  return (
                    <div className="source-row" key={s.id}>
                      <div>
                        <h3>{s.source.name}</h3>
                        <p>{money(s.price, s.currency)}{s.price != null ? period(s.price_type) : ""}</p>
                        {s.pricing && <details className="source-costs"><summary>Preço e taxas desta origem</summary><PropertyCosts property={{ ...s, listing_type: p.listing_type }} /></details>}
                        {s.availability && (
                          <small>
                            Disponibilidade informada:{" "}
                            {availability(s.availability)}
                          </small>
                        )}
                        {date(s.last_observed_at) && (
                          <small>Observado em {date(s.last_observed_at)}</small>
                        )}
                      </div>
                      {url && (
                        <a
                          className="button primary"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver anúncio original <ArrowUpRight size={17} />
                        </a>
                      )}
                    </div>
                  );
                })
              ) : (
                <p>Nenhuma fonte disponível.</p>
              )
            ) : (
              <p role="status">
                Não foi possível consultar as fontes. Recarregue a página para
                tentar novamente.
              </p>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}
