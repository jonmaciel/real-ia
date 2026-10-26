import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import { ConventionalSearchBar } from "@/components/search-form";
import { SearchAssistant } from "@/components/search-assistant";
import { PropertyGrid, ErrorState, EmptyState } from "@/components/properties";
import { search, assistantSearch, realEstateCategory, errorMessage } from "@/lib/api";
import { parseFilters, serialize, type Filters } from "@/lib/filters";
import { assistantSearchParams, exactFiltersSchema, parseAssistantSearch, type AssistantSearch } from "@/lib/assistant-search";
import { AppliedFilterPills } from "@/components/applied-filter-pills";
import { ConventionalFilterPills } from "@/components/conventional-filter-pills";
export const metadata = { ...pageMetadata("Buscar imóveis para comprar e alugar", "Encontre seu próximo imóvel com ajuda da IA ou use os filtros de cidade, bairro, preço e características na Morada.", "/buscar"), robots: { index: false, follow: true } };
export default async function Results({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const exact = raw.assistant === "1";
  let filters: Filters;
  let query: AssistantSearch;
  try {
    if (exact) {
      query = parseAssistantSearch(raw);
      const f = query.filters;
      filters = {
        city: f.city ?? undefined, neighborhood: f.neighborhood ?? undefined, region: f.region ?? undefined, country: f.country ?? undefined,
        listing_type: f.listing_type ?? undefined, currency: f.currency ?? "BRL", min_price: f.min_price == null ? undefined : String(f.min_price), max_price: f.max_price == null ? undefined : String(f.max_price),
        sort: f.sort === "price_asc" || f.sort === "price_desc" ? f.sort : "recent", page: query.page, per_page: query.perPage,
      };
    } else {
      if (raw.assistant !== undefined) throw new Error("invalid_request");
      filters = parseFilters(raw);
      query = { filters: Object.fromEntries(Object.entries(filters).filter(([key]) => key in exactFiltersSchema.shape)), excludedIds: [], page: filters.page, perPage: filters.per_page };
    }
  } catch {
    return <section className="section"><ErrorState message="Confira os filtros: valores, faixa de preço e palavra-chave de até 200 caracteres." /></section>;
  }
  let result;
  let category;
  let error: string | undefined;
  try {
    [result, category] = await Promise.all([exact ? assistantSearch(query) : search(filters), realEstateCategory()]);
  } catch (e) { error = errorMessage(e); }
  const queryKey = exact ? assistantSearchParams(query).toString() : `legacy:${serialize(filters)}`;
  const href = (page: number) => `/buscar?${exact ? assistantSearchParams({ ...query, page }) : serialize({ ...filters, page })}`;
  const appliedQuery = result && "applied_filters" in result.meta ? { ...query, filters: result.meta.applied_filters } : query;
  return <section className="section results">
    <nav className="breadcrumb"><Link href="/">Início</Link><span>/</span>Explorar imóveis</nav>
    <span className="eyebrow">O SEU LUGAR, DO SEU JEITO</span>
    <h1>Explore novas possibilidades.</h1>
    <SearchAssistant query={query} queryKey={queryKey} resultError={error}
      filterPills={exact ? <AppliedFilterPills query={appliedQuery} applied={!error} /> : <ConventionalFilterPills filters={filters} applied={!error} />}
      manualForm={<ConventionalSearchBar filters={filters} full assistantQuery={exact ? query : undefined} />}>
      <div className="results-toolbar">
        <p>{result && "total_count" in result.meta ? `${result.meta.total_count} imóveis` : result ? `${result.data.length} imóveis nesta página` : "Imóveis"} · Página {query.page}</p>
        <Link href="/buscar">Limpar filtros</Link>
      </div>
      {error ? <ErrorState message={error} href={href(query.page)} /> : result?.data.length ? <PropertyGrid properties={result.data} category={category} /> : <EmptyState />}
      {result && <nav className="pagination" aria-label="Paginação">
        {query.page > 1 && <Link className="button secondary" href={href(query.page - 1)}>← Anterior</Link>}
        <span>Página {query.page}</span>
        {result.meta.has_more && query.page < 1000 && <Link className="button primary" href={href(query.page + 1)}>Próxima →</Link>}
      </nav>}
    </SearchAssistant>
  </section>;
}
