"use client";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, type MouseEvent } from "react";
import { assistantFilterPills } from "@/lib/assistant-presentation";
import { assistantSearchParams, removeAssistantFilter, type AssistantSearch } from "@/lib/assistant-search";
import type { AssistantFilters } from "@/lib/assistant-contracts";
import { useFilterNavigation } from "./filter-navigation";

export function AppliedFilterPills({ query, applied = true }: { query: AssistantSearch; applied?: boolean }) {
  const navigation = useFilterNavigation();
  const [selected, updateSelected] = useOptimistic(query, (_previous, next: AssistantSearch) => next);
  const latest = useRef<AssistantSearch | null>(null);
  useEffect(() => { if (!navigation.pending) latest.current = null; }, [navigation.pending, query]);
  function remove(event: MouseEvent<HTMLAnchorElement>, key: keyof AssistantFilters, value?: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const next = removeAssistantFilter(latest.current ?? selected, key, value);
    latest.current = next;
    navigation.navigate(`/buscar?${assistantSearchParams(next)}`, () => updateSelected(next));
  }
  return <div className="chips" aria-label={applied && !navigation.pending ? "Filtros aplicados" : "Filtros selecionados"}>
    {assistantFilterPills(selected.filters).map((pill) => pill.removable
      ? <Link key={`${pill.key}-${pill.value ?? ""}`} prefetch={false} scroll={false} aria-label={`Remover filtro ${pill.label}`}
        href={`/buscar?${assistantSearchParams(removeAssistantFilter(selected, pill.key, pill.value))}`}
        onClick={event => remove(event, pill.key, pill.value)}>
        {pill.label} <span aria-hidden="true">×</span>
      </Link>
      : <span key={`${pill.key}-${pill.value ?? ""}`}>{pill.label}</span>)}
    {selected.excludedIds.length > 0 && <span>{selected.excludedIds.length} {selected.excludedIds.length === 1 ? "imóvel excluído" : "imóveis excluídos"}</span>}
  </div>;
}
