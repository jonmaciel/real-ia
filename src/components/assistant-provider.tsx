"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { assistantIdSchema, assistantResponseSchema, type AssistantPageContext, type AssistantResponse } from "@/lib/assistant-contracts";
import { applyAssistantResponse, assistantPayload, emptyAssistantState, type AssistantState } from "@/lib/assistant-state";
import { questionError, retrySeconds } from "@/lib/property-questions";
function timestamp() { return Date.now(); }
function useAssistantController() {
  const [state, setState] = useState(emptyAssistantState);
  const stateRef = useRef(state);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; code: string; status: number } | null>(null);
  const [status, setStatus] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(0);
  const [pageListingId, setPageListingId] = useState<string | null>(null);
  const pageRef = useRef<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const searchListeners = useRef(new Set<(response: AssistantResponse) => void>());
  const subscribeSearch = useCallback((listener: (response: AssistantResponse) => void) => {
    searchListeners.current.add(listener);
    return () => { searchListeners.current.delete(listener); };
  }, []);
  const commit = useCallback((value: AssistantState) => { stateRef.current = value; setState(value); }, []);
  const cancel = useCallback((announce = true) => {
    generation.current++; pending.current?.abort(); pending.current = null; setBusy(false);
    if (announce) setStatus("Envio cancelado. O processamento no servidor pode continuar.");
  }, []);
  useEffect(() => () => { generation.current++; pending.current?.abort(); }, []);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setNow(timestamp()), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  const select = useCallback((id: string) => {
    if (!assistantIdSchema.safeParse(id).success || stateRef.current.selectedId === id) return;
    cancel(false); setError(null);
    commit({ ...stateRef.current, selectedId: id, mode: "property" });
    setStatus("Imóvel selecionado. A conversa e as preferências foram mantidas.");
  }, [cancel, commit]);
  const registerPage = useCallback((id: string) => {
    pageRef.current = id; setPageListingId(id); select(id);
    return () => { if (pageRef.current === id) { pageRef.current = null; setPageListingId(null); } };
  }, [select]);
  function reset(selectedId: string | null, keepQuestion = false) {
    cancel(false); commit(emptyAssistantState(selectedId)); setError(null);
    if (!keepQuestion) setQuestion("");
    setStatus(keepQuestion ? "Busca reiniciada: preferências e exclusões anteriores foram apagadas. Envie a pergunta para continuar." : "Conversa limpa.");
  }
  async function send(value: string, context?: AssistantPageContext) {
    const text = value.trim();
    if (pending.current || timestamp() < retryAt || !text || text.length > 2000) return;
    const snapshot = stateRef.current;
    const controller = new AbortController(); pending.current = controller;
    const version = ++generation.current;
    setBusy(true); setError(null); setQuestion(value); setStatus("Consultando o catálogo e os dados públicos…");
    const deadline = AbortSignal.timeout(75000);
    try {
      const response = await fetch("/api/assistente/mensagens", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assistantPayload(snapshot, text, context)), signal: AbortSignal.any([controller.signal, deadline]),
      });
      if (version !== generation.current) return;
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const code = typeof body?.error?.code === "string" ? body.error.code : "unavailable";
        if (response.status === 429) { setNow(timestamp()); setRetryAt(timestamp() + (retrySeconds(response.headers.get("Retry-After")) ?? 60) * 1000); }
        setError({ status: response.status, code, message: code === "invalid_search_token" ? "A memória da busca expirou ou não pôde ser validada. Inicie uma nova busca para apagar as preferências e exclusões anteriores." : questionError(response.status) });
        setStatus("Não foi possível responder. Sua mensagem foi preservada."); return;
      }
      const result = assistantResponseSchema.safeParse(await response.json());
      if (version !== generation.current) return;
      if (!result.success || (result.data.data.mode === "property" && String(result.data.data.selected_listing_id) !== snapshot.selectedId)) {
        setError({ status: 502, code: "ai_invalid_response", message: questionError(502) }); setStatus("Resposta não pôde ser validada."); return;
      }
      commit(applyAssistantResponse(snapshot, text, result.data.data)); setQuestion("");
      if (result.data.data.mode === "search") for (const listener of searchListeners.current) listener(result.data.data);
      setStatus(result.data.data.context_changed && result.data.data.mode === "search" ? "Buscando outras opções. Resposta recebida." : "Resposta recebida. Consulte os dados e as fontes.");
    } catch {
      if (version !== generation.current || controller.signal.aborted) return;
      setError({ status: deadline.aborted ? 504 : 503, code: deadline.aborted ? "ai_timeout" : "network_error", message: questionError(deadline.aborted ? 504 : 0) });
      setStatus("Não foi possível responder. Sua mensagem foi preservada.");
    } finally {
      if (version === generation.current) { pending.current = null; setBusy(false); }
    }
  }
  const continueSearch = useCallback(() => {
    if (stateRef.current.mode === "search" && stateRef.current.selectedId === null) return;
    cancel(false); commit({ ...stateRef.current, selectedId: null, mode: "search" }); setError(null);
    setStatus("Seleção removida. Preferências e histórico mantidos; envie uma mensagem para continuar buscando.");
  }, [cancel, commit]);
  return { state, question, setQuestion, busy, error, status, continueSearch, subscribeSearch, waiting: retryAt > now, secondsLeft: Math.max(0, Math.ceil((retryAt - now) / 1000)), send, cancel, select, registerPage, pageListingId, clear: () => reset(null), restartSearch: () => reset(null, true), restartProperty: () => reset(pageRef.current) };
}
const AssistantContext = createContext<ReturnType<typeof useAssistantController> | null>(null);
export function AssistantProvider({ children }: { children: ReactNode }) {
  const controller = useAssistantController();
  return <AssistantContext.Provider value={controller}>{children}</AssistantContext.Provider>;
}
export function useAssistant() {
  const value = useContext(AssistantContext);
  if (!value) throw new Error("AssistantProvider required");
  return value;
}
// Receives an ID only after the server has validated a public real-estate listing.
export function ListingConversationSelection({ id }: { id: string }) {
  const { registerPage } = useAssistant();
  useEffect(() => registerPage(id), [id, registerPage]);
  return null;
}
