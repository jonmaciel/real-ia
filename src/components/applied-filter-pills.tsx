import Link from "next/link";
import { assistantFilterPills } from "@/lib/assistant-presentation";
import { assistantSearchParams, removeAssistantFilter, type AssistantSearch } from "@/lib/assistant-search";

export function AppliedFilterPills({ query, applied = true }: { query: AssistantSearch; applied?: boolean }) {
  return <div className="chips" aria-label={applied ? "Filtros aplicados" : "Filtros selecionados"}>
    {assistantFilterPills(query.filters).map((pill, index) => pill.removable
      ? <Link key={`${pill.key}-${index}`} prefetch={false} aria-label={`Remover filtro ${pill.label}`}
        href={`/buscar?${assistantSearchParams(removeAssistantFilter(query, pill.key, pill.value))}`}>
        {pill.label} <span aria-hidden="true">×</span>
      </Link>
      : <span key={`${pill.key}-${index}`}>{pill.label}</span>)}
    {query.excludedIds.length > 0 && <span>{query.excludedIds.length} {query.excludedIds.length === 1 ? "imóvel excluído" : "imóveis excluídos"}</span>}
  </div>;
}
