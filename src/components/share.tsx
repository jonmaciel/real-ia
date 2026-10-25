"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
export function ShareButton({ title, text, url: canonicalUrl }: { title?: string; text?: string; url?: string } = {}) {
  const [status, setStatus] = useState("Compartilhar");
  const [busy, setBusy] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  async function share() {
    setBusy(true);
    setStatus("Compartilhar");
    setManualUrl("");
    // Section anchors are navigation context, not part of the property identity.
    const url = new URL(canonicalUrl ?? location.href);
    url.hash = "";
    try {
      if (navigator.share) {
        await navigator.share({ title: title ?? document.title, text, url: url.href });
      } else {
        await navigator.clipboard.writeText(url.href);
        setStatus("Link copiado");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setManualUrl(url.href);
        setStatus("Copie o link abaixo");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="share-control">
      <button className="button secondary" disabled={busy} onClick={share}>
        <Share2 size={16} />
        <span aria-live="polite">{busy ? "Compartilhando…" : status}</span>
      </button>
      {manualUrl && (
        <label className="share-fallback">
          Link deste imóvel
          <input readOnly value={manualUrl} onFocus={(event) => event.currentTarget.select()} />
          <small>Selecione o link para copiar e enviar.</small>
        </label>
      )}
    </div>
  );
}
