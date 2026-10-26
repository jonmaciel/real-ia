"use client";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, SlidersHorizontal, Sparkles } from "lucide-react";
import { assistantSearchParams, exactFiltersSchema, type AssistantSearch } from "@/lib/assistant-search";
import type { AssistantFilters, AssistantResponse } from "@/lib/assistant-contracts";
import { useAssistant } from "./assistant-provider";
import { AssistantAudio } from "./assistant-audio";
import { AssistantMarkdown } from "./assistant-markdown";
import { FilterNavigationContext } from "./filter-navigation";

function responseKey(response: AssistantResponse | undefined, perPage: number) {
  const excluded = response?.excluded_ids ?? response?.filter_proposal?.excluded_ids;
  if (!response || response.mode !== "search" || !excluded) return null;
  try { return assistantSearchParams({ filters: response.applied_filters, excludedIds: excluded.map(String), page: 1, perPage }).toString(); }
  catch { return null; }
}
export function SearchAssistant({ manualForm, children, filterPills, query, queryKey, resultError, placement = "results" }: {
  manualForm: ReactNode; children?: ReactNode; filterPills?: ReactNode; query: AssistantSearch; queryKey: string; resultError?: string; placement?: "home" | "results";
}) {
  const chat = useAssistant();
  const last = chat.state.turns.at(-1)?.response;
  const { continueSearch, subscribeSearch } = chat;
  const router = useRouter();
  const [manual, setManual] = useState(() => placement === "results" && responseKey(last, query.perPage) === queryKey && last?.ui_action?.type === "switch_search_tab");
  const [audioActive, setAudioActive] = useState(false);
  const [pending, startTransition] = useTransition();
  const [updateError, setUpdateError] = useState(false);
  // A home search hands off its latest answer and authoritative filters to /buscar.
  const [expectedKey, setExpectedKey] = useState<string | null>(() => {
    const key = responseKey(chat.state.turns.at(-1)?.response, query.perPage);
    return placement === "results" && key === queryKey ? key : null;
  });
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { continueSearch(); }, [continueSearch]);
  useEffect(() => subscribeSearch(last => {
    if (last.action === "traditional_search" && last.ui_action?.type === "switch_search_tab") setManual(true);
    // Complete authoritative exclusions are required, including during clarification.
    // Never infer them from the opaque token or drop them to manufacture a list.
    const key = responseKey(last, query.perPage);
    if (!key) { setUpdateError(true); return; }
    setUpdateError(false); setExpectedKey(key);
    startTransition(() => {
      if (placement === "home") router.push(`/buscar?${key}`);
      else router.replace(`/buscar?${key}`, { scroll: false });
    });
  }), [subscribeSearch, query.perPage, router, placement]);
  const updating = chat.busy || pending;
  const updated = expectedKey === queryKey && !resultError && !updateError;
  const message = chat.busy ? chat.sendingAudio ? "Transcrevendo e pensando…" : "Pensando…"
    : pending ? "Atualizando imóveis…"
    : chat.error ? placement === "home" && chat.error.status === 503 ? "A busca com IA está temporariamente indisponível. Tente novamente ou use os filtros." : chat.error.message
    : updateError || (expectedKey === queryKey && resultError) ? "Não foi possível atualizar a lista. Tente novamente em instantes."
    : updated ? "Lista atualizada."
    : "";
  const clarification = updated && !updating && !chat.error && last?.action === "clarify" ? last : null;
  function send(audio?: File): Promise<boolean> {
    if (updating || (!audio && audioActive)) return Promise.resolve(false);
    setUpdateError(false);
    try {
    // Hydrate only when the accepted URL differs from the conversation snapshot.
    const activeQuery = placement === "home" ? { ...query, filters: chat.state.filters } : query;
    const current = assistantSearchParams({ ...activeQuery, page: 1, excludedIds: [] }, false).toString();
    let previous = "";
    try { previous = assistantSearchParams({ filters: chat.state.filters, excludedIds: [], page: 1, perPage: query.perPage }, false).toString(); } catch { /* Invalid snapshots are never submitted. */ }
    const snapshot: AssistantFilters = exactFiltersSchema.parse(activeQuery.filters);
    for (const key of ["min_price", "max_price", "min_area", "max_area"] as const) if (snapshot[key] != null) snapshot[key] = Number(snapshot[key]);
    return chat.send(audio ?? chat.question, { page: placement === "home" ? "home" : "search", ...(current !== previous ? { current_filters: snapshot } : {}) });
    } catch { setUpdateError(true); return Promise.resolve(false); }
  }
  function restart() {
    chat.restartSearch(); setExpectedKey(null); setUpdateError(false);
    if (placement !== "home") startTransition(() => router.replace("/buscar", { scroll: false }));
    input.current?.focus();
  }
  function submitFilters(event: FormEvent<HTMLDivElement>) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    if (updating) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) if (typeof value === "string" && value !== "") params.append(key, value);
    params.set("page", "1");
    const href = `/buscar?${params}`;
    setUpdateError(false); setExpectedKey(null);
    startTransition(() => {
      if (href === window.location.pathname + window.location.search) router.refresh();
      else router.push(href, { scroll: placement === "home" });
    });
  }
  function navigateFilters(href: string, optimisticUpdate: () => void) {
    if (chat.busy) chat.cancel(false);
    setUpdateError(false); setExpectedKey(null);
    startTransition(() => { optimisticUpdate(); router.push(href, { scroll: false }); });
  }
  return <FilterNavigationContext.Provider value={{ pending, navigate: navigateFilters }}><div className="search-experience" data-manual={manual}>
    <section className="search-assistant" aria-label="Busca de imóveis">
      <div className="search-mode-bar">
        <div role="tablist" aria-label="Como buscar" className="search-mode-tabs">
          {[{ label: "Busca com IA", icon: Sparkles }, { label: "Usar filtros", icon: SlidersHorizontal }].map(({ label, icon: Icon }, index) => <button
            key={label} ref={element => { tabs.current[index] = element; }} type="button" role="tab"
            id={`${id}-tab-${index}`} aria-selected={Number(manual) === index} aria-controls={`${id}-panel-${index}`} tabIndex={Number(manual) === index ? 0 : -1}
            onClick={() => setManual(Boolean(index))} onKeyDown={event => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
              event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index;
              setManual(Boolean(next)); tabs.current[next]?.focus();
            }}><Icon size={16} aria-hidden="true" />{label}</button>)}
        </div>
        {!manual && chat.state.turns.length > 0 && <button className="search-ai-restart" type="button" onClick={restart}>Nova busca</button>}
      </div>
      <div role="tabpanel" id={`${id}-panel-0`} aria-labelledby={`${id}-tab-0`} hidden={manual} className="search-ai-panel">
        <form className="search-ai-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
          <label htmlFor={`${id}-question`} className="sr-only">O que você procura?</label>
          <textarea id={`${id}-question`} ref={input} rows={2} maxLength={2000} value={chat.question} disabled={updating || audioActive}
            placeholder="Ex.: uma casa em Araucária, para alugar até R$ 3.000. Você pode completar aos poucos."
            onChange={event => chat.setQuestion(event.target.value)} onKeyDown={event => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
            }} aria-describedby={`${id}-help`} />
          <button className="button primary" type="submit" aria-label={chat.error ? "Tentar novamente" : "Enviar busca"} title="Enviar busca"
            disabled={updating || audioActive || chat.waiting || !chat.question.trim() || chat.error?.code === "invalid_search_token" || chat.error?.status === 404}>
            <ArrowUp size={20} aria-hidden="true" />
          </button>
          <span id={`${id}-help`} className="sr-only">Descreva o imóvel, a cidade e o orçamento. Enter envia; Shift mais Enter quebra linha. Até 2.000 caracteres. A IA pode errar.</span>
        </form>
        <AssistantAudio key={`${chat.state.selectedId}:${chat.conversationVersion}`} active={!manual} disabled={updating || chat.waiting || chat.error?.code === "invalid_search_token" || chat.error?.status === 404} onActiveChange={setAudioActive} onSend={file => send(file)} />
        {last?.input_type === "audio" && last.transcription && <p className="audio-transcription"><strong>Transcrição:</strong> {last.transcription.text}</p>}
        <div className="search-ai-status" role="status" aria-live="polite" aria-atomic="true">{message}{clarification && <> <AssistantMarkdown text={clarification.answer} citations={clarification.citations} /></>}{chat.waiting && ` Tente novamente em ${chat.secondsLeft} s.`}</div>
        {chat.busy && <button type="button" className="search-ai-restart" onClick={() => chat.cancel()}>Cancelar envio</button>}
        {(chat.error?.code === "invalid_search_token" || chat.error?.status === 404) && <button type="button" className="search-ai-restart" onClick={restart}>Iniciar nova busca</button>}
      </div>
      <div role="tabpanel" id={`${id}-panel-1`} aria-labelledby={`${id}-tab-1`} hidden={!manual} inert={updating} onSubmitCapture={submitFilters}>
        {manualForm}
      </div>
    </section>
    {filterPills}
    {placement === "results" && <div className="main-search-results" aria-label="Imóveis da busca" aria-busy={pending}>
      {pending ? <div className="search-results-loading" role="status">Atualizando imóveis…</div>
        : updateError ? <div className="state-box"><p>Não foi possível atualizar os imóveis com os critérios da conversa.</p><button className="button secondary" type="button" onClick={() => { setManual(true); setUpdateError(false); }}>Usar filtros</button></div>
        : children}
    </div>}
  </div></FilterNavigationContext.Provider>;
}
