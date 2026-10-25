import type { ReactNode } from "react";
import type { AutomaticReview } from "@/lib/admin-contracts";

export function automaticReviewReason(review: AutomaticReview) {
  const errors: Record<string, string> = { ai_timeout: "A IA não respondeu a tempo.", ai_unavailable: "O provedor de IA está indisponível.", ai_not_configured: "A revisão automática está desabilitada ou não configurada.", ai_invalid_response: "A IA retornou uma resposta que não pôde ser validada." };
  return review.reason ? errors[review.reason] ?? review.reason : "Ainda não há uma decisão automática registrada.";
}
function reviewedAt(value?: string) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(parsed) : null;
}
export function AutomaticReviewBadge({ review }: { review?: AutomaticReview }) {
  return review ? <span className="status-badge automatic-review-badge" data-outcome={review.status}>{review.label}</span> : null;
}
export function AutomaticReviewPanel({ review, history, children }: { review?: AutomaticReview; history?: AutomaticReview[]; children?: ReactNode }) {
  return <section className="panel automatic-review" aria-label="Revisão automática">
    <h2>Revisão automática</h2>
    {review ? <>
      <AutomaticReviewBadge review={review} />
      <p>{automaticReviewReason(review)}</p>
      {review.missing_field_labels.length > 0 && <p><strong>Pendências apontadas:</strong> {review.missing_field_labels.join(", ")}.</p>}
      {review.reviewed && <p>{review.ai_evaluated ? "Analisado pela IA" : review.reviewer === "rules" ? "Verificação automática de dados" : "Tentativa de análise"}{reviewedAt(review.reviewed_at) ? ` em ${reviewedAt(review.reviewed_at)} (Brasília)` : ""}{review.confidence != null ? ` · Confiança: ${Math.round(review.confidence * 100)}%` : ""}.</p>}
      {review.policy_current === false && <p>Registro de uma política anterior. Uma nova avaliação pode produzir outra decisão.</p>}
      {review.evaluation_mode === "preview" ? <p>Esta é uma simulação. A publicação e a decisão editorial atual foram preservadas.</p> : review.reviewed && !review.applied ? <p>Esta análise faz parte do histórico e não substitui a decisão editorial atual.</p> : null}
    </> : <p>O histórico automático ainda não foi informado pelo backend.</p>}
    {children}
    {!!history?.length && <details><summary>Histórico de análises automáticas — últimas {history.length}</summary><ol>{history.map((entry, index) => <li key={String(entry.review_id ?? index)}>
      <p><strong>{entry.label}</strong>{reviewedAt(entry.reviewed_at) ? ` · ${reviewedAt(entry.reviewed_at)} (Brasília)` : ""}</p>
      <p>{automaticReviewReason(entry)}</p>
      {entry.missing_field_labels.length > 0 && <p>Pendências apontadas: {entry.missing_field_labels.join(", ")}.</p>}
      {entry.model && <p>Modelo: {entry.model}{entry.confidence != null ? ` · Confiança: ${Math.round(entry.confidence * 100)}%` : ""}</p>}
    </li>)}</ol></details>}
  </section>;
}
