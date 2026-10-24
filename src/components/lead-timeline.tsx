import type { LeadEvent } from "@/lib/lead-contracts";
import { channelLabels, leadActionLabels, leadDate, leadStatusLabels } from "@/lib/lead-presentation";
import { money } from "@/lib/presentation";
export function LeadTimeline({ events }: { events: LeadEvent[] }) {
  return <ol className="lead-timeline" aria-label="Histórico de acompanhamento">{events.map(event => <li key={event.id} data-event-id={event.id}>
    <h3>{leadActionLabels[event.event_type] ?? event.event_type}</h3>
    <p>{event.actor.name ?? "Sistema"} · {leadStatusLabels[event.from_status]} → {leadStatusLabels[event.to_status]}</p>
    <dl><div><dt>Aconteceu em</dt><dd>{leadDate(event.occurred_at)}</dd></div><div><dt>Registrado em</dt><dd>{leadDate(event.created_at)}</dd></div>{event.scheduled_at && <div><dt>Visita prevista</dt><dd>{leadDate(event.scheduled_at)}</dd></div>}{event.channel && <div><dt>Canal</dt><dd>{channelLabels[event.channel]}</dd></div>}</dl>
    {event.note && <p className="lead-free-text">{event.note}</p>}
    {event.details.reason && <p className="lead-free-text">Motivo: {event.details.reason}</p>}
    {event.event_type === "assigned" && <p>{event.details.assigned_to_id == null ? "Responsável removido." : `Responsável designado: ID ${event.details.assigned_to_id}.`}</p>}
    {event.details.closed_amount != null && <p>Valor efetivo de fechamento: {money(event.details.closed_amount, event.details.closed_currency ?? null)}</p>}
  </li>)}</ol>;
}
