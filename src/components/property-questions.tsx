"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { boundedHistory, citationUrl, questionError, questionResponseSchema, retrySeconds, type QuestionAnswer, type HistoryMessage } from "@/lib/property-questions";
function currentTime() { return Date.now(); }
type Turn = { question: string; response: QuestionAnswer };
const suggestions = ["Qual é o custo total?", "Quais taxas estão incluídas?", "Como é a localização?", "Tem mercado ou escola por perto?"];
export function PropertyQuestions({ listingId }: { listingId: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const locked = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const latest = useRef<HTMLDivElement>(null);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setNow(currentTime()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const waiting = retryAt > now;
  async function send(value: string) {
    const trimmed = value.trim();
    if (locked.current || currentTime() < retryAt || !trimmed || trimmed.length > 2000) return;
    locked.current = true; setBusy(true); setError(""); setQuestion(value); setStatus("Consultando os dados do imóvel…");
    const controller = new AbortController(); abort.current = controller;
    const history: HistoryMessage[] = turns.flatMap(t => [{ role: "user", content: t.question }, { role: "assistant", content: t.response.answer }]);
    try {
      const response = await fetch(`/api/imoveis/${encodeURIComponent(listingId)}/perguntas`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history: boundedHistory(history) }), signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) { const seconds = retrySeconds(response.headers.get("Retry-After")) ?? 60; setNow(currentTime()); setRetryAt(currentTime() + seconds * 1000); }
        throw new Error(questionError(response.status));
      }
      const parsed = questionResponseSchema.safeParse(await response.json());
      if (!parsed.success || String(parsed.data.data.listing_id) !== listingId) throw new Error(questionError(502));
      setTurns(old => [...old, { question: trimmed, response: parsed.data.data }]);
      setQuestion(""); setStatus("Resposta recebida. Consulte as fontes junto à resposta.");
      requestAnimationFrame(() => { if (latest.current?.offsetParent) latest.current.scrollIntoView({ block: "nearest", behavior: "instant" }); if (input.current?.offsetParent && input.current.closest(".chat-window")?.contains(document.activeElement)) input.current.focus({ preventScroll: true }); });
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error && Object.values([400,404,429,502,503,504].map(questionError)).includes(e.message) ? e.message : questionError(0));
      setStatus("Não foi possível responder. Sua pergunta foi preservada.");
    } finally { locked.current = false; setBusy(false); }
  }
  function clear() { if (locked.current) return; setTurns([]); setQuestion(""); setError(""); setStatus("Conversa limpa."); input.current?.focus(); }
  return <section className="property-questions" aria-labelledby="questions-title">
    <div className="question-conversation">
    <div className="questions-heading"><MessageCircle size={20} aria-hidden="true" /><span>Conheça melhor este lugar</span></div>
    <h2 id="questions-title">Faça qualquer pergunta sobre o imóvel</h2>
    <p className="questions-note">Assistente de IA sobre o anúncio. Não confirma disponibilidade, negocia ou agenda visitas.</p>
    {!turns.length && <div className="question-suggestions">{suggestions.map(s => <button type="button" key={s} disabled={busy || waiting} onClick={() => void send(s)}>{s}</button>)}</div>}
    <div className="question-history" aria-label="Conversa sobre este imóvel" tabIndex={turns.length ? 0 : undefined}>
      {turns.map((turn, i) => <div className="question-turn" key={i} ref={i === turns.length - 1 ? latest : undefined}>
        <p className="question-user"><strong>Você</strong>{turn.question}</p>
        <div className="question-answer"><strong>Morada</strong><p>{turn.response.answer}</p>
          {turn.response.web_search_used && <small>Pesquisa externa utilizada nesta resposta.</small>}
          <ul className="question-citations">{turn.response.citations.map((c, index) => { const url = citationUrl(c.url); return url ? <li key={`${c.id}-${index}`}><span>{c.kind === "web" ? "Pesquisa sobre a região" : "Anúncio original"}</span><a href={url} target="_blank" rel="noopener noreferrer">{c.title || "Consultar fonte"}</a></li> : null; })}</ul>
          {turn.response.context_updated_at && !Number.isNaN(Date.parse(turn.response.context_updated_at)) && <small>Dados do anúncio de referência: {new Date(turn.response.context_updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Não representa verificação humana.</small>}
        </div>
      </div>)}
    </div>
    </div>
    <form onSubmit={e => { e.preventDefault(); void send(question); }}>
      <label htmlFor="property-question">Sua pergunta sobre o imóvel</label>
      <textarea id="property-question" ref={input} value={question} maxLength={2000} rows={3} disabled={busy} onChange={e => { setQuestion(e.target.value); setError(""); }} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(question); } }} aria-describedby="question-help" />
      <small id="question-help">Enter envia · Shift + Enter quebra linha. {question.length}/2.000</small>
      <button type="submit" className="button primary" disabled={busy || waiting || !question.trim()}><Send size={16} aria-hidden="true" />{busy ? "Consultando…" : error ? "Tentar novamente" : "Enviar pergunta"}</button>
    </form>
    <p role="status" aria-live="polite" aria-atomic="true" className="question-status">{status}</p>
    {error && <p className="question-error">{error}</p>}
    {waiting && <p className="questions-note">Tente novamente em {Math.ceil((retryAt - now) / 1000)} s.</p>}
    <div className="question-tools">
    <button type="button" className="question-clear" disabled={busy} onClick={clear}>Limpar conversa</button>
    <details className="question-disclaimer"><summary>Sobre o assistente</summary><small className="questions-note">Conversa mantida apenas nesta página. Confira preços e condições com o anunciante. Informações de IA podem conter erros.</small></details>
    </div>
  </section>;
}
