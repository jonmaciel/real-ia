import Link from "next/link";
import { adminSearch, requireAdmin } from "@/lib/admin-api";
import {
  parseAdminFilters,
  adminQuery,
  statuses,
  statusLabel,
} from "@/lib/admin-contracts";
import { modality, money, period, availability } from "@/lib/presentation";
import { AdminState } from "@/components/admin-state";
import { AdminListingPreviews, AdminPreviewProvider } from "@/components/admin-listing-previews";
export default async function AdminQueue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  try {
    await requireAdmin();
  } catch (e) {
    return <AdminState error={e} href="/admin/anuncios" />;
  }
  let filters;
  try {
    filters = parseAdminFilters(await searchParams);
  } catch {
    return (
      <div className="state-box" role="alert">
        <h1>Filtros inválidos</h1>
        <p>
          Use uma página entre 1 e 1000, até 100 itens e um ID de fonte numérico
          positivo.
        </p>
        <Link href="/admin/anuncios">Limpar filtros</Link>
      </div>
    );
  }
  let result;
  let failure;
  try {
    result = await adminSearch(filters);
  } catch (e) {
    failure = e;
  }
  const href = `/admin/anuncios?${adminQuery(filters)}`;
  return (
    <>
      <span className="eyebrow">CURADORIA MORADA</span>
      <h1>Revisão de anúncios</h1>
      <p>
        Revise cada origem antes de publicar. A aprovação editorial não confirma
        a disponibilidade do imóvel.
      </p>
      <form className="panel admin-filters" action="/admin/anuncios">
        <label>
          <span>Status</span>
          <select name="status" defaultValue={filters.status}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Cidade</span>
          <input
            name="city"
            maxLength={120}
            defaultValue={filters.city}
            placeholder="Nome exato da cidade"
          />
        </label>
        <label>
          <span>ID da fonte</span>
          <input
            name="source_id"
            inputMode="numeric"
            pattern="[1-9][0-9]*"
            defaultValue={filters.source_id}
            placeholder="Ex.: 12"
          />
        </label>
        <label>
          <span>Itens por página</span>
          <input
            type="number"
            name="per_page"
            min="1"
            max="100"
            defaultValue={filters.per_page}
          />
        </label>
        <button className="button primary" type="submit">
          Aplicar filtros
        </button>
        <Link href="/admin/anuncios">Limpar</Link>
      </form>
      {failure ? (
        <AdminState error={failure} href={href} />
      ) : (
        result && (
          <>
            <div className="results-toolbar">
              <p>
                {result.data.length} anúncios nesta página · Página{" "}
                {result.meta.page}
              </p>
            </div>
            {result.data.length ? (
              <AdminPreviewProvider><div className="admin-queue">
                {result.data.map((p) => (
                  <article key={p.id} className="panel admin-queue-item">
                    <div>
                      <div className="admin-item-heading">
                        <h2>{p.title}</h2>
                        <span className="status-badge">
                          {statusLabel(p.status)}
                        </span>
                      </div>
                      <p>
                        {[p.neighborhood, p.city, p.region]
                          .filter(Boolean)
                          .join(" · ") || "Localização não informada"}
                      </p>
                      <p>
                        {modality(p.listing_type)} · {money(p.price, p.currency)}
                        {p.price != null ? period(p.price_type) : ""}
                      </p>
                      <p>{availability(p.availability)}</p>
                      <Link
                        href={`/admin/anuncios/${encodeURIComponent(p.id)}`}
                        prefetch={false}
                        className="button secondary"
                      >
                        Revisar<span className="sr-only"> {p.title}</span>
                      </Link>
                    </div>
                    <AdminListingPreviews id={String(p.id)} title={p.title} />
                  </article>
                ))}
              </div></AdminPreviewProvider>
            ) : (
              <div className="state-box" role="status">
                <h2>Nenhum anúncio nesta fila</h2>
                <p>Altere os filtros para consultar outros registros.</p>
              </div>
            )}
            <nav className="pagination" aria-label="Paginação da revisão">
              {filters.page > 1 && (
                <Link
                  className="button secondary"
                  prefetch={false}
                  href={`/admin/anuncios?${adminQuery({ ...filters, page: filters.page - 1 })}`}
                >
                  ← Anterior
                </Link>
              )}
              <span>Página {filters.page}</span>
              {result.meta.has_more && filters.page < 1000 && (
                <Link
                  className="button primary"
                  prefetch={false}
                  href={`/admin/anuncios?${adminQuery({ ...filters, page: filters.page + 1 })}`}
                >
                  Próxima →
                </Link>
              )}
            </nav>
          </>
        )
      )}
    </>
  );
}
