"use client";
import { useId, useRef, useState } from "react";
import { leadEventReceiptSchema, type Assignee, type Lead, type LeadEvent, type LeadEventInput } from "@/lib/lead-contracts";
import { buildLeadEvent, type EventForm } from "@/lib/lead-event-form";
import { channelLabels, leadActionLabels, leadDate } from "@/lib/lead-presentation";
import { useLeadRequest, type LeadClientError } from "./use-lead-request";
export function LeadEventForm({ lead, assignees, assigneesAvailable, onSuccess, onReload, onAuthError }: {
  lead: Lead; assignees: Assignee[]; assigneesAvailable: boolean;
  onSuccess: (lead: Lead, event: LeadEvent) => void; onReload: () => Promise<boolean>; onAuthError: (error: LeadClientError) => void;
}) {
  const [form, setForm] = useState<EventForm>({ event_type: "", channel: "email", occurred_at: "", scheduled_at: "", note: "", reason: "", assigned_to_id: "", closed_amount: "", closed_currency: "" });
  const [review, setReview] = useState<LeadEventInput | null>(null); const [sent, setSent] = useState(false);
  const [validation, setValidation] = useState(""); const [blocked, setBlocked] = useState(false); const [reconciled, setReconciled] = useState(false); const [refreshing, setRefreshing] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const request = useLeadRequest(); const feedback = useRef<HTMLParagraphElement>(null); const root = useRef<HTMLElement>(null);
  const id = useId();
  function update(key: keyof EventForm, value: string) { setForm(prev => ({ ...prev, [key]: value })); }
  function prepare(e: React.FormEvent) {
    e.preventDefault(); setSent(false);
    try { setReview(buildLeadEvent(form, lead, crypto.randomUUID())); setValidation(""); setFieldErrors({}); request.clearError(); requestAnimationFrame(() => root.current?.querySelector<HTMLElement>("[data-lead-review]")?.focus()); }
    catch (error) { setValidation(error instanceof Error ? error.message : "Confira os campos."); requestAnimationFrame(() => feedback.current?.focus()); }
  }
  async function refresh() { setRefreshing(true); const ok = await onReload(); setReconciled(ok); setRefreshing(false); }
  async function confirm() {
    if (!review || blocked) return;
    const result = await request.run(`/api/admin/interessados/${lead.id}/events`, leadEventReceiptSchema, JSON.stringify(review), error => {
      setFieldErrors(error.fields);
      if ([401, 403].includes(error.status)) onAuthError(error);
      if (["lead_outdated", "invalid_transition", "invalid_assignee", "idempotency_conflict"].includes(error.code)) {
        setBlocked(true); setReconciled(false); void refresh();
      }
    });
    if (result) { onSuccess(result.data.lead, result.data.event); setReview(null); setForm(prev => ({ ...prev, event_type: "", note: "", reason: "", occurred_at: "", scheduled_at: "", closed_amount: "", closed_currency: "" })); setSent(true); requestAnimationFrame(() => root.current?.querySelector("select")?.focus()); }
  }
  function revise() { setReview(null); setBlocked(false); setValidation(""); request.clearError(); }
  const errorFor = (key: string) => fieldErrors[key] && <small id={`${id}-${key}-error`} className="form-error">{fieldErrors[key]}</small>;
  const fieldLabels: Record<keyof EventForm, string> = { event_type: "Ação", channel: "Canal do contato", occurred_at: "Quando a ação aconteceu (opcional, horário de Brasília)", scheduled_at: "Visita prevista (horário de Brasília)", assigned_to_id: "Responsável", reason: "Motivo", note: form.event_type === "note" ? "Nota" : "Nota (opcional)", closed_amount: "Valor do fechamento", closed_currency: "Moeda do fechamento" };
  const set = (key: keyof EventForm) => ({ value: form[key], "aria-label": fieldLabels[key], "aria-invalid": Boolean(fieldErrors[key]), "aria-describedby": fieldErrors[key] ? `${id}-${key}-error` : undefined, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => update(key, e.target.value), disabled: request.busy || refreshing });
  const reviewLabels: Record<string, string> = { note: "Nota", reason: "Motivo", channel: "Canal", scheduled_at: "Visita prevista", occurred_at: "Quando aconteceu", assigned_to_id: "Responsável", closed_amount: "Valor efetivo do fechamento", closed_currency: "Moeda do fechamento" };
  return <section ref={root} className="panel lead-action-panel" aria-labelledby="lead-action-title">
    <h2 id="lead-action-title">Registrar acompanhamento</h2>
    <p>Registre fatos confirmados. Este registro não envia mensagens, não cria evento em calendário e não altera a disponibilidade do imóvel.</p>
    {!assigneesAvailable && <p role="status">Responsáveis indisponíveis. Use “Atualizar detalhe” antes de alterar a atribuição.</p>}
    {review ? <div>
      <h3 data-lead-review tabIndex={-1}>Confirme a ação</h3><p>{leadActionLabels[review.event_type]} · Versão revisada: {review.version}</p>
      <dl className="interest-review">{Object.entries(review).filter(([key]) => reviewLabels[key]).map(([key, value]) => <div key={key}><dt>{reviewLabels[key]}</dt><dd>{key.endsWith("_at") ? leadDate(String(value)) : key === "channel" ? channelLabels[String(value)] : key === "assigned_to_id" ? value == null ? "Sem responsável" : assignees.find(a => String(a.id) === String(value))?.name ?? "Responsável selecionado" : String(value)}</dd></div>)}</dl>
      {!blocked && <button className="button primary" type="button" disabled={request.busy || request.secondsLeft > 0} onClick={() => void confirm()}>{request.busy ? "Registrando…" : request.error ? "Repetir a mesma ação" : "Confirmar registro"}</button>}
      <button className="button secondary" type="button" disabled={request.busy || refreshing || (blocked && !reconciled)} onClick={revise}>{blocked ? "Revisar versão atual e preparar nova ação" : "Voltar e revisar"}</button>
      {blocked && !reconciled && <button className="button secondary" type="button" disabled={refreshing || request.secondsLeft > 0} onClick={() => void refresh()}>{refreshing ? "Atualizando…" : "Recarregar detalhe"}</button>}
    </div> : <form onSubmit={prepare} className="lead-action-form">
      <label>Ação<select {...set("event_type")} required><option value="">Selecione uma ação</option>{lead.allowed_event_types.filter(kind => kind !== "assigned" || assigneesAvailable).map(kind => <option key={kind} value={kind}>{leadActionLabels[kind]}</option>)}</select></label>
      {["contacted", "contact_attempt"].includes(form.event_type) && <label>Canal do contato<select {...set("channel")}><option value="email">E-mail</option><option value="phone">Telefone</option><option value="whatsapp">WhatsApp</option></select>{errorFor("channel")}</label>}
      {form.event_type === "visit_scheduled" && <label>Visita prevista (horário de Brasília)<input type="datetime-local" {...set("scheduled_at")} required />{errorFor("scheduled_at")}</label>}
      {["lost", "reopened"].includes(form.event_type) && <label>Motivo<textarea {...set("reason")} maxLength={500} required />{errorFor("reason")}</label>}
      {form.event_type === "assigned" && <label>Responsável<select {...set("assigned_to_id")}><option value="">Sem responsável</option>{assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>{errorFor("assigned_to_id")}</label>}
      {form.event_type === "won" && <><p>Valor e moeda são opcionais e devem refletir o negócio efetivamente fechado. Não preenchemos pelo preço do anúncio.</p><label>Valor do fechamento<input inputMode="decimal" {...set("closed_amount")} placeholder="Somente se conhecido" />{errorFor("closed_amount")}</label><label>Moeda do fechamento<input {...set("closed_currency")} maxLength={3} placeholder="Ex.: BRL" />{errorFor("closed_currency")}</label></>}
      {form.event_type && <><label>Quando a ação aconteceu (opcional, horário de Brasília)<input type="datetime-local" {...set("occurred_at")} />{errorFor("occurred_at")}</label><p className="lead-help">Deixe vazio para registrar o momento atual. Datas são convertidas em instantes com fuso; a linha do tempo usa Brasília (America/Sao_Paulo).</p><label>Nota{form.event_type !== "note" && " (opcional)"}<textarea {...set("note")} maxLength={2000} required={form.event_type === "note"} />{errorFor("note")}</label></>}
      <button className="button primary" type="submit" disabled={!form.event_type || refreshing}>Revisar ação</button>
    </form>}
    {sent && <p role="status" className="form-success">Acompanhamento registrado.</p>}
    {validation && <p ref={feedback} tabIndex={-1} role="alert" className="form-error">{validation}</p>}
    {request.error && <p role="alert" className="form-error">{request.error.message} Seus campos foram preservados.</p>}
    {request.secondsLeft > 0 && <p role="status">Aguarde {request.secondsLeft} s antes de tentar novamente.</p>}
  </section>;
}
