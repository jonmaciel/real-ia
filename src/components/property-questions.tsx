"use client";
import { useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { citationUrl } from "@/lib/property-questions";
import { assistantFilterLabels } from "@/lib/assistant-presentation";
import { useAssistant } from "./assistant-provider";
import { AssistantRecommendations } from "./assistant-recommendations";
const propertySuggestions = ["Qual é o custo total?", "Quais taxas estão incluídas?", "Como é a localização?", "Tem mercado ou escola por perto?"];
export function PropertyQuestions() {
  const chat = useAssistant();
  const { state, question, busy, error, waiting } = chat;
  const propertyMode = state.mode === "property" && state.selectedId !== null;
  const input = useRef<HTMLTextAreaElement>(null);
  const latest = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (latest.current?.offsetParent) {
      const target = latest.current.querySelector(".assistant-recommendation") ?? latest.current.querySelector(".question-answer") ?? latest.current;
      target.scrollIntoView({ block: "start", behavior: "instant" });
      if (input.current && (document.activeElement === document.body || input.current.closest(".chat-window")?.contains(document.activeElement))) input.current.focus({ preventScroll: true });
    }
  }, [state.turns.length]);
  const filters = assistantFilterLabels(state.filters);
  function clear() { chat.clear(); input.current?.focus(); }
  return <section className="property-questions" aria-labelledby="questions-title">
    <div className="question-conversation">
      <h2 id="questions-title">{propertyMode ? "Faça qualquer pergunta sobre o imóvel" : "Encontre seu imóvel"}</h2>
      <p className="questions-note">{propertyMode ? "Assistente de IA sobre o anúncio. Não confirma disponibilidade, negocia ou agenda visitas." : "Conte a cidade, o orçamento e o que você procura."}</p>
      {!propertyMode && chat.pageListingId && <p className="assistant-context">Buscando outras opções. O anúncio aberto na página não está selecionado na conversa.</p>}
      {propertyMode && <p className="assistant-context">Imóvel selecionado: #{state.selectedId}. Ao pedir alternativas, a conversa volta para a busca.</p>}
      {filters.length > 0 && <details className="assistant-filters" open={state.mode === "search"}><summary>Critérios efetivamente aplicados</summary><ul>{filters.map((label, i) => <li key={i}>{label}</li>)}</ul></details>}
      {!state.turns.length && <div className="question-suggestions">{(propertyMode ? propertySuggestions : ["Quero alugar", "Quero comprar"]).map(s => <button type="button" key={s} disabled={busy || waiting} onClick={() => void chat.send(s)}>{s}</button>)}</div>}
      <div className="question-history" aria-label="Conversa com o Morada" tabIndex={state.turns.length ? 0 : undefined}>
        {state.turns.map((turn, i) => <div className="question-turn" key={i} ref={i === state.turns.length - 1 ? latest : undefined}>
          <p className="question-user"><strong>Você</strong>{turn.question}</p>
          <div className="question-answer"><strong>Morada</strong>
            <small>{turn.response.mode === "property" ? `Resposta sobre o imóvel #${turn.response.selected_listing_id}` : "Busca no catálogo"}</small>
            <p>{turn.response.answer}</p>
            {turn.response.action === "no_results" && <p>Não há novas opções para estes critérios e as exclusões desta conversa. Ajuste sua busca por mensagem ou inicie uma nova busca.</p>}
            {turn.response.unverified_preferences.length > 0 && <div className="assistant-unverified"><strong>Ainda não foi possível verificar</strong><ul>{turn.response.unverified_preferences.map((item, j) => <li key={j}>{item}</li>)}</ul></div>}
            <AssistantRecommendations cards={turn.response.recommendations} onSelect={chat.select} />
            {turn.response.web_search_used && <small>Pesquisa externa utilizada nesta resposta.</small>}
            <ul className="question-citations">{turn.response.citations.map((c, index) => { const url = citationUrl(c.url); return url ? <li key={`${c.id}-${index}`}><span>{c.kind === "web" ? "Pesquisa sobre a região" : "Anúncio original"}</span><a href={url} target="_blank" rel="noopener noreferrer">{c.title || "Consultar fonte"}</a></li> : null; })}</ul>
            {turn.response.context_updated_at && !Number.isNaN(Date.parse(turn.response.context_updated_at)) && <small>Dados de referência: {new Date(turn.response.context_updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Não representa verificação humana.</small>}
          </div>
        </div>)}
      </div>
      {state.turns.at(-1)?.response.action === "no_results" && state.mode === "search" && <button className="button secondary assistant-more" type="button" onClick={chat.restartSearch}>Iniciar nova busca</button>}
      {state.hasMore && state.mode === "search" && <button className="button secondary assistant-more" type="button" disabled={busy || waiting} onClick={() => void chat.send("Mostre mais opções")}>Mostrar mais opções</button>}
    </div>
    <form onSubmit={e => { e.preventDefault(); void chat.send(question); }}>
      <label htmlFor="property-question">{propertyMode ? "Sua pergunta sobre o imóvel" : "O que você procura?"}</label>
      <textarea id="property-question" ref={input} value={question} maxLength={2000} rows={3} disabled={busy} placeholder={propertyMode ? "Pergunte sobre preço, taxas ou peça outra opção…" : "Ex.: quero alugar em Curitiba, até R$ 3.000, com dois quartos e que aceite pets"} onChange={e => chat.setQuestion(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void chat.send(question); } }} aria-describedby="question-help" />
      <small id="question-help">Enter envia · Shift + Enter quebra linha. {question.length}/2.000</small>
      <button type="submit" className="button primary" disabled={busy || waiting || !question.trim() || error?.code === "invalid_search_token" || error?.status === 404}><Send size={16} aria-hidden="true" />{busy ? "Consultando…" : error ? "Tentar novamente" : "Enviar pergunta"}</button>
      {busy && <button type="button" className="question-clear" onClick={() => chat.cancel()}>Cancelar envio</button>}
    </form>
    <p role="status" aria-live="polite" aria-atomic="true" className="question-status">{chat.status}</p>
    {error && <div className="question-error"><p>{error.message}</p>
      {error.code === "invalid_search_token" && <><p>Ao iniciar uma nova busca, as preferências e as opções já mostradas serão reiniciadas. Nenhuma mensagem será reenviada automaticamente.</p><button type="button" className="button secondary" onClick={chat.restartSearch}>Iniciar nova busca</button></>}
      {error.status === 404 && <button type="button" className="button secondary" onClick={chat.continueSearch}>Continuar buscando sem este imóvel</button>}
    </div>}
    {waiting && <p className="questions-note">Tente novamente em {chat.secondsLeft} s.</p>}
    <div className="question-tools">
      <button type="button" className="question-clear" onClick={clear}>Limpar conversa</button>
      <details className="question-disclaimer"><summary>Opções e privacidade</summary>
        <button className="question-clear" type="button" onClick={chat.restartSearch}>Iniciar nova busca</button>
        {chat.pageListingId && <button className="question-clear" type="button" onClick={chat.restartProperty}>Recomeçar sobre este imóvel</button>}
        <small className="questions-note">A nova busca apaga preferências e exclusões anteriores. Conversa mantida só em memória nesta visita, inclusive ao abrir imóveis. A IA pode errar; confirme valores e condições com o anunciante. Cancelar não garante interrupção do processamento no servidor.</small>
      </details>
    </div>
  </section>;
}
