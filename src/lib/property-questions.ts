import { z } from "zod";
const text = z.string().trim().min(1).max(2000).refine(v => !v.includes("\u0000"));
export const historyMessageSchema = z.object({ role: z.enum(["user", "assistant"]), content: text }).strict();
export type HistoryMessage = z.infer<typeof historyMessageSchema>;
export const questionInputSchema = z.object({
  question: text,
  history: z.array(historyMessageSchema).max(6).default([]),
}).strict().refine(v => v.history.reduce((n, m) => n + m.content.length, 0) <= 8000);
export const questionResponseSchema = z.object({ data: z.object({
  answer: z.string().min(1).max(20000),
  citations: z.array(z.object({ id: z.string(), title: z.string(), url: z.string(), kind: z.enum(["listing", "web"]), start_index: z.number().int().optional(), end_index: z.number().int().optional() })).max(100),
  listing_id: z.union([z.string(), z.number().int()]), model: z.string(),
  context_updated_at: z.string().nullish(), web_search_used: z.boolean(),
}) });
export type QuestionAnswer = z.infer<typeof questionResponseSchema>["data"];
export function boundedHistory(messages: HistoryMessage[]) {
  const result: HistoryMessage[] = [];
  let size = 0;
  for (const message of messages.toReversed()) {
    // Never truncate a response or skip newer messages to include older context.
    if (result.length === 6 || message.content.length > 2000 || size + message.content.length > 8000) break;
    result.unshift(message); size += message.content.length;
  }
  return result;
}
export function citationUrl(value: string) {
  try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
export function questionError(status: number) {
  return ({ 400: "Revise a pergunta e os limites da conversa.", 404: "Este anúncio não está disponível para perguntas.", 429: "O limite temporário de perguntas foi atingido. Aguarde antes de tentar novamente.", 502: "A resposta não pôde ser concluída. Você pode tentar novamente.", 503: "O assistente está temporariamente indisponível. Os contatos do anúncio continuam disponíveis.", 504: "O assistente demorou para responder. Você pode tentar novamente." } as Record<number, string>)[status] ?? "Não foi possível enviar a pergunta. Tente novamente.";
}
export function retrySeconds(value: string | null) {
  if (!value) return null;
  const seconds = /^\d+$/.test(value) ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : null;
}
