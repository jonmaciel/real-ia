"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
export function ShareButton() {
  const [status, setStatus] = useState("Compartilhar");
  return (
    <button
      className="button secondary"
      onClick={async () => {
        try {
          if (navigator.share)
            await navigator.share({
              title: document.title,
              url: location.href,
            });
          else {
            await navigator.clipboard.writeText(location.href);
            setStatus("Link copiado");
          }
        } catch {
          setStatus("Não foi possível compartilhar");
        }
      }}
    >
      <Share2 size={16} />
      <span aria-live="polite">{status}</span>
    </button>
  );
}
