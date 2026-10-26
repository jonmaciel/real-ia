"use client";
import Link from "next/link";
import { useEffect, useOptimistic, useRef, type MouseEvent } from "react";
import { serialize, type Filters } from "@/lib/filters";
import { useFilterNavigation } from "./filter-navigation";
const labels: Record<string, string> = { city: "Cidade", neighborhood: "Bairro", region: "Estado", country: "País", listing_type: "Modalidade", currency: "Moeda", min_price: "Preço mínimo", max_price: "Preço máximo", q: "Título", availability: "Disponibilidade" };
export function ConventionalFilterPills({ filters, applied = true }: { filters: Filters; applied?: boolean }) {
  const navigation = useFilterNavigation();
  const [selected, updateSelected] = useOptimistic(filters, (_previous, next: Filters) => next);
  const latest = useRef<Filters | null>(null);
  useEffect(() => { if (!navigation.pending) latest.current = null; }, [navigation.pending, filters]);
  function without(source: Filters, key: string) { const next = { ...source, page: 1 }; delete (next as Record<string, unknown>)[key]; return next; }
  function remove(event: MouseEvent<HTMLAnchorElement>, key: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const next = without(latest.current ?? selected, key); latest.current = next;
    navigation.navigate(`/buscar?${serialize(next)}`, () => updateSelected(next));
  }
  return <div className="chips" aria-label={applied && !navigation.pending ? "Filtros aplicados" : "Filtros selecionados"}>
    {Object.entries(selected).filter(([key, value]) => !["page", "per_page", "sort"].includes(key) && value !== undefined && value !== "" && !(key === "currency" && value === "BRL")).map(([key, value]) => key === "currency" ? <span key={key}>Moeda: {String(value)}</span> : <Link key={key} prefetch={false} scroll={false} aria-label={`Remover filtro ${labels[key]}`} href={`/buscar?${serialize(without(selected, key))}`} onClick={event => remove(event, key)}>{labels[key]}: {value === "sale" ? "Compra" : value === "rental" ? "Aluguel" : String(value)} ×</Link>)}
  </div>;
}
