"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { leadError } from "@/lib/lead-presentation";
import { retrySeconds } from "@/lib/property-questions";
export type LeadClientError = { status: number; code: string; message: string; fields: Record<string, string> };
export function useLeadRequest() {
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<LeadClientError | null>(null);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!until) return; const timer = setInterval(() => { setNow(Date.now()); if (Date.now() >= until) clearInterval(timer); }, 1000); return () => clearInterval(timer); }, [until]);
  async function run<T>(url: string, schema: z.ZodType<T>, body?: string, onFailure?: (error: LeadClientError) => void): Promise<T | null> {
    if (running.current || Date.now() < until) return null;
    running.current = true; setBusy(true); setError(null);
    function fail(error: LeadClientError) { setError(error); onFailure?.(error); return null; }
    try {
      const response = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body, cache: "no-store", signal: AbortSignal.timeout(25000) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const wait = retrySeconds(response.headers.get("Retry-After"));
        if (wait != null) { setUntil(Date.now() + wait * 1000); setNow(Date.now()); }
        const details = z.record(z.string(), z.string()).safeParse(data?.error?.details);
        return fail({ status: response.status, code: String(data?.error?.code ?? "unavailable"), message: leadError(response.status, data?.error?.code), fields: details.success ? details.data : {} });
      }
      const parsed = schema.safeParse(data);
      if (!parsed.success) return fail({ status: 502, code: "invalid_response", message: leadError(502), fields: {} });
      return parsed.data;
    } catch { return fail({ status: 503, code: "network_error", message: "Não foi possível confirmar o envio. Tente novamente manualmente com os mesmos dados; a chave será preservada.", fields: {} }); }
    finally { running.current = false; setBusy(false); }
  }
  return { run, busy, error, secondsLeft: Math.max(0, Math.ceil((until - now) / 1000)), clearError: () => setError(null) };
}
