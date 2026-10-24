"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leadStatuses, parseLeadFilters, leadQuery, type LeadFilters, type Assignee } from "@/lib/lead-contracts";
import { localDateInput, localInstant, leadStatusLabels } from "@/lib/lead-presentation";
export function LeadFiltersForm({ filters, assignees }: { filters: LeadFilters; assignees: Assignee[] }) {
  const router = useRouter(); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  return <form className="panel lead-filters" onSubmit={e => {
    e.preventDefault();
    try {
      const values: Record<string, string> = {};
      for (const [key, value] of new FormData(e.currentTarget)) if (typeof value === "string" && value.trim()) {
        if (key === "created_from" || key === "created_to") {
          const previous = filters[key];
          // Keep seconds, offset and the precise instant when this control is unchanged.
          values[key] = previous && value === localDateInput(previous) ? previous : localInstant(value);
        } else values[key] = value;
      }
      const parsed = parseLeadFilters(values); setError("");
      startTransition(() => router.push(`/admin/interessados?${leadQuery(parsed)}`, { scroll: false }));
    } catch { setError("Confira IDs, paginação e datas. O início deve ser anterior ao fim do período."); }
  }}>
    <label>Etapa<select aria-label="Etapa" name="status" defaultValue={filters.status ?? ""}><option value="">Todas</option>{leadStatuses.map(s => <option key={s} value={s}>{leadStatusLabels[s]}</option>)}</select></label>
    <label>ID do imóvel<input name="listing_id" inputMode="numeric" pattern="[1-9][0-9]*" defaultValue={filters.listing_id} /></label>
    <label>Responsável<select aria-label="Responsável" name="assigned_to_id" defaultValue={filters.assigned_to_id ?? ""}><option value="">Todos</option><option value="unassigned">Sem responsável</option>{filters.assigned_to_id && filters.assigned_to_id !== "unassigned" && !assignees.some(a => String(a.id) === filters.assigned_to_id) && <option value={filters.assigned_to_id}>ID {filters.assigned_to_id}</option>}{assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
    <label>Captado a partir de (inclusive)<input type="datetime-local" name="created_from" defaultValue={localDateInput(filters.created_from)} /></label>
    <label>Captado antes de (exclusivo)<input type="datetime-local" name="created_to" defaultValue={localDateInput(filters.created_to)} /></label>
    <label>Itens por página<input type="number" min={1} max={100} name="per_page" defaultValue={filters.per_page} required /></label>
    <p className="lead-help">Datas e horários usam Brasília (America/Sao_Paulo) e são enviados com fuso. O início é inclusivo; o fim é exclusivo.</p>
    <button className="button primary" type="submit" disabled={pending}>{pending ? "Filtrando…" : "Filtrar interessados"}</button><Link href="/admin/interessados" prefetch={false}>Limpar filtros</Link>
    {error && <p role="alert" className="form-error">{error}</p>}
  </form>;
}
