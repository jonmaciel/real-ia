import Link from "next/link";
import { ConventionalSearchBar } from "@/components/search-form";
import { SearchAssistant } from "@/components/search-assistant";
import { PropertyGrid, ErrorState, EmptyState } from "@/components/properties";
import { search, realEstateCategory, errorMessage } from "@/lib/api";
import { parseFilters, serialize } from "@/lib/filters";
export const metadata = {
  title: "Explorar imóveis",
  robots: { index: false, follow: true },
};
export default async function Results({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  let filters;
  try {
    filters = parseFilters(raw);
  } catch {
    return (
      <section className="section">
        <ErrorState message="Confira os filtros: valores, faixa de preço e palavra-chave de até 200 caracteres." />
      </section>
    );
  }
  let result;
  let category;
  let error;
  try {
    [result, category] = await Promise.all([
      search(filters),
      realEstateCategory(),
    ]);
  } catch (e) {
    error = errorMessage(e);
  }
  const active = Object.entries(filters).filter(
    ([k, v]) =>
      !["page", "per_page", "sort"].includes(k) && v !== undefined && v !== "",
  );
  const labels: Record<string, string> = {
    city: "Cidade",
    neighborhood: "Bairro",
    region: "Estado",
    country: "País",
    listing_type: "Modalidade",
    currency: "Moeda",
    min_price: "Preço mínimo",
    max_price: "Preço máximo",
    q: "Título",
    availability: "Disponibilidade",
  };
  return (
    <section className="section results">
      <nav className="breadcrumb">
        <Link href="/">Início</Link>
        <span>/</span>Explorar imóveis
      </nav>
      <span className="eyebrow">O SEU LUGAR, DO SEU JEITO</span>
      <h1>Explore novas possibilidades.</h1>
      <details className="filter-panel" open>
        <summary>Filtros de busca</summary>
        <ConventionalSearchBar filters={filters} full />
      </details>
      <SearchAssistant />
      <div className="results-toolbar">
        <p>
          {result ? `${result.data.length} imóveis nesta página` : "Imóveis"} ·
          Página {filters.page}
        </p>
        <Link href="/buscar">Limpar filtros</Link>
      </div>
      <div className="chips" aria-label="Filtros aplicados">
        {active.map(([k, v]) =>
          k === "currency" ? (
            <span key={k}>
              {labels[k]}: {String(v)}
            </span>
          ) : (
            <Link
              key={k}
              aria-label={`Remover filtro ${labels[k]}`}
              href={`/buscar?${(() => {
                const next = { ...filters, page: 1 };
                delete (next as Record<string, unknown>)[k];
                return serialize(next);
              })()}`}
            >
              {labels[k]}:{" "}
              {v === "sale" ? "Compra" : v === "rental" ? "Aluguel" : String(v)}{" "}
              ×
            </Link>
          ),
        )}
      </div>
      {error ? (
        <ErrorState message={error} href={`/buscar?${serialize(filters)}`} />
      ) : result?.data.length ? (
        <PropertyGrid properties={result.data} category={category} />
      ) : (
        <EmptyState />
      )}
      {result && (
        <nav className="pagination" aria-label="Paginação">
          {filters.page > 1 && (
            <Link
              className="button secondary"
              href={`/buscar?${serialize({ ...filters, page: filters.page - 1 })}`}
            >
              ← Anterior
            </Link>
          )}
          <span>Página {filters.page}</span>
          {result.meta.has_more && filters.page < 1000 && (
            <Link
              className="button primary"
              href={`/buscar?${serialize({ ...filters, page: filters.page + 1 })}`}
            >
              Próxima →
            </Link>
          )}
        </nav>
      )}
    </section>
  );
}
