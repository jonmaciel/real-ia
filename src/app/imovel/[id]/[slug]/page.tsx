import { MediaImage } from "@/components/media-image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { House, ArrowUpRight } from "lucide-react";
import {
  getListing,
  getMedia,
  getSources,
  realEstateCategory,
  ApiError,
  errorMessage,
} from "@/lib/api";
import {
  availability,
  date,
  modality,
  money,
  propertyHref,
  safeUrl,
} from "@/lib/presentation";
import {
  PropertyPrice,
  PropertyFeatures,
  ErrorState,
} from "@/components/properties";
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
  const allowed = (process.env.MEDIA_ALLOWED_HOSTS ?? "")
    .split(",")
    .filter(Boolean);
  return (
    <article className="section detail">
      <nav className="breadcrumb">
        <Link href="/">Início</Link>
        <span>/</span>
        <Link href="/buscar">Imóveis</Link>
        <span>/</span>
        {p.title}
      </nav>
      <div className="section-heading">
        <div>
          <span className="eyebrow">{modality(p.listing_type)}</span>
          <h1>{p.title}</h1>
          <p>
            {[p.neighborhood, p.city, p.region].filter(Boolean).join(" · ") ||
              "Localização não informada"}
          </p>
        </div>
        <ShareButton />
      </div>
      <div className="detail-grid">
        <div>
          <section className="gallery" aria-label="Mídias do imóvel">
            {media.status === "fulfilled" && media.value.length ? (
              media.value.map((m) => {
                const url = safeUrl(m.original_url);
                if (!url) return null;
                const image =
                  ["image", "floor_plan"].includes(m.kind) &&
                  allowed.includes(new URL(url).hostname);
                return (
                  <figure key={m.id}>
                    {image ? (
                      <MediaImage
                        src={url}
                        alt={
                          m.kind === "floor_plan"
                            ? "Planta do imóvel"
                            : "Imagem autorizada do imóvel"
                        }
                        width={m.width ?? 1000}
                        height={m.height ?? 680}
                      />
                    ) : (
                      <a
                        className="button secondary"
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir{" "}
                        {
                          {
                            image: "imagem",
                            floor_plan: "planta",
                            video: "vídeo",
                            document: "documento",
                          }[m.kind]
                        }{" "}
                        na origem <ArrowUpRight size={17} />
                      </a>
                    )}
                    {m.attribution && <figcaption>{m.attribution}</figcaption>}
                  </figure>
                );
              })
            ) : (
              <div className="gallery-empty">
                <House size={90} strokeWidth={0.6} />
                <p>
                  {media.status === "rejected"
                    ? "Não foi possível carregar as mídias."
                    : "Nenhuma fotografia disponível."}
                </p>
                <span>Todos os detalhes disponíveis estão abaixo.</span>
              </div>
            )}
          </section>
          <section className="detail-section">
            <h2>Um pouco mais sobre este lugar</h2>
            <PropertyFeatures
              property={p}
              category={
                category.status === "fulfilled" ? category.value : undefined
              }
            />
            <p className="description">
              {p.description || "O anunciante não informou uma descrição."}
            </p>
          </section>
          <section className="detail-section">
            <h2>Onde encontramos este imóvel</h2>
            <p>
              Preço e disponibilidade devem ser confirmados com o anunciante. As
              condições e os custos adicionais podem variar.
            </p>
            {sources.status === "fulfilled" ? (
              sources.value.length ? (
                sources.value.map((s) => {
                  const url = safeUrl(s.original_url);
                  return (
                    <div className="source-row" key={s.id}>
                      <div>
                        <h3>{s.source.name}</h3>
                        <p>{money(s.price, s.currency)}</p>
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
        <aside className="price-panel">
          <span className="eyebrow">PREÇO ANUNCIADO</span>
          <PropertyPrice property={p} />
          <p>{availability(p.availability)}</p>
          <p>
            {modality(p.listing_type)} · {p.currency ?? "Moeda não informada"}
          </p>
          <hr />
          <p>
            Condomínio, IPTU e outras taxas não informados. O preço anunciado
            não representa necessariamente o custo total.
          </p>
          {date(p.published_at) && <p>Publicado em {date(p.published_at)}</p>}
          {date(p.first_seen_at) && (
            <p>Visto pela primeira vez em {date(p.first_seen_at)}</p>
          )}
          {date(p.updated_at) && <p>Atualizado em {date(p.updated_at)}</p>}
          {date(p.last_verified_at) && (
            <p>Verificado em {date(p.last_verified_at)}</p>
          )}
          <a className="text-link" href="#conteudo">
            Voltar ao início ↑
          </a>
        </aside>
      </div>
    </article>
  );
}
