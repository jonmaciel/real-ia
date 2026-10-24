"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { assigneesSchema, leadDetailSchema, leadEventsSchema, phoneValid, type Assignee, type Lead, type LeadDetail, type LeadEvent } from "@/lib/lead-contracts";
import { channelLabels, leadDate, leadStatusLabels, mergeLeadEvents } from "@/lib/lead-presentation";
import { money, period, safeUrl } from "@/lib/presentation";
import { LeadEventForm } from "./lead-event-form";
import { LeadTimeline } from "./lead-timeline";
import { PropertyCosts } from "./property-costs";
import { useLeadRequest, type LeadClientError } from "./use-lead-request";
export function LeadDetailView({ initial, initialAssignees, publicHref }: { initial: LeadDetail; initialAssignees: Assignee[] | null; publicHref: string | null }) {
  const [lead, setLead] = useState<Lead>(initial.data); const [events, setEvents] = useState(initial.data.events);
  const [assignees, setAssignees] = useState(initialAssignees); const [nextPage, setNextPage] = useState(2); const [more, setMore] = useState(initial.meta.events_has_more);
  const [authError, setAuthError] = useState<LeadClientError | null>(null); const [copyStatus, setCopyStatus] = useState("");
  const read = useLeadRequest(); const router = useRouter();
  const blocked = authError ?? (read.error && [401, 403].includes(read.error.status) ? read.error : null);
  useEffect(() => { if (blocked?.status === 401) router.replace("/auth/login"); }, [blocked, router]);
  async function reload() {
    const detail = await read.run(`/api/admin/interessados/${lead.id}`, leadDetailSchema);
    if (!detail) return false;
    setLead(prev => detail.data.version >= prev.version ? detail.data : prev); setEvents(prev => mergeLeadEvents(prev, detail.data.events)); setNextPage(2); setMore(detail.meta.events_has_more);
    const people = await read.run("/api/admin/interessados/assignees", assigneesSchema);
    setAssignees(people?.data ?? null); return true;
  }
  async function loadMore() {
    const data = await read.run(`/api/admin/interessados/${lead.id}/events?page=${nextPage}&per_page=50`, leadEventsSchema);
    if (data) { setEvents(prev => mergeLeadEvents(prev, data.data)); setMore(data.meta.has_more); setNextPage(prev => prev + 1); }
  }
  function updated(next: Lead, event: LeadEvent) { setLead(prev => next.version >= prev.version ? next : prev); setEvents(prev => mergeLeadEvents(prev, [event])); }
  async function copyContact(value: string) { try { await navigator.clipboard.writeText(value); setCopyStatus("Contato copiado."); } catch { setCopyStatus("Não foi possível copiar. Selecione o contato e copie manualmente."); } }
  if (blocked) return <div className="state-box" role="alert"><h1>{blocked.status === 401 ? "Sessão expirada" : "Acesso restrito"}</h1><p>{blocked.message}</p><Link href="/auth/login">Entrar novamente</Link></div>;
  const email = lead.email && z.email().safeParse(lead.email).success ? lead.email : null;
  const phone = lead.phone && phoneValid(lead.phone) ? lead.phone.replace(/[\s().-]/g, "") : null;
  const snapshot = lead.listing_snapshot; const original = safeUrl(snapshot.source?.original_url);
  return <>
    <div className="section-heading"><div><span className="eyebrow">ACOMPANHAMENTO PRIVADO</span><h1>{lead.name}</h1><p>Captado em {leadDate(lead.created_at)} · Horários de Brasília</p></div><span className={`lead-stage lead-stage-${lead.status}`}>{leadStatusLabels[lead.status]}</span></div>
    <div className="lead-detail-grid">
      <div>
        <section className="panel"><h2>Contato autorizado</h2><p>Canal preferido: {channelLabels[lead.preferred_contact]}. Abrir ou copiar um contato não registra contato realizado.</p>
          <dl className="interest-review"><dt>E-mail</dt><dd>{lead.email ?? "Não informado"}</dd><dt>Telefone</dt><dd>{lead.phone ?? "Não informado"}</dd><dt>Responsável</dt><dd>{lead.assigned_to?.name ?? "Sem responsável"}</dd><dt>Consentimento</dt><dd>{leadDate(lead.consent_at)} · {lead.consent_version ?? "Versão não informada"}</dd></dl>
          <div className="lead-contact-actions">{email && <><a className="button secondary" href={`mailto:${encodeURIComponent(email)}`}>Abrir e-mail</a><button className="button secondary" type="button" onClick={() => void copyContact(email)}>Copiar e-mail</button></>}{phone && <><a className="button secondary" href={`tel:${phone}`}>Abrir telefone</a><button className="button secondary" type="button" onClick={() => void copyContact(phone)}>Copiar telefone</button></>}{phone?.startsWith("+") && <a className="button secondary" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${phone.slice(1)}`}>Abrir WhatsApp com número informado</a>}</div><p role="status">{copyStatus}</p>
          {lead.message && <><h3>Mensagem na captação</h3><p className="lead-free-text">{lead.message}</p></>}
        </section>
        <section className="panel"><h2>Imóvel na captação</h2><p>Snapshot preservado no momento do interesse. O anúncio atual pode ter mudado ou deixado de estar disponível.</p><h3>{snapshot.title ?? "Título não informado"}</h3><p>{[snapshot.neighborhood, snapshot.city, snapshot.region].filter(Boolean).join(" · ")}</p><p>{money(snapshot.price, snapshot.currency ?? null)}{snapshot.price != null ? period(snapshot.price_type) : ""}</p>{snapshot.pricing && <PropertyCosts property={{ ...snapshot, listing_type: snapshot.listing_type ?? "" }} />}{snapshot.source && <p>Origem captada: {snapshot.source.name} · ID do anúncio de origem: {snapshot.source.id}</p>}{original && <a className="text-link" href={original} target="_blank" rel="noopener noreferrer">Abrir origem da captação ↗</a>}{publicHref ? <p><Link href={publicHref} prefetch={false}>Consultar anúncio público atual</Link></p> : <p>Anúncio público atual não disponível ou não confirmado. Os dados da captação permanecem acima.</p>}</section>
        <section className="panel"><h2>Marcos e resultado</h2><dl className="interest-review">{[["Primeiro contato realizado", lead.first_contacted_at], ["Primeira visita realizada", lead.first_visit_completed_at], ["Primeiro ganho", lead.first_won_at], ["Visita prevista", lead.visit_scheduled_at], ["Fechamento atual", lead.closed_at]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{leadDate(value)}</dd></div>)}{lead.closed_amount != null && <div><dt>Valor de fechamento</dt><dd>{money(lead.closed_amount, lead.closed_currency ?? null)}</dd></div>}{lead.lost_reason && <div><dt>Motivo da perda</dt><dd className="lead-free-text">{lead.lost_reason}</dd></div>}</dl><p>Marcos históricos não significam que o caso continua aberto. O resultado deste acompanhamento não muda o status do imóvel.</p></section>
      </div>
      <LeadEventForm lead={lead} assignees={assignees ?? []} assigneesAvailable={assignees !== null} onSuccess={updated} onReload={reload} onAuthError={setAuthError} />
    </div>
    <section className="panel lead-history"><div className="section-heading"><div><h2>Histórico de acompanhamento</h2><p>Mais recentes por ordem de registro. A data da ação pode ser diferente da data de registro.</p></div><button className="button secondary" type="button" disabled={read.busy || read.secondsLeft > 0} onClick={() => void reload()}>{read.busy ? "Atualizando…" : "Atualizar detalhe"}</button></div><LeadTimeline events={events} />{more && <button className="button secondary" type="button" disabled={read.busy || read.secondsLeft > 0 || nextPage > 1000} onClick={() => void loadMore()}>Carregar eventos anteriores</button>}{read.error && <p className="form-error" role="alert">{read.error.message}</p>}{read.secondsLeft > 0 && <p role="status">Aguarde {read.secondsLeft} s para tentar novamente.</p>}</section>
    <Link href="/admin/interessados" prefetch={false}>Voltar aos interessados</Link>
  </>;
}
