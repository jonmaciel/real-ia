"use client";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { interestSchema, interestReceiptSchema, phoneValid, type InterestInput } from "@/lib/lead-contracts";
import { channelLabels } from "@/lib/lead-presentation";
import { useLeadRequest } from "./use-lead-request";

export function PropertyInterest({ listingId, title, unavailable = false, disabled = false }: { listingId: string; title: string; unavailable?: boolean; disabled?: boolean }) {
  const id = useId(); const dialog = useRef<HTMLDialogElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false); const [form, setForm] = useState({ name: "", email: "", phone: "", preferred_contact: "email", message: "", consent: false });
  const [review, setReview] = useState<InterestInput | null>(null); const [sent, setSent] = useState(false); const [attempted, setAttempted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({}); const request = useLeadRequest();
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    if (open && dialog.current?.open) dialog.current.querySelector<HTMLElement>(review || sent ? "h2" : "input[name=name]")?.focus();
  }, [open, review, sent]);
  function close() { dialog.current?.close(); setOpen(false); trigger.current?.focus(); }
  function edit() { setErrors(request.error?.fields ?? {}); setReview(null); setAttempted(false); setSent(false); request.clearError(); }
  function prepare(event: React.FormEvent) {
    event.preventDefault();
    const parsed = interestSchema.safeParse({ name: form.name.trim(), ...(form.email.trim() ? { email: form.email.trim() } : {}), ...(form.phone.trim() ? { phone: form.phone.trim() } : {}), preferred_contact: form.preferred_contact, ...(form.message.trim() ? { message: form.message.trim() } : {}), consent: form.consent, entry_point: "listing", idempotency_key: crypto.randomUUID() });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[String(issue.path[0])] = issue.message;
      setErrors(fields); requestAnimationFrame(() => dialog.current?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus()); return;
    }
    setErrors({}); setReview(parsed.data); request.clearError();
  }
  async function confirm() {
    if (!review || request.busy || request.secondsLeft) return;
    setAttempted(true);
    const result = await request.run(`/api/imoveis/${encodeURIComponent(listingId)}/interesses`, interestReceiptSchema, JSON.stringify(review));
    if (result) { setSent(true); setReview(null); setForm({ name: "", email: "", phone: "", preferred_contact: "email", message: "", consent: false }); }
  }
  const fieldErrors = { ...errors, ...request.error?.fields };
  const labels = { name: "Nome", email: "E-mail", phone: "Telefone", preferred_contact: "Canal preferido", message: "Mensagem (opcional)", consent: "Autorizo a Morada a entrar em contato comigo sobre este imóvel" };
  function field(name: keyof typeof form) { return { id: `${id}-${name}`, "aria-label": labels[name], "aria-invalid": Boolean(fieldErrors[name]), "aria-describedby": fieldErrors[name] ? `${id}-${name}-error` : undefined }; }
  const feedback = (name: string) => fieldErrors[name] && <small id={`${id}-${name}-error`} className="form-error">{fieldErrors[name]}</small>;
  return <>
    <button ref={trigger} type="button" className="button primary interest-trigger" disabled={disabled || unavailable} onClick={() => setOpen(true)}>Tenho interesse</button>
    {unavailable && <p className="cost-note">Imóvel informado como indisponível para novos interesses.</p>}
    {open && createPortal(<dialog ref={dialog} className="interest-dialog" aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <header><h2 id={`${id}-title`} tabIndex={-1}>{sent ? "Interesse registrado" : review ? "Confira seu interesse" : "Tenho interesse neste imóvel"}</h2><button type="button" className="dialog-close" aria-label="Fechar formulário de interesse" onClick={close}><X size={20} /></button></header>
      <p className="interest-property">{title}</p>
      {sent ? <div role="status"><p>A Morada recebeu seu pedido de contato sobre este imóvel.</p><p>Isso não significa mensagem entregue, visita confirmada ou disponibilidade garantida.</p><button type="button" className="button secondary" onClick={close}>Concluir</button><button type="button" className="text-link" onClick={edit}>Registrar outra solicitação</button></div>
        : review ? <div>
          <dl className="interest-review"><dt>Nome</dt><dd>{review.name}</dd><dt>E-mail</dt><dd>{review.email || "Não informado"}</dd><dt>Telefone</dt><dd>{review.phone || "Não informado"}</dd><dt>Canal preferido</dt><dd>{channelLabels[review.preferred_contact]}</dd>{review.message && <><dt>Mensagem</dt><dd>{review.message}</dd></>}<dt>Consentimento</dt><dd>Contato da Morada sobre este imóvel, conforme sua autorização.</dd></dl>
          <p>O pedido não reserva o imóvel nem confirma disponibilidade.</p>
          {request.error?.code !== "idempotency_conflict" && <button type="button" className="button primary" disabled={request.busy || request.secondsLeft > 0 || [404].includes(request.error?.status ?? 0) || request.error?.code === "listing_unavailable"} onClick={() => void confirm()}>{request.busy ? "Registrando…" : attempted ? "Tentar o mesmo envio novamente" : "Confirmar interesse"}</button>}
          <button type="button" className="button secondary" disabled={request.busy} onClick={edit}>{attempted ? "Revisar nova solicitação" : "Voltar e editar"}</button>
          {attempted && request.error && <p className="interest-hint">Uma falha de rede pode ocorrer após o registro. Repetir o mesmo envio usa a mesma chave. Uma nova solicitação revisada será independente.</p>}
          {Object.values(request.error?.fields ?? {}).map((value, index) => <p className="form-error" key={index}>{value} Use “Revisar nova solicitação” para corrigir.</p>)}
        </div> : <form onSubmit={prepare} noValidate className="interest-form">
          <label htmlFor={`${id}-name`}>Nome<input {...field("name")} name="name" autoComplete="name" maxLength={100} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />{feedback("name")}</label>
          <label htmlFor={`${id}-email`}>E-mail<input {...field("email")} type="email" autoComplete="email" maxLength={254} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />{feedback("email")}</label>
          <label htmlFor={`${id}-phone`}>Telefone<input {...field("phone")} type="tel" autoComplete="tel" maxLength={100} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value, preferred_contact: form.preferred_contact === "whatsapp" && !phoneValid(e.target.value) ? "phone" : form.preferred_contact })} />{feedback("phone")}</label>
          <small>Informe e-mail ou telefone. O contato correspondente ao canal escolhido é obrigatório. Não acrescentamos código de país ao telefone.</small>
          <label htmlFor={`${id}-preferred_contact`}>Canal preferido<select {...field("preferred_contact")} value={form.preferred_contact} onChange={e => setForm({ ...form, preferred_contact: e.target.value })}><option value="email">E-mail</option><option value="phone">Telefone</option>{phoneValid(form.phone) && <option value="whatsapp">WhatsApp</option>}</select>{feedback("preferred_contact")}</label>
          <label htmlFor={`${id}-message`}>Mensagem (opcional)<textarea {...field("message")} rows={3} maxLength={2000} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />{feedback("message")}</label>
          <label className="interest-consent"><input {...field("consent")} type="checkbox" checked={form.consent} onChange={e => setForm({ ...form, consent: e.target.checked })} required /><span>Autorizo a Morada a entrar em contato comigo sobre este imóvel. Li a <Link href="/privacidade" target="_blank" rel="noopener noreferrer">política de privacidade</Link>.</span></label>{feedback("consent")}
          <button type="submit" className="button primary">Revisar solicitação</button>
        </form>}
      {request.error && <p role="alert" className="form-error">{request.error.message}</p>}
      {request.secondsLeft > 0 && <p role="status">Tente novamente em {request.secondsLeft} s.</p>}
    </dialog>, document.body)}
  </>;
}
