import type { AssistantResponse, AssistantPageContext } from "./assistant-contracts";
import { boundedHistory, type HistoryMessage } from "./property-questions";
export type AssistantTurn = { question: string; response: AssistantResponse };
export type AssistantState = {
  turns: AssistantTurn[]; selectedId: string | null; token: string | null;
  mode: "search" | "property"; filters: AssistantResponse["applied_filters"];
  unverified: string[]; hasMore: boolean;
};
export function emptyAssistantState(selectedId: string | null = null): AssistantState {
  return { turns: [], selectedId, token: null, mode: selectedId ? "property" : "search", filters: {}, unverified: [], hasMore: false };
}
export function applyAssistantResponse(state: AssistantState, question: string, response: AssistantResponse): AssistantState {
  return { turns: [...state.turns, { question, response }], selectedId: response.selected_listing_id === null ? null : String(response.selected_listing_id), token: response.search_token, mode: response.mode, filters: response.applied_filters, unverified: response.unverified_preferences, hasMore: response.has_more };
}
export function assistantMetadata(state: AssistantState, context?: AssistantPageContext) {
  const history: HistoryMessage[] = state.turns.flatMap(t => [{ role: "user", content: t.question }, { role: "assistant", content: t.response.answer }]);
  return { history: boundedHistory(history), selected_listing_id: state.selectedId, search_token: state.token, ...(context ? { context } : {}) };
}
export function assistantPayload(state: AssistantState, question: string, context?: AssistantPageContext) { return { question: question.trim(), ...assistantMetadata(state, context) }; }
