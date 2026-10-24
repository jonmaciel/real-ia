"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { assistantAudioResponseSchema, assistantIdSchema, assistantResponseSchema, type AssistantPageContext, type AssistantResponse } from "@/lib/assistant-contracts";
import { applyAssistantResponse, assistantMetadata, assistantPayload, emptyAssistantState, type AssistantState } from "@/lib/assistant-state";
import { AUDIO_TIMEOUT_MS, audioErrorMessage, audioFileError } from "@/lib/assistant-audio";
import { questionError, retrySeconds } from "@/lib/property-questions";
function timestamp() { return Date.now(); }
function useAssistantController() {
  const [state, setState] = useState(emptyAssistantState);
  const stateRef = useRef(state);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendingAudio, setSendingAudio] = useState(false);
  const [conversationVersion, setConversationVersion] = useState(0);
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
    generation.current++; pending.current?.abort(); pending.current = null; setBusy(false); setSendingAudio(false);
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
    setConversationVersion(value => value + 1);
    if (!keepQuestion) setQuestion("");
    setStatus(keepQuestion ? "Busca reiniciada: preferências e exclusões anteriores foram apagadas. Envie a pergunta para continuar." : "Conversa limpa.");
  }
  async function send(value: string | File, context?: AssistantPageContext): Promise<boolean> {
    const audio = typeof value !== "string";
    const text = typeof value === "string" ? value.trim() : "";
    if (pending.current || timestamp() < retryAt || (!audio && (!text || text.length > 2000))) return false;
    if (audio) {
      const invalid = audioFileError(value as File);
      if (invalid) { setError({ ...invalid, message: audioErrorMessage(invalid.code)! }); return false; }
    }
    const snapshot = stateRef.current;
    const controller = new AbortController(); pending.current = controller;
    const version = ++generation.current;
    setBusy(true); setSendingAudio(audio); setError(null);
    if (!audio) setQuestion(value as string);
    setStatus(audio ? "Transcrevendo áudio e consultando o assistente…" : "Consultando o catálogo e os dados públicos…");
    const deadline = AbortSignal.timeout(audio ? AUDIO_TIMEOUT_MS : 75000);
    try {
      let body: FormData | string;
      if (audio) {
        body = new FormData(); body.set("audio", value as File); body.set("metadata", JSON.stringify(assistantMetadata(snapshot, context)));
      } else body = JSON.stringify(assistantPayload(snapshot, text, context));
      const response = await fetch(audio ? "/api/assistente/audio-mensagens" : "/api/assistente/mensagens", {
        method: "POST", ...(audio ? {} : { headers: { "Content-Type": "application/json" } }),
        body, signal: AbortSignal.any([controller.signal, deadline]),
      });
      if (version !== generation.current) return false;
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        const code = typeof body?.error?.code === "string" ? body.error.code : "unavailable";
        if (response.status === 429) { setNow(timestamp()); setRetryAt(timestamp() + (retrySeconds(response.headers.get("Retry-After")) ?? 60) * 1000); }
        setError({ status: response.status, code, message: code === "invalid_search_token" ? "A memória da busca expirou ou não pôde ser validada. Inicie uma nova busca para apagar as preferências e exclusões anteriores." : audioErrorMessage(code) ?? questionError(response.status) });
        setStatus(audio ? "Não foi possível responder. O áudio foi preservado para uma nova tentativa manual." : "Não foi possível responder. Sua mensagem foi preservada."); return false;
      }
      const result = (audio ? assistantAudioResponseSchema : assistantResponseSchema).safeParse(await response.json());
      if (version !== generation.current) return false;
      if (!result.success || (result.data.data.mode === "property" && String(result.data.data.selected_listing_id) !== snapshot.selectedId)) {
        setError({ status: 502, code: "ai_invalid_response", message: questionError(502) }); setStatus("Resposta não pôde ser validada."); return false;
      }
      commit(applyAssistantResponse(snapshot, audio ? result.data.data.transcription!.text : text, result.data.data));
      if (!audio) setQuestion("");
      if (result.data.data.mode === "search") for (const listener of searchListeners.current) listener(result.data.data);
      setStatus(result.data.data.context_changed && result.data.data.mode === "search" ? "Buscando outras opções. Resposta recebida." : "Resposta recebida. Consulte os dados e as fontes.");
      return true;
    } catch {
      if (version !== generation.current || controller.signal.aborted) return false;
      setError({ status: deadline.aborted ? 504 : 503, code: deadline.aborted ? "ai_timeout" : "network_error", message: questionError(deadline.aborted ? 504 : 0) });
      setStatus(audio ? "Não foi possível responder. O áudio foi preservado para uma nova tentativa manual." : "Não foi possível responder. Sua mensagem foi preservada.");
      return false;
    } finally {
      if (version === generation.current) { pending.current = null; setBusy(false); setSendingAudio(false); }
    }
  }
  const continueSearch = useCallback(() => {
    if (stateRef.current.mode === "search" && stateRef.current.selectedId === null) return;
    cancel(false); commit({ ...stateRef.current, selectedId: null, mode: "search" }); setError(null);
    setStatus("Seleção removida. Preferências e histórico mantidos; envie uma mensagem para continuar buscando.");
  }, [cancel, commit]);
  return { state, question, setQuestion, busy, sendingAudio, conversationVersion, error, status, continueSearch, subscribeSearch, waiting: retryAt > now, secondsLeft: Math.max(0, Math.ceil((retryAt - now) / 1000)), send, cancel, select, registerPage, pageListingId, clear: () => reset(null), restartSearch: () => reset(null, true), restartProperty: () => reset(pageRef.current) };
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
