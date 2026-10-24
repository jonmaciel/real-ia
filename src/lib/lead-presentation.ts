import type { LeadEvent } from "./lead-contracts";
export const leadStatusLabels: Record<string, string> = { new: "Novo", contacted: "Contato realizado", visit_scheduled: "Visita agendada", visited: "Visita realizada", negotiating: "Em negociação", won: "Ganho", lost: "Perdido" };
export const leadActionLabels: Record<string, string> = { interest_received: "Interesse recebido", contact_attempt: "Registrar tentativa de contato", contacted: "Registrar contato realizado", visit_scheduled: "Agendar ou reagendar visita", visit_completed: "Registrar visita realizada", negotiating: "Iniciar negociação", won: "Registrar ganho", lost: "Registrar perda", reopened: "Reabrir caso", assigned: "Alterar responsável", note: "Adicionar nota" };
export const channelLabels: Record<string, string> = { email: "E-mail", phone: "Telefone", whatsapp: "WhatsApp" };
export function leadDate(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "—";
}
export function leadRate(value: number | null) { return value == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value); }
export function mergeLeadEvents(...groups: LeadEvent[][]) {
  const byId = new Map<string, LeadEvent>();
  for (const group of groups) for (const event of group) byId.set(String(event.id), event);
  return [...byId.values()].sort((a, b) => BigInt(a.id) > BigInt(b.id) ? -1 : BigInt(a.id) < BigInt(b.id) ? 1 : 0);
}
export function localInstant(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error("Informe data e hora completas.");
  const wanted = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(wanted) || new Date(wanted).toISOString().slice(0, 16) !== value) throw new Error("Data inválida.");
  let guess = wanted;
  for (let index = 0; index < 3; index++) guess += wanted - Date.parse(`${localDateInput(new Date(guess).toISOString())}:00Z`);
  if (localDateInput(new Date(guess).toISOString()) !== value) throw new Error("Esse horário não existe no fuso de Brasília.");
  return new Date(guess).toISOString();
}
export function localDateInput(value: string | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function leadError(status: number, code?: string) {
  const codes: Record<string, string> = {
    consent_required: "Autorize o contato sobre este imóvel antes de enviar.", listing_unavailable: "Este imóvel foi informado como indisponível. Seu interesse não foi registrado.",
    idempotency_conflict: "Esta chave já foi usada com outros dados. Revise uma nova solicitação antes de confirmar.",
    lead_outdated: "Outro operador atualizou este interessado. O detalhe será recarregado; revise a versão atual antes de confirmar outra ação.",
    invalid_transition: "Esta ação não é permitida na etapa atual. Atualize e revise o detalhe.", invalid_event_time: "Confira as datas: ações realizadas não podem estar no futuro; visitas agendadas precisam de uma data futura.",
    invalid_assignee: "Escolha um administrador elegível na lista atualizada.", lead_capture_unavailable: "A captação está temporariamente indisponível. Tente novamente manualmente com o mesmo envio.",
    validation_failed: "Confira os campos destacados e tente novamente.", proxy_not_configured: "A integração de contato está temporariamente indisponível.",
  };
  return codes[code ?? ""] ?? ({ 400: "Confira os dados e parâmetros informados.", 401: "Sua sessão expirou. Entre novamente.", 403: "Acesso restrito ou origem não autorizada.", 404: "Registro não encontrado ou imóvel não disponível para esta ação.", 422: "Confira os campos e as condições desta ação.", 429: "Limite de solicitações atingido. Aguarde antes de tentar novamente.", 503: "Serviço indisponível. Você pode tentar novamente manualmente.", 504: "A resposta demorou. Repita o mesmo envio para confirmar, sem criar uma nova solicitação." } as Record<number, string>)[status] ?? "Não foi possível confirmar a operação. Você pode repetir o mesmo envio manualmente.";
}
