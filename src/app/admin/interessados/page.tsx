import Link from "next/link";
import { ApiError } from "@/lib/api";
import { requireAdmin } from "@/lib/admin-api";
import { leadRequest } from "@/lib/lead-api";
import { assigneesSchema, leadListSchema, leadSummarySchema, parseLeadFilters, leadQuery, leadStatuses } from "@/lib/lead-contracts";
import { leadDate, leadRate, leadStatusLabels } from "@/lib/lead-presentation";
import { LeadAdminState } from "@/components/lead-admin-state";
import { LeadFiltersForm } from "@/components/lead-filters";
export const metadata = { title: "Interessados", robots: { index: false, follow: false } };
export default async function Leads({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  let auth; try { auth = await requireAdmin(); } catch (error) { return <LeadAdminState error={error} href="/admin/interessados" />; }
  let filters; try { filters = parseLeadFilters(await searchParams); } catch { return <div className="state-box" role="alert"><h1>Filtros inválidos</h1><p>Use apenas os filtros de etapa, imóvel, responsável, período e paginação.</p><Link href="/admin/interessados">Limpar filtros</Link></div>; }
  const headers = { Authorization: `Bearer ${auth.token}` }; const href = `/admin/interessados?${leadQuery(filters)}`;
  const [list, summary, assignees] = await Promise.allSettled([
    leadRequest(`/admin/leads?${leadQuery(filters)}`, leadListSchema, { headers }),
    leadRequest(`/admin/leads/summary?${leadQuery(filters, true)}`, leadSummarySchema, { headers }),
    leadRequest("/admin/leads/assignees", assigneesSchema, { headers }),
  ]);
  for (const result of [list, summary, assignees]) if (result.status === "rejected" && result.reason instanceof ApiError && [401, 403].includes(result.reason.status)) return <LeadAdminState error={result.reason} href={href} />;
  const metrics = summary.status === "fulfilled" ? summary.value.body.data : null;
  return <>
    <span className="eyebrow">RELACIONAMENTO MORADA</span><h1>Interessados</h1><p>Acompanhe contatos, visitas e resultados registrados pela equipe. Nenhuma ação aqui envia mensagens automaticamente.</p>
    <LeadFiltersForm key={leadQuery(filters).toString()} filters={filters} assignees={assignees.status === "fulfilled" ? assignees.value.body.data : []} />
    {assignees.status === "rejected" && <p role="status">Não foi possível carregar os responsáveis. Recarregue para consultar a lista atualizada.</p>}
    {metrics ? <section className="lead-summary" aria-labelledby="lead-summary-title"><h2 id="lead-summary-title">Resumo da coorte captada</h2><p><strong>{metrics.captured_total}</strong> interessados captados nos filtros selecionados. As taxas usam esse total como denominador.</p>
      <h3>Etapas atuais</h3><dl className="lead-status-counts">{leadStatuses.map(status => <div key={status}><dt>{leadStatusLabels[status]}</dt><dd>{metrics.by_status[status]}</dd></div>)}</dl>
      <h3>Marcos já alcançados</h3><dl className="lead-milestones">{(["contacted", "visited", "won"] as const).map(key => <div key={key}><dt>{({ contacted: "Contato realizado", visited: "Visita realizada", won: "Ganho" })[key]}</dt><dd>{metrics.milestones[key]} <small>{leadRate(metrics.conversion_rates[key])} do total captado</small></dd></div>)}</dl><p className="lead-help">Os marcos históricos são preservados mesmo após perda ou reabertura. Agendamentos não contam como visitas realizadas. As taxas não medem conversões entre etapas consecutivas nem causalidade de campanhas.</p>
    </section> : summary.status === "rejected" && <LeadAdminState error={summary.reason} href={href} />}
    {list.status === "rejected" ? <LeadAdminState error={list.reason} href={href} /> : <>
      <p>{list.value.body.meta.total_count} interessados · Página {list.value.body.meta.page}</p>
      {list.value.body.data.length ? <div className="lead-table-scroll" role="region" aria-label="Lista de interessados" tabIndex={0}><table className="lead-table"><thead><tr><th>Interessado</th><th>Imóvel na captação</th><th>Etapa</th><th>Responsável</th><th>Captado em</th><th>Visita prevista</th><th>Atualizado em</th></tr></thead><tbody>{list.value.body.data.map(lead => <tr key={lead.id}><td><Link prefetch={false} href={`/admin/interessados/${lead.id}`}>{lead.name}</Link><small>{lead.preferred_contact === "email" ? "Prefere e-mail" : lead.preferred_contact === "whatsapp" ? "Prefere WhatsApp" : "Prefere telefone"}</small></td><td>{lead.listing_snapshot.title ?? "Título não informado"}</td><td><span className={`lead-stage lead-stage-${lead.status}`}>{leadStatusLabels[lead.status]}</span></td><td>{lead.assigned_to?.name ?? "Sem responsável"}</td><td>{leadDate(lead.created_at)}</td><td>{leadDate(lead.visit_scheduled_at)}</td><td>{leadDate(lead.updated_at)}</td></tr>)}</tbody></table></div> : <div className="state-box" role="status"><h2>Nenhum interessado nestes filtros</h2><p>Ajuste os critérios para consultar outros registros.</p></div>}
      <nav className="pagination" aria-label="Paginação de interessados">{filters.page > 1 && <Link className="button secondary" prefetch={false} href={`/admin/interessados?${leadQuery({ ...filters, page: filters.page - 1 })}`}>← Anterior</Link>}<span>Página {filters.page}</span>{list.value.body.meta.has_more && filters.page < 1000 && <Link className="button secondary" prefetch={false} href={`/admin/interessados?${leadQuery({ ...filters, page: filters.page + 1 })}`}>Próxima →</Link>}</nav>
    </>}
  </>;
}
