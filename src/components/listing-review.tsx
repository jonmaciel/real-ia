"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { PhotoGallery } from "./photo-gallery";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { z } from "zod";
import {
  adminDetailSchema,
  adminListingSchema,
  adminError,
  lifecycleLabel,
  statusLabel,
  type AdminDetail,
} from "@/lib/admin-contracts";
import {
  availability,
  date,
  modality,
  money,
  period,
  safeUrl,
} from "@/lib/presentation";
import { PropertyFeatures, PropertyPrice } from "./properties";
import { ReviewData } from "./review-data";
export function ListingReview({
  initialListing,
}: {
  initialListing: AdminDetail;
}) {
  const [listing, setListing] = useState(initialListing);
  const [selected, setSelected] = useState(
    initialListing.sources.length === 1
      ? String(initialListing.sources[0].id)
      : "",
  );
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mustReload, setMustReload] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const locked = useRef(false);
  const router = useRouter();
  const source = listing.sources.find((s) => String(s.id) === selected);
  const canApprove =
    ["draft", "published"].includes(listing.status) &&
    source &&
    ["active", "unverified"].includes(source.lifecycle) &&
    !!source.fingerprint;
  function sessionError(status: number) {
    if (status === 401) {
      router.push("/api/session-expired");
      router.refresh();
    }
    if (status === 403) {
      setMustReload(true);
    }
  }
  async function loadLatest() {
    setReviewed(false);
    setSelected("");
    setPublicUrl(null);
    setMustReload(true);
    try {
      const response = await fetch(
        `/api/admin/anuncios/${encodeURIComponent(listing.id)}`,
        { cache: "no-store", signal: AbortSignal.timeout(15000) },
      );
      if (!response.ok) {
        sessionError(response.status);
        throw new Error(adminError(response.status));
      }
      const latest = z
        .object({ data: adminDetailSchema })
        .parse(await response.json()).data;
      setListing(latest);
      setMustReload(false);
      return true;
    } catch (e) {
      setFailed(true);
      setMessage(
        `Não foi possível atualizar o detalhe. ${e instanceof Error ? e.message : "Tente novamente."}`,
      );
      return false;
    }
  }
  async function reload() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    if (await loadLatest()) {
      setFailed(false);
      setMessage(
        "Dados atualizados. Selecione a origem e revise novamente antes de aprovar.",
      );
    }
    setBusy(false);
    locked.current = false;
  }
  async function approve() {
    if (
      locked.current ||
      !source?.fingerprint ||
      !reviewed ||
      !canApprove ||
      mustReload
    )
      return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch(
        `/api/admin/anuncios/${encodeURIComponent(listing.id)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_listing_id: String(source.id),
            fingerprint: source.fingerprint,
          }),
          signal: AbortSignal.timeout(25000),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        setFailed(true);
        setReviewed(false);
        sessionError(response.status);
        if (response.status === 409 || response.status === 422) {
          const updated = await loadLatest();
          if (updated)
            setMessage(
              `${adminError(response.status, body.code)} Selecione a origem e confirme uma nova revisão.`,
            );
        } else setMessage(body.message ?? adminError(response.status));
        return;
      }
      const published = adminListingSchema.parse(body.data);
      setListing((previous) => ({ ...previous, ...published }));
      setReviewed(false);
      setPublicUrl(
        typeof body.public_url === "string" &&
          body.public_url.startsWith("/imovel/")
          ? body.public_url
          : null,
      );
      setMessage(
        "Anúncio aprovado e publicado. A aprovação editorial não confirma disponibilidade.",
      );
      router.refresh();
    } catch {
      setFailed(true);
      setMustReload(true);
      setReviewed(false);
      setMessage(
        "Não foi possível confirmar o resultado da aprovação. Atualize o detalhe antes de tentar novamente; a publicação pode ter sido concluída.",
      );
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }
  return (
    <>
      <span className="eyebrow">REVISÃO INDIVIDUAL</span>
      <div className="section-heading">
        <div>
          <h1>{listing.title}</h1>
          <p>
            {[listing.neighborhood, listing.city, listing.region]
              .filter(Boolean)
              .join(" · ") || "Localização não informada"}
          </p>
        </div>
        <span className="status-badge">{statusLabel(listing.status)}</span>
      </div>
      <div className="detail-grid admin-review">
        <div>
          <section className="panel">
            <PhotoGallery photos={listing.media ?? []} title={listing.title} />
            <h2>Dados do anúncio</h2>
            <p>{modality(listing.listing_type)}</p>
            <PropertyPrice property={listing} />
            <p>{availability(listing.availability)}</p>
            <PropertyFeatures property={listing} />
            <p className="description">
              {listing.description || "Descrição não informada."}
            </p>
            <h3>Atributos informados</h3>
            <ReviewData data={listing.structured_attributes} />
            <h3>Detalhes imobiliários</h3>
            <ReviewData data={listing.real_estate} />
            <p>
              Categoria: {listing.category_id} · Identificador: {listing.id}
            </p>
            {date(listing.updated_at) && (
              <p>Atualizado em {date(listing.updated_at)}</p>
            )}
            {date(listing.published_at) && (
              <p>Publicado em {date(listing.published_at)}</p>
            )}
            <h3>Última aprovação editorial</h3>
            <ReviewData data={listing.publication_review} />
          </section>
          <section className="detail-section">
            <h2>Anúncio de origem em revisão</h2>
            <label>
              <span>Selecionar anúncio de origem</span>
              <select
                value={selected}
                disabled={busy || mustReload}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setReviewed(false);
                }}
              >
                <option value="">Selecione uma origem</option>
                {listing.sources.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.source_name} · anúncio #{s.id}
                  </option>
                ))}
              </select>
            </label>
            {!listing.sources.length && (
              <p>Nenhum anúncio de origem disponível para aprovação.</p>
            )}
            {source && (
              <article className="panel source-review">
                <h3>{source.source_name}</h3>
                <p>
                  Anúncio de origem #{source.id} · Fonte #{source.source_id}
                </p>
                <p>
                  {money(source.price, source.currency)}
                  {source.price != null ? period(source.price_type) : ""}
                </p>
                <p>
                  {availability(source.availability)} ·{" "}
                  {lifecycleLabel(source.lifecycle)}
                </p>
                {date(source.last_observed_at) && (
                  <p>
                    Observado em {date(source.last_observed_at)}. Essa data não
                    representa verificação humana.
                  </p>
                )}
                {safeUrl(source.original_url) ? (
                  <a
                    className="text-link"
                    href={safeUrl(source.original_url)!}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir anúncio original <ArrowUpRight size={16} />
                  </a>
                ) : (
                  <p>
                    Link original indisponível ou sem protocolo HTTPS seguro.
                  </p>
                )}
                <h3>Dados de extração</h3>
                <ReviewData data={source.extraction_metadata} />
                <p className="fingerprint">
                  Versão da origem: {source.fingerprint || "Não informada"}
                </p>
              </article>
            )}
          </section>
        </div>
        <aside className="panel price-panel">
          <h2>Publicação</h2>
          <p>
            “Aprovar e publicar” torna este anúncio público imediatamente.
            Confira o conteúdo e a origem selecionada.
          </p>
          <p>
            Preço e disponibilidade precisam ser confirmados com o anunciante.
            Mudanças em novas coletas podem devolver o anúncio a rascunho.
          </p>
          <label className="confirm-delete">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={busy || mustReload || !canApprove}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            Revisei os dados e o anúncio de origem selecionado.
          </label>
          {source && !canApprove && (
            <p>
              O status do anúncio, o ciclo de vida da origem ou a ausência de
              uma versão impede a aprovação.
            </p>
          )}
          <button
            className="button primary"
            disabled={busy || mustReload || !reviewed || !canApprove}
            onClick={approve}
          >
            {busy ? "Aguarde…" : "Aprovar e publicar"}
          </button>
          <button className="button secondary" disabled={busy} onClick={reload}>
            Atualizar detalhe
          </button>
          {message && (
            <p
              className={failed ? "form-error" : "form-success"}
              role={failed ? "alert" : "status"}
            >
              {message}
            </p>
          )}
          {publicUrl && (
            <Link className="text-link" href={publicUrl} prefetch={false}>
              Ver imóvel publicado <ArrowUpRight size={16} />
            </Link>
          )}
          <Link className="text-link" href="/admin/anuncios" prefetch={false}>
            Voltar à fila
          </Link>
        </aside>
      </div>
    </>
  );
}
